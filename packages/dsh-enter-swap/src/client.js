/**
 * Browser half of dsh-enter-swap.
 *
 * Problem: dsh's composer registers "发送消息" (Enter) and "换行" (Shift+Enter)
 * as *fixed* shortcuts. Fixed rows are read-only by design — the reference
 * dialog renders them without an editor, and `ShortcutRegistry.edit()` refuses
 * them with `not-ready`. They cannot be made editable from a plugin either,
 * because the shortcut system reserves the chords themselves: `bindingIssue()`
 * rejects plain Enter/Shift+Enter as `modifier-required` and Ctrl+Enter as
 * `reserved`, and `register()` throws on such a default. Enter semantics
 * actually live in the composer's Lexical keymap, not in the shortcut registry.
 *
 * So this plugin swaps the gestures at the DOM boundary and exposes the choice
 * on its own configuration page under Plugins → @gitsang/dsh-qol:
 *
 *   mode "swap" (default)  Enter -> newline, Ctrl/Cmd+Enter -> send
 *   mode "default"         every gesture behaves exactly as upstream
 *
 * In swap mode Ctrl/Cmd+Shift+Enter replays the upstream accelerated-send chord,
 * so queue/steer acceleration and the empty-draft "steer the queue" gesture keep
 * working now that their original chord means plain send.
 *
 * A capture listener on `window` sees the real keydown before the composer's own
 * listeners (Lexical binds on the contenteditable root in the bubble phase); it
 * swallows the gesture and re-dispatches the other one into the composer. The
 * composer then reacts exactly as if the user had pressed it, so submission
 * policy, busy-Enter behaviour, IME guarding and queue/steer delivery all keep
 * their upstream implementations.
 *
 * Enter is only swapped while the draft is a plain message (`data-phase="plain"`),
 * an open `/` or `@` menu still picks with Enter, and a draft that is a slash
 * command still submits on Enter — `ui-conversation`'s own rule for what is a
 * command (`draft.trimStart().startsWith('/')`) decides that, so a typed
 * `/compact` + Enter keeps running the command instead of breaking the line.
 */

window.__ModuleLoader__.load({
  id: '@gitsang/dsh-enter-swap',
  factory: (require) => {
    const React = require('react')
    const primitives = require('@deepseek-ai/dsh-client-ui-primitives')
    const { SegmentedControl, SettingsForm } = primitives
    const module = { exports: {} }
    const exports = module.exports

    const NS = 'enterSwap'
    const STORAGE_KEY = 'dsh.enterSwap.v1'
    /** `swap`: Enter newlines / Ctrl+Enter sends. `default`: untouched upstream. */
    const SWAP = 'swap'
    const UPSTREAM = 'default'
    const MODES = [SWAP, UPSTREAM]

    const zh = {
      title: '回车键行为',
      description:
        '默认对调：Enter 换行、Ctrl/Cmd+Enter 发送（Shift+Enter 依然换行）。选择“dsh 默认”则恢复 Enter 发送、Shift+Enter 换行。',
      summary: '选择输入框的回车键行为',
      swap: 'Enter 换行 / Ctrl+Enter 发送',
      default: 'dsh 默认：Enter 发送',
      save: '保存',
      saving: '保存中…',
      saveFailed: '保存失败，请重试。',
      readOnly: '当前部署的设置为只读。',
      unavailable: '该组件当前不可配置。',
    }
    const en = {
      title: 'Enter key behavior',
      description:
        'Swapped by default: Enter inserts a newline and Ctrl/Cmd+Enter sends (Shift+Enter still breaks the line). Choose “dsh default” to restore Enter-to-send.',
      summary: 'Choose the composer Enter-key behavior',
      swap: 'Enter newline / Ctrl+Enter sends',
      default: 'dsh default: Enter sends',
      save: 'Save',
      saving: 'Saving…',
      saveFailed: 'Could not save. Try again.',
      readOnly: 'This deployment stores settings read-only.',
      unavailable: 'This component cannot be configured right now.',
    }

    /** The composer's contenteditable root; Lexical binds `keydown` here. */
    const COMPOSER = '[data-composer-input]'
    /** The `/` and `@` trigger menus pick candidates with Enter while open. */
    const TRIGGER_MENU = '[data-trigger-menu]'
    /** Mirrors the primitives' `modalSelector`: dialogs and menus own Enter. */
    const MODAL = '[role="dialog"][aria-modal="true"], [role="menu"]'

    const CSS_ID = '@gitsang/dsh-enter-swap/EnterSwapConfig.css'
    const CSS = [
      '.dshEnterSwapField{display:flex;flex-direction:column;gap:6px;padding:12px 0}',
      '.dshEnterSwapLabel{font-size:13px;font-weight:500;line-height:1.5;color:var(--dsw-alias-label-primary)}',
      '.dshEnterSwapHint{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}',
    ].join('')
    if (
      typeof document !== 'undefined' &&
      document.querySelector('style[data-plugin-css=' + JSON.stringify(CSS_ID) + ']') === null
    ) {
      const tag = document.createElement('style')
      tag.dataset.plugin = '@gitsang/dsh-enter-swap'
      tag.dataset.pluginCss = CSS_ID
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    /* ---- preference store: process-local, persisted in this browser ---- */

    const listeners = new Set()

    /** @returns {string} the accepted mode, falling back to `swap`. */
    function readMode() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        return raw !== null && MODES.includes(raw) ? raw : SWAP
      } catch {
        return SWAP
      }
    }

    let mode = readMode()

    /**
     * Publish one accepted mode to this window's listeners.
     * @returns {void}
     */
    function publish() {
      for (const listener of [...listeners]) listener(mode)
    }

    /** @param {string} next - one of {@link MODES}. */
    function writeMode(next) {
      if (!MODES.includes(next) || next === mode) return
      mode = next
      try {
        window.localStorage.setItem(STORAGE_KEY, next)
      } catch {
        /* Private-mode writes may fail; the live value still applies. */
      }
      publish()
    }

    /**
     * Observe mode changes from this window and from other tabs.
     * @param {() => void} listener - invoked after every accepted change.
     * @returns {() => void} disposer.
     */
    function subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }

    /* ---- gear: the composer Enter swap ---- */

    /**
     * Whether the draft is a slash command rather than a message.
     *
     * `ui-conversation` already treats a draft starting with `/` as a command
     * for the primary button and the busy-Enter labels
     * (`draft.trimStart().startsWith('/')`), independent of the claim phase. Such
     * a draft must keep submitting on Enter, otherwise a typed command followed
     * by Enter would silently insert a newline instead of running.
     * @param {Element} root - composer contenteditable root.
     * @returns {boolean} whether this draft is command-shaped.
     */
    function isCommandDraft(root) {
      const text = root.textContent ?? ''
      return text.trimStart().startsWith('/')
    }

    /**
     * Whether this Enter may be intercepted at all.
     * @param {KeyboardEvent} event - real keydown from the window.
     * @returns {Element | null} the composer root, or null when the event is not ours.
     */
    function composerFor(event) {
      if (event.key !== 'Enter') return null
      /* IME: a composition-closing Enter must never be repurposed. */
      if (event.isComposing || event.keyCode === 229) return null
      if (event.altKey) return null
      if (typeof event.getModifierState === 'function' && event.getModifierState('AltGraph')) return null
      const target = event.target
      if (!(target instanceof Element)) return null
      const root = target.closest(COMPOSER)
      if (root === null) return null
      /* An open dialog or menu owns Enter; so does an open trigger menu. */
      if (document.querySelector(MODAL) !== null) return null
      if (document.querySelector(TRIGGER_MENU) !== null) return null
      return root
    }

    /**
     * Re-synthesise a composer Enter gesture on the Lexical root.
     * @param {Element} root - composer contenteditable root.
     * @param {{ shift?: boolean, accelerated?: boolean }} gesture - which upstream
     *   gesture to replay: plain Enter, Shift+Enter, or the Ctrl/Cmd+Enter chord
     *   the keymap reads as accelerated delivery.
     */
    function replay(root, gesture) {
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        location: 0,
        bubbles: true,
        cancelable: true,
        composed: true,
        shiftKey: gesture.shift === true,
        ctrlKey: gesture.accelerated === true,
      })
      root.dispatchEvent(event)
    }

    /* ---- Plugins row configuration page ---- */

    /**
     * The component's own configuration page on
     * Plugins → @gitsang/dsh-qol → @gitsang/dsh-enter-swap.
     * Like every other plugin configuration page, edits stay staged until Save.
     * @param {{ view?: string, t: (key: string) => string }} props - slot props.
     * @returns {import('react').ReactElement|string} the page or its one-liner.
     */
    function EnterSwapConfig({ view, t }) {
      const [current, setCurrent] = React.useState(mode)
      const [draft, setDraft] = React.useState(mode)
      React.useEffect(() => subscribe(() => {
        setCurrent(mode)
        setDraft(mode)
      }), [])

      if (view === 'summary') return t('summary')

      const dirty = draft !== current
      const save = () => {
        if (!dirty) return
        writeMode(draft)
        setCurrent(mode)
        setDraft(mode)
      }
      const shell = {
        available: true,
        writable: true,
        dirty,
        invalid: false,
        saving: false,
        failed: false,
      }

      return React.createElement(
        SettingsForm,
        {
          labels: {
            unavailable: t('unavailable'),
            readOnly: t('readOnly'),
            saveFailed: t('saveFailed'),
            save: t('save'),
            saving: t('saving'),
          },
          state: shell,
          onSave: save,
          onDiscard: () => setDraft(mode),
        },
        React.createElement(
          'div',
          { className: 'dshEnterSwapField', 'data-enter-swap-config': '' },
          React.createElement('span', { className: 'dshEnterSwapLabel' }, t('title')),
          React.createElement(SegmentedControl, {
            id: 'enter-swap-mode',
            value: draft,
            options: [
              { value: SWAP, label: t('swap') },
              { value: UPSTREAM, label: t('default') },
            ],
            onChange: setDraft,
            label: t('title'),
          }),
          React.createElement('p', { className: 'dshEnterSwapHint' }, t('description')),
        ),
      )
    }

    const inject = ['slots', 'locale']
    const ROW_KEY = '@gitsang/dsh-qol#enter-swap'

    /** @param {import('@deepseek-ai/cordis').Context} ctx - client plugin context. */
    function apply(ctx) {
      ctx.effect(
        () =>
          ctx.locale.register(NS, {
            zh,
            en,
          }),
        'enter-swap: dictionaries',
      )

      /* Another tab changing the preference must reach this window's handler. */
      ctx.effect(() => {
        const onStorage = (event) => {
          if (event.key !== null && event.key !== STORAGE_KEY) return
          const next = readMode()
          if (next === mode) return
          mode = next
          publish()
        }
        window.addEventListener('storage', onStorage)
        return () => window.removeEventListener('storage', onStorage)
      }, 'enter-swap: cross-tab preference')

      ctx.slots.inject('plugins.row.config', () =>
        ctx.slots.register(
          {
            name: 'plugins.row.config',
            key: ROW_KEY,
            locale: NS,
          },
          EnterSwapConfig,
        ),
      )

      /** Set while replaying, so the synthetic event cannot loop back here. */
      let replaying = false

      /**
       * Swallow one real gesture and replay its replacement.
       * @param {KeyboardEvent} event - real capture-phase keydown.
       * @param {Element} root - composer contenteditable root.
       * @param {{ shift?: boolean, accelerated?: boolean }} gesture - replacement.
       */
      function swap(event, root, gesture) {
        event.preventDefault()
        event.stopPropagation()
        replaying = true
        try {
          replay(root, gesture)
        } finally {
          replaying = false
        }
      }

      /**
       * Swap the two Enter gestures while the preference asks for it.
       * @param {KeyboardEvent} event - capture-phase keydown from the window.
       */
      function onKeyDown(event) {
        if (replaying || mode !== SWAP) return
        const root = composerFor(event)
        if (root === null) return
        /* A command claim or an in-flight submit keeps upstream Enter semantics. */
        if (root.getAttribute('data-phase') !== 'plain') return

        const primary = event.ctrlKey || event.metaKey

        /* Ctrl/Cmd+Shift+Enter keeps its upstream meaning: accelerated send. */
        if (primary && event.shiftKey) {
          swap(event, root, { accelerated: true })
          return
        }

        /* Shift+Enter already inserts a line break upstream; leave it alone. */
        if (event.shiftKey) return

        /* A command-shaped draft keeps Enter as "run the command". */
        if (!primary && isCommandDraft(root)) return

        /* Enter becomes a newline, even when the draft is still empty. */
        if (!primary) {
          swap(event, root, { shift: true })
          return
        }

        /* Ctrl/Cmd+Enter becomes the ordinary send gesture. */
        swap(event, root, {})
      }

      ctx.effect(() => {
        window.addEventListener('keydown', onKeyDown, true)
        return () => {
          window.removeEventListener('keydown', onKeyDown, true)
        }
      }, 'enter-swap: composer Enter gestures')
    }

    exports.apply = apply
    exports.inject = inject
    exports.__test = { EnterSwapConfig, ROW_KEY, SWAP, UPSTREAM, readMode, writeMode }
    return module.exports
  },
})

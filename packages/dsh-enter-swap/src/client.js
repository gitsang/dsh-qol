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
 * as an ordinary General-settings row, which is the part dsh does let a plugin
 * own:
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
      swap: 'Enter 换行 / Ctrl+Enter 发送',
      default: 'dsh 默认：Enter 发送',
    }
    const en = {
      title: 'Enter key behavior',
      description:
        'Swapped by default: Enter inserts a newline and Ctrl/Cmd+Enter sends (Shift+Enter still breaks the line). Choose “dsh default” to restore Enter-to-send.',
      swap: 'Enter newline / Ctrl+Enter sends',
      default: 'dsh default: Enter sends',
    }

    /** The composer's contenteditable root; Lexical binds `keydown` here. */
    const COMPOSER = '[data-composer-input]'
    /** The `/` and `@` trigger menus pick candidates with Enter while open. */
    const TRIGGER_MENU = '[data-trigger-menu]'
    /** Mirrors the primitives' `modalSelector`: dialogs and menus own Enter. */
    const MODAL = '[role="dialog"][aria-modal="true"], [role="menu"]'

    const CSS_ID = '@gitsang/dsh-enter-swap/EnterSwapRow.css'
    const CSS = [
      '.dshEnterSwapRow{border-bottom:.5px solid var(--dsw-alias-border-l2);align-items:center;gap:8px;padding:16px 0;display:flex}',
      '.dshEnterSwapText{flex-direction:column;flex:1;gap:4px;min-width:0;padding-right:48px;display:flex}',
      '.dshEnterSwapTitle{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px}',
      '.dshEnterSwapDesc{color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:400;line-height:18px}',
      '.dshEnterSwapSelect{border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-module-platform);height:36px;font:inherit;color:var(--dsw-alias-label-primary);cursor:pointer;border:none;padding:0 12px;font-size:14px;line-height:22px;max-width:320px}',
      '.dshEnterSwapSelect:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.dshEnterSwapSelect:focus-visible{outline:1px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}',
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

    /* ---- Settings row ---- */

    /**
     * General-settings row selecting the composer Enter behaviour.
     * @param {{ t: (key: string) => string }} props - slot-provided translator.
     * @returns {import('react').ReactElement} the preference row.
     */
    function EnterSwapRow({ t }) {
      const [value, setValue] = React.useState(mode)
      React.useEffect(() => subscribe(() => setValue(mode)), [])
      return React.createElement(
        'div',
        { className: 'dshEnterSwapRow', 'data-enter-swap-row': '' },
        React.createElement(
          'div',
          { className: 'dshEnterSwapText' },
          React.createElement('div', { className: 'dshEnterSwapTitle' }, t('title')),
          React.createElement('div', { className: 'dshEnterSwapDesc' }, t('description')),
        ),
        React.createElement(
          'select',
          {
            className: 'dshEnterSwapSelect',
            value,
            'aria-label': t('title'),
            onChange: (event) => writeMode(event.currentTarget.value),
          },
          React.createElement('option', { value: SWAP }, t('swap')),
          React.createElement('option', { value: UPSTREAM }, t('default')),
        ),
      )
    }

    const inject = ['slots', 'locale']

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

      ctx.slots.inject('settings.general.item', () =>
        ctx.slots.register(
          {
            name: 'settings.general.item',
            id: 'enter-swap',
            order: 22,
            locale: NS,
          },
          EnterSwapRow,
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
    return module.exports
  },
})

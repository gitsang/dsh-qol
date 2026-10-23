/**
 * Browser half of dsh-terminal-color.
 *
 * The sidebar terminal normally follows the DSH light/dark palette. This
 * component lets it use a fixed light or dark palette instead, or keep
 * following the global Appearance setting.
 *
 * The shipped terminal derives its xterm palette from the computed background
 * and text color of its screen element, and re-reads those values whenever the
 * DSH theme snapshot changes. This component layers two scoped CSS variables
 * over that screen only:
 *
 *   --dsh-terminal-color-background
 *   --dsh-terminal-color-foreground
 *
 * They are published through the public theme override layer, so selecting a
 * mode updates the scoped selectors and emits `theme/change`; the terminal's
 * own layout effect then re-reads the computed colors and updates xterm's
 * palette (cursor accent, selection and default cell colors). Nothing outside
 * `[data-sidebar-terminal]` reads these variables.
 */
window.__ModuleLoader__.load({
  id: '@gitsang/dsh-terminal-color',
  factory: (require) => {
    const React = require('react')
    const primitives = require('@deepseek-ai/dsh-client-ui-primitives')
    const module = { exports: {} }
    const exports = module.exports

    const NS = 'terminalColor'
    const STORAGE_KEY = '@gitsang/dsh-terminal-color/preference'
    const LEGACY_STORAGE_KEY = '@gitsang/dsh-terminal-color/palette'
    const THEME_SOURCE = '@gitsang/dsh-terminal-color'
    const BACKGROUND_VAR = '--dsh-terminal-color-background'
    const FOREGROUND_VAR = '--dsh-terminal-color-foreground'
    const REVISION_VAR = '--dsh-terminal-color-revision'

    const zh = {
      title: '终端主体色',
      hint: '仅影响右侧栏终端；选择“跟随外观”时继续使用 DSH 当前的浅色或深色主题。',
      summary: '选择右侧栏终端使用浅色、深色或跟随外观',
      'choice.light': '浅色',
      'choice.dark': '深色',
      'choice.system': '跟随外观',
      save: '保存',
    }

    const en = {
      title: 'Terminal colors',
      hint: 'Only affects the right Sidebar terminal. Follow appearance keeps using the current DSH light or dark theme.',
      summary: 'Choose a light, dark, or follow-appearance palette for the sidebar terminal',
      'choice.light': 'Light',
      'choice.dark': 'Dark',
      'choice.system': 'Follow appearance',
      save: 'Save',
    }

    const CHOICES = [
      { id: 'light', labelKey: 'choice.light', Icon: primitives.IconLightOutlineMedium },
      { id: 'dark', labelKey: 'choice.dark', Icon: primitives.IconDarkOutlineMedium },
      { id: 'system', labelKey: 'choice.system', Icon: primitives.IconFollowsystemOutlineMedium },
    ]

    // Fixed terminal palettes use DSH's own static neutral steps, so they stay
    // light/dark even while the other CSS tokens come from the opposite global
    // theme. These mirror the shipped terminal's computed light/dark defaults.
    const PALETTES = Object.freeze({
      light: Object.freeze({
        background: 'var(--dsw-static-neutral-bluish-00)',
        foreground: 'var(--dsw-static-neutral-bluish-1000)',
      }),
      dark: Object.freeze({
        background: 'var(--dsw-static-neutral-bluish-950)',
        foreground: 'var(--dsw-static-neutral-bluish-50)',
      }),
    })

    const PREFERENCES = Object.freeze(['light', 'dark', 'system'])

    const CSS_ID = '@gitsang/dsh-terminal-color/TerminalColor.css'
    const CSS = [
      // Scope the overrides to the sidebar terminal. The fallbacks keep the
      // shipped theme behavior for "Follow appearance" and before first paint.
      '[data-sidebar-terminal]>div:has(>.xterm){background-color:var(--dsh-terminal-color-background,var(--dsw-alias-bg-base))!important;color:var(--dsh-terminal-color-foreground,var(--dsw-alias-label-primary))!important}',
      '[data-sidebar-terminal] .xterm,[data-sidebar-terminal] .xterm-viewport,[data-sidebar-terminal] .xterm-scrollable-element{background-color:var(--dsh-terminal-color-background,var(--dsw-alias-bg-base))!important}',
      '[data-sidebar-terminal] .xterm-rows{color:var(--dsh-terminal-color-foreground,var(--dsw-alias-label-primary))!important}',
      '[data-sidebar-terminal] .xterm .xterm-rows .xterm-cursor.xterm-cursor-block:not(.xterm-cursor-blink){background-color:var(--terminal-cursor,var(--dsh-terminal-color-foreground))!important;color:var(--terminal-cursor-accent,var(--dsh-terminal-color-background))!important}',
      '[data-sidebar-terminal] .xterm .xterm-rows .xterm-cursor.xterm-cursor-block.xterm-cursor-blink{background-color:var(--terminal-cursor,var(--dsh-terminal-color-foreground))!important;color:var(--terminal-cursor-accent,var(--dsh-terminal-color-background))!important}',
      '[data-sidebar-terminal] .xterm .xterm-rows .xterm-cursor.xterm-cursor-outline{outline-color:var(--terminal-cursor,var(--dsh-terminal-color-foreground))!important}',
      '[data-sidebar-terminal] .xterm .xterm-rows .xterm-cursor.xterm-cursor-bar{box-shadow:inset 1px 0 0 var(--terminal-cursor,var(--dsh-terminal-color-foreground))!important}',
      '[data-sidebar-terminal] .xterm .xterm-rows .xterm-cursor.xterm-cursor-underline{border-bottom-color:var(--terminal-cursor,var(--dsh-terminal-color-foreground))!important}',
      // Configuration page: a field-for-field copy of the shipped Appearance row.
      '.dshTerminalColor_page{display:grid;gap:10px;max-width:520px}',
      '.dshTerminalColor_group{flex-direction:column;gap:8px;display:flex}',
      '.dshTerminalColor_title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:500;line-height:22px}',
      '.dshTerminalColor_cubeRow{flex-wrap:wrap;align-items:stretch;gap:8px;display:flex}',
      '.dshTerminalColor_cube{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-xl);font:inherit;color:var(--dsw-alias-label-primary);cursor:pointer;background:0 0;flex:180px;flex-direction:column;justify-content:center;align-items:center;gap:4px;padding:20px 32px;font-size:14px;line-height:22px;display:flex}',
      '.dshTerminalColor_cube:hover:not(.dshTerminalColor_selected){background:var(--dsw-alias-interactive-bg-hover)}',
      '.dshTerminalColor_selected{background:var(--dsw-alias-bg-module-platform);border-color:var(--dsw-static-neutral-bluish-400)}',
      '.dshTerminalColor_hint{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;margin:0}',
      '.dshTerminalColor_actions{display:flex;justify-content:flex-end}',
      '.dshTerminalColor_save{box-sizing:border-box;min-height:32px;border:none;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);cursor:pointer;padding:0 14px;font:inherit}',
      '.dshTerminalColor_save:disabled{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-tertiary);cursor:default}',
    ].join('')

    /**
     * Install the plugin-owned stylesheet and return its removal callback.
     * @returns {(() => void)|undefined} removal callback when a document exists.
     */
    function installStyles() {
      if (typeof document === 'undefined' || document.head === undefined) return undefined
      const tag = document.createElement('style')
      tag.dataset.plugin = '@gitsang/dsh-terminal-color'
      tag.dataset.pluginCss = CSS_ID
      tag.textContent = CSS
      document.head.appendChild(tag)
      return () => {
        tag.remove()
      }
    }

    /**
     * Normalize a persisted preference.
     * @param {unknown} value - candidate preference.
     * @returns {'light'|'dark'|'system'} a supported preference, defaulting to system.
     */
    function normalizePreference(value) {
      return PREFERENCES.includes(value) ? value : 'system'
    }

    /**
     * Build the scoped theme tokens for a fixed light/dark choice.
     * "Follow appearance" publishes no override layer at all, so every terminal
     * token continues to come from the active DSH theme.
     * @param {unknown} preference - light, dark, or system.
     * @param {number} revision - monotonic value that forces a theme/change event.
     * @returns {Record<string, {light: string, dark: string}>|undefined} override layer.
     */
    function buildThemeTokens(preference, revision) {
      const choice = normalizePreference(preference)
      if (choice === 'system') return undefined
      const palette = PALETTES[choice]
      return {
        [BACKGROUND_VAR]: { light: palette.background, dark: palette.background },
        [FOREGROUND_VAR]: { light: palette.foreground, dark: palette.foreground },
        [REVISION_VAR]: { light: String(revision), dark: String(revision) },
      }
    }

    /** @param {string} raw - localStorage value. @returns {'light'|'dark'|'system'} */
    function parseStoredPreference(raw) {
      return normalizePreference(raw)
    }

    /** @returns {'light'|'dark'|'system'} preference persisted in this browser. */
    function readStoredPreference() {
      try {
        return parseStoredPreference(globalThis.localStorage?.getItem(STORAGE_KEY))
      } catch {
        return 'system'
      }
    }

    /** @param {'light'|'dark'|'system'} preference - current preference. */
    function writeStoredPreference(preference) {
      try {
        const storage = globalThis.localStorage
        if (storage === undefined) return
        // The default needs no stored value. Also discard the earlier custom
        // color payload so an upgrade never resurrects an old color pick.
        storage.removeItem(LEGACY_STORAGE_KEY)
        if (preference === 'system') storage.removeItem(STORAGE_KEY)
        else storage.setItem(STORAGE_KEY, preference)
      } catch {
        // Private browsing or a full quota: the in-memory choice still works.
      }
    }

    let currentPreference = readStoredPreference()
    const listeners = new Set()
    let activeContext
    let themeLayerDisposer
    let revision = 0

    /** Notify the mounted configuration page; the terminal itself listens to theme/change. */
    function notify() {
      for (const listener of listeners) listener()
    }

    /**
     * Publish the selected fixed palette through the theme registry. Replacing
     * the same source restacks the layer and emits `theme/change`, which is
     * also the signal the shipped terminal uses to re-read its computed colors.
     * Removing the layer for "Follow appearance" emits the same signal.
     * @param {object} ctx - owning client context.
     * @param {'light'|'dark'|'system'} preference - selected preference.
     */
    function syncThemeLayer(ctx, preference) {
      if (typeof ctx?.theme?.overrideTokens !== 'function') return
      revision += 1
      const tokens = buildThemeTokens(preference, revision)
      if (tokens === undefined) {
        themeLayerDisposer?.()
        themeLayerDisposer = undefined
        return
      }
      themeLayerDisposer = ctx.theme.overrideTokens(THEME_SOURCE, tokens)
    }

    /**
     * Commit a preference, persist it, and emit both local and theme updates.
     * @param {unknown} next - proposed preference.
     */
    function commitPreference(next) {
      const normalized = normalizePreference(next)
      if (normalized === currentPreference) return
      currentPreference = normalized
      writeStoredPreference(currentPreference)
      if (activeContext !== undefined) syncThemeLayer(activeContext, currentPreference)
      notify()
    }

    /** @param {() => void} listener - row subscription. @returns {() => void} unsubscribe. */
    function subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }

    /**
     * The component's own configuration page on
     * Plugins → @gitsang/dsh-qol → @gitsang/dsh-terminal-color.
     * The palette choice is staged and applied only on Save.
     * @param {{ view?: string, t: (key: string) => string }} props - slot props.
     * @returns {import('react').ReactElement|string} the page or its one-liner.
     */
    function TerminalColorConfig({ view, t }) {
      const [current, setCurrent] = React.useState(currentPreference)
      const [draft, setDraft] = React.useState(currentPreference)
      React.useEffect(() => subscribe(() => {
        setCurrent(currentPreference)
        setDraft(currentPreference)
      }), [])

      if (view === 'summary') return t('summary')

      const dirty = draft !== current
      const save = () => {
        if (!dirty) return
        commitPreference(draft)
        setCurrent(currentPreference)
        setDraft(currentPreference)
      }

      return React.createElement(
        'div',
        { className: 'dshTerminalColor_page', 'data-terminal-color-config': '' },
        React.createElement(
          'div',
          { className: 'dshTerminalColor_group' },
          React.createElement('div', { className: 'dshTerminalColor_title' }, t('title')),
          React.createElement(
            'div',
            { className: 'dshTerminalColor_cubeRow' },
            CHOICES.map(({ id, labelKey, Icon }) =>
              React.createElement(
                'button',
                {
                  key: id,
                  type: 'button',
                  className: `dshTerminalColor_cube${draft === id ? ' dshTerminalColor_selected' : ''}`,
                  'aria-pressed': draft === id,
                  'data-terminal-color-choice': id,
                  onClick: () => setDraft(id),
                },
                React.createElement(Icon, {}),
                t(labelKey),
              ),
            ),
          ),
        ),
        React.createElement('p', { className: 'dshTerminalColor_hint' }, t('hint')),
        React.createElement(
          'div',
          { className: 'dshTerminalColor_actions' },
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'dshTerminalColor_save',
              disabled: !dirty,
              onClick: save,
            },
            t('save'),
          ),
        ),
      )
    }

    const inject = ['slots', 'locale', 'theme']
    const ROW_KEY = '@gitsang/dsh-qol#terminal-color'

    /**
     * Register the styles, locale dictionaries, theme layer, and the
     * component's Plugins row configuration page.
     * @param {object} ctx - client context.
     */
    function apply(ctx) {
      activeContext = ctx
      ctx.effect(
        () => {
          const removeStyles = installStyles()
          const onStorage = (event) => {
            if (event.key !== STORAGE_KEY) return
            currentPreference = parseStoredPreference(event.newValue)
            syncThemeLayer(ctx, currentPreference)
            notify()
          }
          globalThis.addEventListener?.('storage', onStorage)
          // Adopt a fixed palette loaded from storage immediately. "Follow
          // appearance" needs no layer and keeps the shipped theme behavior.
          if (currentPreference !== 'system') syncThemeLayer(ctx, currentPreference)
          return () => {
            globalThis.removeEventListener?.('storage', onStorage)
            removeStyles?.()
            themeLayerDisposer?.()
            themeLayerDisposer = undefined
            if (activeContext === ctx) activeContext = undefined
          }
        },
        'terminal-color: styles and storage',
      )
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'terminal-color: dictionaries')
      ctx.slots.inject('plugins.row.config', () =>
        ctx.slots.register(
          {
            name: 'plugins.row.config',
            key: ROW_KEY,
            locale: NS,
          },
          TerminalColorConfig,
        ),
      )
    }

    exports.apply = apply
    exports.inject = inject
    exports.__test = {
      buildThemeTokens,
      commitPreference,
      getPreference: () => currentPreference,
      normalizePreference,
      parseStoredPreference,
      PALETTES,
      PREFERENCES,
      ROW_KEY,
      TerminalColorConfig,
      CSS,
    }
    return module.exports
  },
})

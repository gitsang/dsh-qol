/**
 * Browser half of dsh-sidebar-terminal-enhance.
 *
 * One component owns the sidebar terminal's presentation: its xterm font
 * options, its light/dark/follow-appearance palette, and the configuration
 * page that edits both. The font half and the color half used to be separate
 * plugins; they share the terminal surface and now share one lifecycle.
 *
 * The shipped sidebar terminal builds its xterm emulator with a hard-coded
 * font stack and no configuration surface:
 *
 *   new Terminal({ fontSize: 13, fontFamily: 'ui-monospace, SFMono-Regular, ...' })
 *
 * xterm measures its cell grid from `options.fontFamily`/`fontSize`, so
 * restyling `.xterm-rows` with CSS would desynchronise columns from glyph
 * advances. Instead this component adopts the live emulator instance and
 * writes the user's choice onto its public options:
 *
 *   terminal.options.fontFamily
 *   terminal.options.fontSize
 *   terminal.options.lineHeight
 *
 * then re-runs the FitAddon and reports the new grid size to the Host PTY.
 *
 * The instance is reached through the React fiber attached to the screen
 * element the shipped `TerminalScreen` renders. That is the one supported
 * reach-in: xterm publishes no DOM handle, and the emulator lives in a ref
 * inside the shipped component. Every step is shape-checked and wrapped in
 * try/catch, so a future React/xterm change degrades to "no font override"
 * instead of breaking the terminal.
 *
 * The palette half layers two scoped CSS variables over the terminal screen
 * through the public theme override service. Nothing outside
 * `[data-sidebar-terminal]` reads them.
 */
window.__ModuleLoader__.load({
  id: '@gitsang/dsh-sidebar-terminal-enhance',
  factory: (require) => {
    const React = require('react')
    const primitives = require('@deepseek-ai/dsh-client-ui-primitives')
    const { SegmentedControl, SettingsForm, SettingsValueField } = primitives
    const module = { exports: {} }
    const exports = module.exports

    const NS = 'sidebarTerminalEnhance'
    const STORAGE_KEY = '@gitsang/dsh-sidebar-terminal-enhance/font'
    const COLOR_STORAGE_KEY = '@gitsang/dsh-terminal-color/preference'
    const LEGACY_COLOR_STORAGE_KEY = '@gitsang/dsh-terminal-color/palette'
    const THEME_SOURCE = '@gitsang/dsh-terminal-color'
    const BACKGROUND_VAR = '--dsh-terminal-color-background'
    const FOREGROUND_VAR = '--dsh-terminal-color-foreground'
    const REVISION_VAR = '--dsh-terminal-color-revision'
    const PLUGIN_ID = '@gitsang/dsh-sidebar-terminal-enhance'
    const CSS_ID = `${PLUGIN_ID}/SidebarTerminalEnhance.css`

    const SIZE_MIN = 8
    const SIZE_MAX = 32
    const LINE_HEIGHT_MIN = 0.9
    const LINE_HEIGHT_MAX = 2
    const PREVIEW_GLYPHS = '\ue0b0 \uf17c \uf015 \u276f \u2500\u2500'

    const zh = {
      fontSection: '字体',
      family: '字体族',
      familyPlaceholder: '例如 JetBrainsMono Nerd Font Mono',
      familyHint: '字体必须安装在浏览器所在的电脑上；族名不等于文件名。留空表示沿用 DSH 默认值。',
      size: '字号',
      sizeHint: '8–32 px 之间的整数。留空表示沿用 DSH 默认值。',
      lineHeight: '行高',
      lineHeightHint: '0.9–2 之间的倍数。留空表示沿用 DSH 默认值。',
      preview: '预览',
      previewAria: '字体预览',
      colorSection: '主体色',
      colorHint: '仅影响右侧栏终端；选择“跟随外观”时继续使用 DSH 当前的浅色或深色主题。',
      'choice.light': '浅色',
      'choice.dark': '深色',
      'choice.system': '跟随外观',
      summary: '设置右侧栏终端的字体与主体色',
      save: '保存',
      saving: '保存中…',
      saveFailed: '保存失败，请重试。',
      readOnly: '当前部署的设置为只读。',
      unavailable: '该组件当前不可配置。',
      overridden: '已覆盖',
      reset: '恢复默认',
      invalidSize: '字号应为 8–32 之间的整数。',
      invalidLineHeight: '行高应为 0.9–2 之间的数字。',
    }

    const en = {
      fontSection: 'Font',
      family: 'Font family',
      familyPlaceholder: 'e.g. JetBrainsMono Nerd Font Mono',
      familyHint: 'The font must be installed on the machine running the browser; the family name is not the file name. Leave empty to keep the DSH default.',
      size: 'Size',
      sizeHint: 'A whole number between 8 and 32 px. Leave empty to keep the DSH default.',
      lineHeight: 'Line height',
      lineHeightHint: 'A multiplier between 0.9 and 2. Leave empty to keep the DSH default.',
      preview: 'Preview',
      previewAria: 'Font preview',
      colorSection: 'Palette',
      colorHint: 'Only affects the right Sidebar terminal. Follow appearance keeps using the current DSH light or dark theme.',
      'choice.light': 'Light',
      'choice.dark': 'Dark',
      'choice.system': 'Follow appearance',
      summary: 'Set the sidebar terminal’s font and palette',
      save: 'Save',
      saving: 'Saving…',
      saveFailed: 'Could not save. Try again.',
      readOnly: 'This deployment stores settings read-only.',
      unavailable: 'This component cannot be configured right now.',
      overridden: 'Overridden',
      reset: 'Reset to default',
      invalidSize: 'Font size must be a whole number between 8 and 32.',
      invalidLineHeight: 'Line height must be a number between 0.9 and 2.',
    }

    const CSS = [
      // Scope the palette overrides to the sidebar terminal. The fallbacks keep
      // the shipped theme behavior for "Follow appearance" and before first paint.
      '[data-sidebar-terminal]>div:has(>.xterm){background-color:var(--dsh-terminal-color-background,var(--dsw-alias-bg-base))!important;color:var(--dsh-terminal-color-foreground,var(--dsw-alias-label-primary))!important}',
      '[data-sidebar-terminal] .xterm,[data-sidebar-terminal] .xterm-viewport,[data-sidebar-terminal] .xterm-scrollable-element{background-color:var(--dsh-terminal-color-background,var(--dsw-alias-bg-base))!important}',
      '[data-sidebar-terminal] .xterm-rows{color:var(--dsh-terminal-color-foreground,var(--dsw-alias-label-primary))!important}',
      '[data-sidebar-terminal] .xterm .xterm-rows .xterm-cursor.xterm-cursor-block:not(.xterm-cursor-blink){background-color:var(--terminal-cursor,var(--dsh-terminal-color-foreground))!important;color:var(--terminal-cursor-accent,var(--dsh-terminal-color-background))!important}',
      '[data-sidebar-terminal] .xterm .xterm-rows .xterm-cursor.xterm-cursor-block.xterm-cursor-blink{background-color:var(--terminal-cursor,var(--dsh-terminal-color-foreground))!important;color:var(--terminal-cursor-accent,var(--dsh-terminal-color-background))!important}',
      '[data-sidebar-terminal] .xterm .xterm-rows .xterm-cursor.xterm-cursor-outline{outline-color:var(--terminal-cursor,var(--dsh-terminal-color-foreground))!important}',
      '[data-sidebar-terminal] .xterm .xterm-rows .xterm-cursor.xterm-cursor-bar{box-shadow:inset 1px 0 0 var(--terminal-cursor,var(--dsh-terminal-color-foreground))!important}',
      '[data-sidebar-terminal] .xterm .xterm-rows .xterm-cursor.xterm-cursor-underline{border-bottom-color:var(--terminal-cursor,var(--dsh-terminal-color-foreground))!important}',
      // The page uses the same field rhythm and type scale as the shipped
      // plugin configuration forms.
      '.dshTerminalFont_section{display:flex;flex-direction:column;gap:2px;padding:2px 0 10px}',
      '.dshTerminalFont_section+.dshTerminalFont_section{border-top:.5px solid var(--dsw-alias-border-l2);padding-top:16px}',
      '.dshTerminalFont_heading{margin:0;font-size:13px;font-weight:600;line-height:1.5;color:var(--dsw-alias-label-primary)}',
      '.dshTerminalFont_field{display:flex;flex-direction:column;gap:6px;padding:12px 0}',
      '.dshTerminalFont_field+.dshTerminalFont_field{border-top:.5px solid var(--dsw-alias-border-l2)}',
      '.dshTerminalFont_label{font-size:13px;font-weight:500;line-height:1.5;color:var(--dsw-alias-label-primary)}',
      '.dshTerminalFont_hint{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}',
      '.dshTerminalFont_preview{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);overflow:auto;white-space:pre;padding:8px 12px;font-size:13px;line-height:1.5}',
      '.dshTerminalFont_error{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-state-error-primary)}',
    ].join('')

    /** Install the plugin-owned stylesheet and return its removal callback. */
    function installStyles() {
      if (typeof document === 'undefined' || document.head === undefined) return undefined
      const tag = document.createElement('style')
      tag.dataset.plugin = PLUGIN_ID
      tag.dataset.pluginCss = CSS_ID
      tag.textContent = CSS
      document.head.appendChild(tag)
      return () => {
        tag.remove()
      }
    }

    /** @param {unknown} value - candidate font size. @returns {number|undefined} clamped integer size. */
    function normalizeSize(value) {
      const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
      if (typeof number !== 'number' || !Number.isFinite(number)) return undefined
      const rounded = Math.round(number)
      if (rounded < SIZE_MIN || rounded > SIZE_MAX) return undefined
      return rounded
    }

    /** @param {unknown} value - candidate line height multiplier. @returns {number|undefined} clamped multiplier. */
    function normalizeLineHeight(value) {
      const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
      if (typeof number !== 'number' || !Number.isFinite(number)) return undefined
      const clamped = Math.round(number * 100) / 100
      if (clamped < LINE_HEIGHT_MIN || clamped > LINE_HEIGHT_MAX) return undefined
      return clamped
    }

    /**
     * Trim a CSS font-family list, dropping control characters and stray
     * separators that would produce an unusable declaration.
     * @param {unknown} value - candidate family or stack.
     * @returns {string|undefined} usable family list.
     */
    function normalizeFamily(value) {
      if (typeof value !== 'string') return undefined
      const cleaned = value
        .replace(/[\u0000-\u001f\u007f]/gu, ' ')
        .replace(/\s+/gu, ' ')
        .replace(/^[,\s]+|[,\s]+$/gu, '')
        .trim()
      return cleaned === '' ? undefined : cleaned
    }

    /** @param {unknown} value - parsed storage value. @returns {{family?:string,size?:number,lineHeight?:number}} settings. */
    function normalizeSettings(value) {
      const source = value !== null && typeof value === 'object' ? value : {}
      const settings = {}
      const family = normalizeFamily(source.family)
      const size = normalizeSize(source.size)
      const lineHeight = normalizeLineHeight(source.lineHeight)
      if (family !== undefined) settings.family = family
      if (size !== undefined) settings.size = size
      if (lineHeight !== undefined) settings.lineHeight = lineHeight
      return Object.freeze(settings)
    }

    /** @param {string} raw - localStorage value. @returns {{family?:string,size?:number,lineHeight?:number}} settings. */
    function parseStoredSettings(raw) {
      if (typeof raw !== 'string' || raw === '') return normalizeSettings(undefined)
      try {
        return normalizeSettings(JSON.parse(raw))
      } catch {
        return normalizeSettings(undefined)
      }
    }

    /** @returns {{family?:string,size?:number,lineHeight?:number}} settings persisted in this browser. */
    function readStoredSettings() {
      try {
        return parseStoredSettings(globalThis.localStorage?.getItem(STORAGE_KEY))
      } catch {
        return normalizeSettings(undefined)
      }
    }

    /** @param {{family?:string,size?:number,lineHeight?:number}} settings - current settings. */
    function writeStoredSettings(settings) {
      try {
        const storage = globalThis.localStorage
        if (storage === undefined) return
        if (Object.keys(settings).length === 0) storage.removeItem(STORAGE_KEY)
        else storage.setItem(STORAGE_KEY, JSON.stringify(settings))
      } catch {
        // Private browsing or a full quota: the in-memory settings still work.
      }
    }

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

    /**
     * Normalize a persisted palette preference.
     * @param {unknown} value - candidate preference.
     * @returns {'light'|'dark'|'system'} a supported preference, defaulting to system.
     */
    function normalizePreference(value) {
      return PREFERENCES.includes(value) ? value : 'system'
    }

    /**
     * Build the scoped theme tokens for a fixed light/dark choice.
     * "Follow appearance" publishes no override layer at all.
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

    /** @param {unknown} raw - localStorage value. @returns {'light'|'dark'|'system'} */
    function parseStoredPreference(raw) {
      return normalizePreference(raw)
    }

    /** @returns {'light'|'dark'|'system'} palette preference persisted in this browser. */
    function readStoredPreference() {
      try {
        return parseStoredPreference(globalThis.localStorage?.getItem(COLOR_STORAGE_KEY))
      } catch {
        return 'system'
      }
    }

    /** @param {'light'|'dark'|'system'} preference - current preference. */
    function writeStoredPreference(preference) {
      try {
        const storage = globalThis.localStorage
        if (storage === undefined) return
        storage.removeItem(LEGACY_COLOR_STORAGE_KEY)
        if (preference === 'system') storage.removeItem(COLOR_STORAGE_KEY)
        else storage.setItem(COLOR_STORAGE_KEY, preference)
      } catch {
        // Private browsing or a full quota: the in-memory choice still works.
      }
    }

    /** Shipped terminal defaults, used only when the live emulator cannot be read. */
    const FALLBACK_OPTIONS = Object.freeze({
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      fontSize: 13,
      lineHeight: 1,
    })

    /** Options captured from each emulator before this plugin first touched it. */
    const originals = new WeakMap()

    /** @param {any} terminal - candidate emulator. @returns {boolean} whether it looks like an xterm Terminal. */
    function isTerminalLike(terminal) {
      return (
        terminal !== null &&
        typeof terminal === 'object' &&
        terminal.options !== null &&
        typeof terminal.options === 'object' &&
        typeof terminal.options.fontFamily === 'string' &&
        typeof terminal.resize === 'function' &&
        typeof terminal.refresh === 'function' &&
        terminal._core !== null &&
        typeof terminal._core === 'object'
      )
    }

    /** @param {any} candidate - candidate addon. @returns {boolean} whether it looks like FitAddon. */
    function isFitLike(candidate) {
      return (
        candidate !== null &&
        typeof candidate === 'object' &&
        typeof candidate.proposeDimensions === 'function' &&
        typeof candidate.fit === 'function'
      )
    }

    /**
     * Walk the React fiber lane above a host node and collect ref values.
     * @param {any} node - DOM node carrying `__reactFiber$…`.
     * @returns {Array<{terminals: any[], fits: any[], models: any[]}>} per-fiber findings.
     */
    function inspectFiberLane(node) {
      const key = node === null || typeof node !== 'object' ? undefined : Object.keys(node).find((name) => name.startsWith('__reactFiber$'))
      if (key === undefined) return []
      const findings = []
      let fiber = node[key]
      for (let depth = 0; fiber !== null && fiber !== undefined && depth < 40; depth += 1) {
        const terminals = []
        const fits = []
        const models = []
        let hook = fiber.memoizedState
        for (let index = 0; hook !== null && hook !== undefined && index < 60; index += 1) {
          const value = hook.memoizedState
          const current = value !== null && typeof value === 'object' && 'current' in value ? value.current : value
          if (isTerminalLike(current)) terminals.push(current)
          else if (isFitLike(current)) fits.push(current)
          hook = hook.next
        }
        const model = fiber.memoizedProps?.model
        if (model !== null && typeof model === 'object' && typeof model.resize === 'function') models.push(model)
        if (terminals.length > 0) findings.push({ terminals, fits, models })
        fiber = fiber.return
      }
      return findings
    }

    /**
     * Resolve the live emulator, its FitAddon and its terminal model from the
     * `.screen` element the shipped TerminalScreen renders.
     * @param {any} screen - `[data-sidebar-terminal]` screen element.
     * @returns {{terminal:any, fit:any, model:any}|undefined} adoption target.
     */
    function findTerminal(screen) {
      for (const lane of inspectFiberLane(screen)) {
        const terminal = lane.terminals[0]
        return {
          terminal,
          fit: lane.fits.find((candidate) => candidate._terminal === terminal) ?? lane.fits[0],
          model: lane.models[0],
        }
      }
      return undefined
    }

    /** @param {any} terminal - emulator. @returns {{fontFamily:string,fontSize:number,lineHeight:number}} captured originals. */
    function originalOptions(terminal) {
      let captured = originals.get(terminal)
      if (captured === undefined) {
        captured = {
          fontFamily: terminal.options.fontFamily,
          fontSize: terminal.options.fontSize,
          lineHeight: terminal.options.lineHeight,
        }
        originals.set(terminal, captured)
      }
      return captured
    }

    /**
     * Write the requested options onto one emulator. An absent field restores
     * the value captured from the shipped terminal before the first override.
     * @param {any} terminal - emulator.
     * @param {{family?:string,size?:number,lineHeight?:number}} settings - requested settings.
     * @returns {boolean} whether any option changed.
     */
    function applyFont(terminal, settings) {
      if (!isTerminalLike(terminal)) return false
      const original = originalOptions(terminal)
      const family = settings.family ?? original.fontFamily ?? FALLBACK_OPTIONS.fontFamily
      const size = settings.size ?? original.fontSize ?? FALLBACK_OPTIONS.fontSize
      const lineHeight = settings.lineHeight ?? original.lineHeight ?? FALLBACK_OPTIONS.lineHeight
      let changed = false
      if (terminal.options.fontFamily !== family) {
        terminal.options.fontFamily = family
        changed = true
      }
      if (terminal.options.fontSize !== size) {
        terminal.options.fontSize = size
        changed = true
      }
      if (terminal.options.lineHeight !== lineHeight) {
        terminal.options.lineHeight = lineHeight
        changed = true
      }
      return changed
    }

    /**
     * Re-measure the cell grid and tell the Host PTY the new dimensions, the
     * same sequence the shipped body uses after a viewport resize.
     * @param {{terminal:any, fit:any, model:any}} target - adoption target.
     * @returns {{cols:number, rows:number}|undefined} applied grid size.
     */
    function refit(target) {
      const { terminal, fit, model } = target
      let dimensions
      try {
        dimensions = fit?.proposeDimensions?.()
      } catch {
        dimensions = undefined
      }
      try {
        fit?.fit?.()
      } catch {
        // A disposed or not-yet-opened emulator: the observer will retry.
      }
      if (dimensions === undefined || dimensions === null) return undefined
      let environment
      try {
        environment = model?.state?.getSnapshot?.().environment
      } catch {
        environment = undefined
      }
      const cols = Math.min(dimensions.cols, environment?.maxCols ?? dimensions.cols)
      const rows = Math.min(dimensions.rows, environment?.maxRows ?? dimensions.rows)
      if (cols < 2 || rows < 1) return undefined
      const state = (() => {
        try {
          return model?.state?.getSnapshot?.()
        } catch {
          return undefined
        }
      })()
      const writable = state?.writable !== false
      if (model !== undefined && writable && (terminal.cols !== cols || terminal.rows !== rows || state?.info?.cols !== cols || state?.info?.rows !== rows)) {
        try {
          model.resize(cols, rows)
        } catch {
          // The Host may have closed the process; the local grid still fits.
        }
      }
      return { cols, rows }
    }

    /**
     * Adopt every mounted sidebar terminal in the document.
     * @param {{family?:string,size?:number,lineHeight?:number}} settings - requested settings.
     * @returns {number} number of emulators found.
     */
    function adoptMountedTerminals(settings) {
      if (typeof document === 'undefined') return 0
      let found = 0
      for (const xterm of document.querySelectorAll('[data-sidebar-terminal] .xterm')) {
        const screen = xterm.parentElement
        if (screen === null || screen === undefined) continue
        let target
        try {
          target = findTerminal(screen)
        } catch {
          target = undefined
        }
        if (target === undefined) continue
        found += 1
        try {
          applyFont(target.terminal, settings)
          refit(target)
        } catch {
          // Never let one broken emulator break the configuration page.
        }
      }
      return found
    }

    /** Raw storage value last observed, so an external write can be detected. */
    function readRawSettings() {
      try {
        return globalThis.localStorage?.getItem(STORAGE_KEY) ?? null
      } catch {
        return null
      }
    }

    let currentSettings = readStoredSettings()
    let lastRawSettings = readRawSettings()
    let currentPreference = readStoredPreference()
    let lastRawPreference = readRawPreference()
    let activeContext
    let themeLayerDisposer
    let revision = 0
    const listeners = new Set()

    /** Raw palette value last observed, so an external write can be detected. */
    function readRawPreference() {
      try {
        return globalThis.localStorage?.getItem(COLOR_STORAGE_KEY) ?? null
      } catch {
        return null
      }
    }

    /** Notify the mounted configuration page and re-adopt live terminals. */
    function notify() {
      for (const listener of listeners) listener()
      adoptMountedTerminals(currentSettings)
    }

    /**
     * Publish the selected fixed palette through the theme registry. Replacing
     * the same source restacks the layer and emits `theme/change`, which is
     * also the signal the shipped terminal uses to re-read its computed colors.
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
     * Pick up a font value written outside this module.
     * @returns {boolean} whether the font settings changed.
     */
    function refreshFromStorage() {
      const raw = readRawSettings()
      if (raw === lastRawSettings) return false
      lastRawSettings = raw
      currentSettings = parseStoredSettings(raw ?? '')
      notify()
      return true
    }

    /**
     * Pick up a palette value written outside this module.
     * @returns {boolean} whether the preference changed.
     */
    function refreshPreferenceFromStorage() {
      const raw = readRawPreference()
      if (raw === lastRawPreference) return false
      lastRawPreference = raw
      currentPreference = parseStoredPreference(raw)
      if (activeContext !== undefined) syncThemeLayer(activeContext, currentPreference)
      notify()
      return true
    }

    /**
     * Watch the document for terminal mounts and other mutations that can
     * introduce a new emulator, then adopt it.
     * @param {() => void} onChange - rescan callback.
     * @returns {() => void} observer disposer.
     */
    function observeTerminals(onChange) {
      if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return () => {}
      let scheduled = false
      const schedule = () => {
        if (scheduled) return
        scheduled = true
        const run = () => {
          scheduled = false
          onChange()
        }
        if (typeof globalThis.requestAnimationFrame === 'function') globalThis.requestAnimationFrame(run)
        else globalThis.setTimeout(run, 16)
      }
      const observer = new MutationObserver(schedule)
      observer.observe(document.documentElement ?? document.body, { childList: true, subtree: true })
      return () => {
        observer.disconnect()
      }
    }

    /** @param {() => void} listener - page subscription. @returns {() => void} unsubscribe. */
    function subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }

    /**
     * Commit font settings, persist them, and apply them to live terminals.
     * @param {{family?:string,size?:number,lineHeight?:number}} next - proposed settings.
     */
    function commitSettings(next) {
      const normalized = normalizeSettings(next)
      if (
        normalized.family === currentSettings.family &&
        normalized.size === currentSettings.size &&
        normalized.lineHeight === currentSettings.lineHeight
      ) {
        return
      }
      currentSettings = normalized
      writeStoredSettings(currentSettings)
      lastRawSettings = readRawSettings()
      notify()
    }

    /**
     * Commit a palette preference, persist it, and publish the theme layer.
     * @param {unknown} next - proposed preference.
     */
    function commitPreference(next) {
      const normalized = normalizePreference(next)
      if (normalized === currentPreference) return
      currentPreference = normalized
      writeStoredPreference(currentPreference)
      lastRawPreference = readRawPreference()
      if (activeContext !== undefined) syncThemeLayer(activeContext, currentPreference)
      notify()
    }

    /** @param {string} value - family list typed into the form. */
    function setFamily(value) {
      const family = normalizeFamily(value)
      commitSettings({ ...currentSettings, family })
    }

    /** @param {unknown} value - size typed into the form. */
    function setSize(value) {
      const size = normalizeSize(value)
      if (size === undefined) return
      commitSettings({ ...currentSettings, size })
    }

    /** @param {unknown} value - line height typed into the form. */
    function setLineHeight(value) {
      const lineHeight = normalizeLineHeight(value)
      if (lineHeight === undefined) return
      commitSettings({ ...currentSettings, lineHeight })
    }

    function resetSettings() {
      commitSettings({})
    }

    /** @param {{family?:string,size?:number,lineHeight?:number}} settings - committed settings. */
    function draftOf(settings) {
      return {
        family: settings.family ?? '',
        size: settings.size === undefined ? '' : String(settings.size),
        lineHeight: settings.lineHeight === undefined ? '' : String(settings.lineHeight),
      }
    }

    /**
     * Validate and normalize the raw font form draft.
     * @param {{family:string,size:string,lineHeight:string}} draft - staged values.
     * @returns {{settings:{family?:string,size?:number,lineHeight?:number},sizeInvalid:boolean,lineHeightInvalid:boolean}} result.
     */
    function normalizeDraft(draft) {
      const family = normalizeFamily(draft.family)
      const sizeText = typeof draft.size === 'string' ? draft.size.trim() : ''
      const lineHeightText = typeof draft.lineHeight === 'string' ? draft.lineHeight.trim() : ''
      const size = sizeText === '' ? undefined : normalizeSize(sizeText)
      const lineHeight = lineHeightText === '' ? undefined : normalizeLineHeight(lineHeightText)
      return {
        settings: normalizeSettings({ family, size, lineHeight }),
        sizeInvalid: sizeText !== '' && size === undefined,
        lineHeightInvalid: lineHeightText !== '' && lineHeight === undefined,
      }
    }

    /** The complete staged value of the configuration page. */
    function pageDraft() {
      return { ...draftOf(currentSettings), preference: currentPreference }
    }

    /**
     * The component's own configuration page on
     * Plugins → @gitsang/dsh-qol → @gitsang/dsh-sidebar-terminal-enhance.
     * The live font preview follows the staged values; nothing is saved until
     * the shared form's Save control is used.
     * @param {{ view?: string, t: (key: string) => string }} props - slot props.
     * @returns {import('react').ReactElement|string} the page or its one-liner.
     */
    function SidebarTerminalEnhanceConfig({ view, t }) {
      const [current, setCurrent] = React.useState(pageDraft)
      const [draft, setDraft] = React.useState(pageDraft)
      const [sizeInvalid, setSizeInvalid] = React.useState(false)
      const [lineHeightInvalid, setLineHeightInvalid] = React.useState(false)
      React.useEffect(() => subscribe(() => {
        const next = pageDraft()
        setCurrent(next)
        setDraft(next)
        setSizeInvalid(false)
        setLineHeightInvalid(false)
      }), [])

      if (view === 'summary') return t('summary')

      const dirty = draft.family !== current.family
        || draft.size !== current.size
        || draft.lineHeight !== current.lineHeight
        || draft.preference !== current.preference
      const parsed = normalizeDraft(draft)
      const invalid = sizeInvalid || lineHeightInvalid
      const previewFont = normalizeFamily(draft.family) ?? FALLBACK_OPTIONS.fontFamily
      const update = (field, value) => {
        setDraft((previous) => ({ ...previous, [field]: value }))
        if (field === 'size') setSizeInvalid(false)
        if (field === 'lineHeight') setLineHeightInvalid(false)
      }
      const save = () => {
        if (!dirty) return
        if (parsed.sizeInvalid) {
          setSizeInvalid(true)
          return
        }
        if (parsed.lineHeightInvalid) {
          setLineHeightInvalid(true)
          return
        }
        commitSettings(parsed.settings)
        commitPreference(draft.preference)
        const committed = pageDraft()
        setCurrent(committed)
        setDraft(committed)
      }
      const shell = {
        available: true,
        writable: true,
        dirty,
        invalid,
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
          onDiscard: () => setDraft(current),
        },
        React.createElement(
          'section',
          { className: 'dshTerminalFont_section', 'data-sidebar-terminal-enhance-config': true },
          React.createElement('h3', { className: 'dshTerminalFont_heading' }, t('fontSection')),
          React.createElement(SettingsValueField, {
            id: 'terminal-font-family',
            label: t('family'),
            hint: t('familyHint'),
            text: draft.family,
            overridden: draft.family !== '',
            overriddenLabel: t('overridden'),
            resetLabel: t('reset'),
            invalid: false,
            invalidLabel: t('invalidSize'),
            disabled: false,
            placeholder: t('familyPlaceholder'),
            onEdit: (value) => update('family', value),
            onReset: () => update('family', ''),
          }),
          React.createElement(SettingsValueField, {
            id: 'terminal-font-size',
            label: t('size'),
            hint: t('sizeHint'),
            text: draft.size,
            overridden: draft.size !== '',
            overriddenLabel: t('overridden'),
            resetLabel: t('reset'),
            invalid: sizeInvalid,
            invalidLabel: t('invalidSize'),
            disabled: false,
            numeric: true,
            placeholder: String(FALLBACK_OPTIONS.fontSize),
            onEdit: (value) => update('size', value),
            onReset: () => update('size', ''),
          }),
          React.createElement(SettingsValueField, {
            id: 'terminal-font-line-height',
            label: t('lineHeight'),
            hint: t('lineHeightHint'),
            text: draft.lineHeight,
            overridden: draft.lineHeight !== '',
            overriddenLabel: t('overridden'),
            resetLabel: t('reset'),
            invalid: lineHeightInvalid,
            invalidLabel: t('invalidLineHeight'),
            disabled: false,
            numeric: true,
            placeholder: String(FALLBACK_OPTIONS.lineHeight),
            onEdit: (value) => update('lineHeight', value),
            onReset: () => update('lineHeight', ''),
          }),
          React.createElement(
            'div',
            { className: 'dshTerminalFont_field' },
            React.createElement('span', { className: 'dshTerminalFont_label' }, t('preview')),
            React.createElement('div', {
              className: 'dshTerminalFont_preview',
              'aria-label': t('previewAria'),
              style: { fontFamily: previewFont },
            }, PREVIEW_GLYPHS),
          ),
        ),
        React.createElement(
          'section',
          { className: 'dshTerminalFont_section' },
          React.createElement('h3', { className: 'dshTerminalFont_heading' }, t('colorSection')),
          React.createElement(
            'div',
            { className: 'dshTerminalFont_field' },
            React.createElement(SegmentedControl, {
              id: 'terminal-color-preference',
              value: draft.preference,
              options: PREFERENCES.map((id) => ({ value: id, label: t(`choice.${id}`) })),
              onChange: (value) => update('preference', value),
              label: t('colorSection'),
            }),
            React.createElement('p', { className: 'dshTerminalFont_hint' }, t('colorHint')),
          ),
        ),
      )
    }

    const inject = ['slots', 'locale', 'theme']
    const ROW_KEY = '@gitsang/dsh-qol#sidebar-terminal-enhance'

    /**
     * Register the stylesheet, dictionaries, storage sync, terminal adoption,
     * palette layer and the component's Plugins row configuration page.
     * @param {object} ctx - client context.
     */
    function apply(ctx) {
      activeContext = ctx
      ctx.effect(
        () => {
          const removeStyles = installStyles()
          const onStorage = (event) => {
            if (event.key === STORAGE_KEY) refreshFromStorage()
            if (event.key === COLOR_STORAGE_KEY) refreshPreferenceFromStorage()
          }
          globalThis.addEventListener?.('storage', onStorage)
          if (currentPreference !== 'system') syncThemeLayer(ctx, currentPreference)
          const stopObserving = observeTerminals(() => {
            refreshFromStorage()
            refreshPreferenceFromStorage()
            adoptMountedTerminals(currentSettings)
          })
          adoptMountedTerminals(currentSettings)
          return () => {
            globalThis.removeEventListener?.('storage', onStorage)
            stopObserving()
            removeStyles?.()
            themeLayerDisposer?.()
            themeLayerDisposer = undefined
            if (activeContext === ctx) activeContext = undefined
          }
        },
        'sidebar-terminal-enhance: styles, palette and adoption',
      )
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'sidebar-terminal-enhance: dictionaries')
      ctx.slots.inject('plugins.row.config', () =>
        ctx.slots.register(
          {
            name: 'plugins.row.config',
            key: ROW_KEY,
            locale: NS,
          },
          SidebarTerminalEnhanceConfig,
        ),
      )
    }

    exports.apply = apply
    exports.inject = inject
    exports.__test = {
      applyFont,
      adoptMountedTerminals,
      buildThemeTokens,
      commitPreference,
      commitSettings,
      findTerminal,
      getPreference: () => currentPreference,
      getSettings: () => currentSettings,
      inspectFiberLane,
      isFitLike,
      isTerminalLike,
      normalizeFamily,
      normalizeLineHeight,
      normalizeDraft,
      normalizePreference,
      normalizeSettings,
      normalizeSize,
      originalOptions,
      parseStoredPreference,
      parseStoredSettings,
      PALETTES,
      PREFERENCES,
      readRawSettings,
      refreshFromStorage,
      refreshPreferenceFromStorage,
      refit,
      resetSettings,
      setFamily,
      setLineHeight,
      setSize,
      subscribe,
      SidebarTerminalEnhanceConfig,
      CSS,
      COLOR_STORAGE_KEY,
      PREVIEW_GLYPHS,
      ROW_KEY,
      STORAGE_KEY,
      THEME_SOURCE,
    }
    return module.exports
  },
})

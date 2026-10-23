/**
 * Browser half of dsh-sidebar-terminal-enhance.
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
 */
window.__ModuleLoader__.load({
  id: '@gitsang/dsh-sidebar-terminal-enhance',
  factory: (require) => {
    const React = require('react')
    const module = { exports: {} }
    const exports = module.exports

    const NS = 'sidebarTerminalEnhance'
    const STORAGE_KEY = '@gitsang/dsh-sidebar-terminal-enhance/font'
    const PLUGIN_ID = '@gitsang/dsh-sidebar-terminal-enhance'
    const CSS_ID = `${PLUGIN_ID}/SidebarTerminalEnhance.css`

    const SIZE_MIN = 8
    const SIZE_MAX = 32
    const LINE_HEIGHT_MIN = 0.9
    const LINE_HEIGHT_MAX = 2
    const PREVIEW_GLYPHS = '\ue0b0 \uf17c \uf015 \u276f \u2500\u2500'

    const zh = {
      title: '终端字体',
      description: '设置右侧栏终端使用的字体族、字号与行高；图标缺失时填 Nerd Font 的族名。',
      family: '字体族',
      familyPlaceholder: '例如 JetBrainsMono Nerd Font Mono',
      familyAria: '终端字体族',
      size: '字号',
      sizeAria: '终端字号',
      lineHeight: '行高',
      lineHeightAria: '终端行高',
      reset: '恢复默认',
      preview: '预览',
      previewAria: '字体预览',
      hint: '字体必须安装在浏览器所在的电脑上；族名不等于文件名。留空表示沿用 DSH 默认值。',
      summary: '设置右侧栏终端的字体族、字号与行高',
      save: '保存',
      invalidSize: '字号应为 8–32 之间的整数。',
      invalidLineHeight: '行高应为 0.9–2 之间的数字。',
    }

    const en = {
      title: 'Terminal font',
      description: 'Set the right Sidebar terminal’s font family, size and line height. Use the Nerd Font family name when glyphs are missing.',
      family: 'Font family',
      familyPlaceholder: 'e.g. JetBrainsMono Nerd Font Mono',
      familyAria: 'Terminal font family',
      size: 'Size',
      sizeAria: 'Terminal font size',
      lineHeight: 'Line height',
      lineHeightAria: 'Terminal line height',
      reset: 'Reset to defaults',
      preview: 'Preview',
      previewAria: 'Font preview',
      hint: 'The font must be installed on the machine running the browser; the family name is not the file name. Leave a field empty to keep the DSH default.',
      summary: 'Set the sidebar terminal’s font family, size and line height',
      save: 'Save',
      invalidSize: 'Font size must be a whole number between 8 and 32.',
      invalidLineHeight: 'Line height must be a number between 0.9 and 2.',
    }

    const CSS = [
      '.dshTerminalFont_page{box-sizing:border-box;display:flex;flex-direction:column;gap:12px;max-width:520px}',
      '.dshTerminalFont_row{box-sizing:border-box;display:flex;flex-direction:column;gap:12px}',
      '.dshTerminalFont_header{display:flex;justify-content:space-between;align-items:flex-start;gap:24px}',
      '.dshTerminalFont_copy{min-width:0}',
      '.dshTerminalFont_title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:500;line-height:20px}',
      '.dshTerminalFont_description{color:var(--dsw-alias-label-secondary);margin-top:4px;font-size:12px;line-height:18px}',
      '.dshTerminalFont_controls{display:flex;flex-wrap:wrap;align-items:flex-end;gap:12px}',
      '.dshTerminalFont_field{display:inline-flex;flex-direction:column;gap:4px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}',
      '.dshTerminalFont_fieldWide{flex:1 1 240px;min-width:180px}',
      '.dshTerminalFont_input{box-sizing:border-box;height:28px;border:.5px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:12px;line-height:18px;padding:0 10px;width:100%}',
      '.dshTerminalFont_input::placeholder{color:var(--dsw-alias-label-secondary)}',
      '.dshTerminalFont_input:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}',
      '.dshTerminalFont_number{width:76px;text-align:right}',
      '.dshTerminalFont_reset{box-sizing:border-box;height:28px;border:.5px solid var(--dsw-alias-border-l3);border-radius:6px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);cursor:pointer;padding:0 10px;font-family:inherit;font-size:12px;line-height:18px}',
      '.dshTerminalFont_reset:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.dshTerminalFont_reset:disabled{opacity:.5;cursor:default}',
      '.dshTerminalFont_reset:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}',
      '.dshTerminalFont_preview{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-markdown-code-block,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-primary);overflow:auto;white-space:pre;padding:8px 10px;font-size:13px;line-height:1.5}',
      '.dshTerminalFont_hint{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}',
      '.dshTerminalFont_error{margin:0;color:var(--dsw-alias-label-error);font-size:12px;line-height:18px}',
      '.dshTerminalFont_actions{display:flex;justify-content:flex-end;gap:8px}',
      '.dshTerminalFont_save{box-sizing:border-box;min-height:32px;border:none;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);cursor:pointer;padding:0 14px;font:inherit}',
      '.dshTerminalFont_save:disabled{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-tertiary);cursor:default}',
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
    const listeners = new Set()

    /** Notify the mounted configuration page and re-adopt live terminals. */
    function notify() {
      for (const listener of listeners) listener()
      adoptMountedTerminals(currentSettings)
    }

    /**
     * Pick up a settings value written outside this module — another tab, a
     * devtools edit, or a same-document write that never fires a `storage`
     * event. A no-op when the raw value is unchanged.
     * @returns {boolean} whether the settings changed.
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

    /** @param {() => void} listener - row subscription. @returns {() => void} unsubscribe. */
    function subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }

    /**
     * Commit settings, persist them, and apply them to live terminals.
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
     * Validate and normalize the raw form draft.
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

    /**
     * The component's own configuration page on
     * Plugins → @gitsang/dsh-qol → @gitsang/dsh-sidebar-terminal-enhance.
     * The live preview follows the staged values; nothing is saved until Save.
     * @param {{ view?: string, t: (key: string) => string }} props - slot props.
     * @returns {import('react').ReactElement|string} the page or its one-liner.
     */
    function SidebarTerminalEnhanceConfig({ view, t }) {
      const [current, setCurrent] = React.useState(() => draftOf(currentSettings))
      const [draft, setDraft] = React.useState(() => draftOf(currentSettings))
      const [error, setError] = React.useState(undefined)
      React.useEffect(() => subscribe(() => {
        const next = draftOf(currentSettings)
        setCurrent(next)
        setDraft(next)
        setError(undefined)
      }), [])

      if (view === 'summary') return t('summary')

      const dirty = draft.family !== current.family || draft.size !== current.size || draft.lineHeight !== current.lineHeight
      const previewFont = normalizeFamily(draft.family) ?? FALLBACK_OPTIONS.fontFamily
      const update = (field, value) => {
        setDraft((previous) => ({ ...previous, [field]: value }))
        setError(undefined)
      }
      const save = () => {
        if (!dirty) return
        const parsed = normalizeDraft(draft)
        if (parsed.sizeInvalid) {
          setError('invalidSize')
          return
        }
        if (parsed.lineHeightInvalid) {
          setError('invalidLineHeight')
          return
        }
        commitSettings(parsed.settings)
        const committed = draftOf(currentSettings)
        setCurrent(committed)
        setDraft(committed)
        setError(undefined)
      }
      const reset = () => {
        setDraft({ family: '', size: '', lineHeight: '' })
        setError(undefined)
      }

      return React.createElement(
        'div',
        { className: 'dshTerminalFont_page', 'data-sidebar-terminal-enhance-config': true },
        React.createElement(
          'div',
          { className: 'dshTerminalFont_header' },
          React.createElement(
            'div',
            { className: 'dshTerminalFont_copy' },
            React.createElement('div', { className: 'dshTerminalFont_title' }, t('title')),
            React.createElement('div', { className: 'dshTerminalFont_description' }, t('description')),
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'dshTerminalFont_reset',
              disabled: draft.family === '' && draft.size === '' && draft.lineHeight === '',
              onClick: reset,
            },
            t('reset'),
          ),
        ),
        React.createElement(
          'div',
          { className: 'dshTerminalFont_controls' },
          React.createElement(
            'label',
            { className: 'dshTerminalFont_field dshTerminalFont_fieldWide' },
            React.createElement('span', null, t('family')),
            React.createElement('input', {
              type: 'text',
              className: 'dshTerminalFont_input',
              value: draft.family,
              placeholder: t('familyPlaceholder'),
              spellCheck: false,
              autoComplete: 'off',
              'aria-label': t('familyAria'),
              onChange: (event) => update('family', event.target.value),
            }),
          ),
          React.createElement(
            'label',
            { className: 'dshTerminalFont_field' },
            React.createElement('span', null, t('size')),
            React.createElement('input', {
              type: 'number',
              className: 'dshTerminalFont_input dshTerminalFont_number',
              value: draft.size,
              min: SIZE_MIN,
              max: SIZE_MAX,
              step: 1,
              placeholder: String(FALLBACK_OPTIONS.fontSize),
              'aria-label': t('sizeAria'),
              'aria-invalid': error === 'invalidSize',
              onChange: (event) => update('size', event.target.value),
            }),
          ),
          React.createElement(
            'label',
            { className: 'dshTerminalFont_field' },
            React.createElement('span', null, t('lineHeight')),
            React.createElement('input', {
              type: 'number',
              className: 'dshTerminalFont_input dshTerminalFont_number',
              value: draft.lineHeight,
              min: LINE_HEIGHT_MIN,
              max: LINE_HEIGHT_MAX,
              step: 0.05,
              placeholder: String(FALLBACK_OPTIONS.lineHeight),
              'aria-label': t('lineHeightAria'),
              'aria-invalid': error === 'invalidLineHeight',
              onChange: (event) => update('lineHeight', event.target.value),
            }),
          ),
        ),
        React.createElement(
          'div',
          { className: 'dshTerminalFont_preview', 'aria-label': t('previewAria'), style: { fontFamily: previewFont } },
          PREVIEW_GLYPHS,
        ),
        React.createElement('div', { className: 'dshTerminalFont_hint' }, t('hint')),
        error === undefined ? null : React.createElement('p', { role: 'alert', className: 'dshTerminalFont_error' }, t(error)),
        React.createElement(
          'div',
          { className: 'dshTerminalFont_actions' },
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'dshTerminalFont_save',
              disabled: !dirty,
              onClick: save,
            },
            t('save'),
          ),
        ),
      )
    }

    const inject = ['slots', 'locale']
    const ROW_KEY = '@gitsang/dsh-qol#sidebar-terminal-enhance'

    /**
     * Register the stylesheet, dictionaries, storage sync, terminal adoption
     * and the component's Plugins row configuration page.
     * @param {object} ctx - client context.
     */
    function apply(ctx) {
      ctx.effect(
        () => {
          const removeStyles = installStyles()
          const onStorage = (event) => {
            if (event.key !== STORAGE_KEY) return
            refreshFromStorage()
          }
          globalThis.addEventListener?.('storage', onStorage)
          const stopObserving = observeTerminals(() => {
            refreshFromStorage()
            adoptMountedTerminals(currentSettings)
          })
          adoptMountedTerminals(currentSettings)
          return () => {
            globalThis.removeEventListener?.('storage', onStorage)
            stopObserving()
            removeStyles?.()
          }
        },
        'sidebar-terminal-enhance: styles and adoption',
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
      commitSettings,
      findTerminal,
      getSettings: () => currentSettings,
      inspectFiberLane,
      isFitLike,
      isTerminalLike,
      normalizeFamily,
      normalizeLineHeight,
      normalizeDraft,
      normalizeSettings,
      normalizeSize,
      originalOptions,
      parseStoredSettings,
      readRawSettings,
      refreshFromStorage,
      refit,
      resetSettings,
      setFamily,
      setLineHeight,
      setSize,
      subscribe,
      SidebarTerminalEnhanceConfig,
      CSS,
      PREVIEW_GLYPHS,
      ROW_KEY,
      STORAGE_KEY,
    }
    return module.exports
  },
})

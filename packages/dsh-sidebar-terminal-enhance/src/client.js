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
    const { SegmentedControl, SettingsForm, SettingsValueField, Tag } = primitives
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
    const FONT_LIST_ROUTE = '/sidebar-terminal-enhance/fonts'
    const FONT_FILE_ROUTE = '/sidebar-terminal-enhance/font/'
    const PLUGIN_ID = '@gitsang/dsh-sidebar-terminal-enhance'
    const CSS_ID = `${PLUGIN_ID}/SidebarTerminalEnhance.css`

    const SIZE_MIN = 8
    const SIZE_MAX = 32
    const LINE_HEIGHT_MIN = 0.9
    const LINE_HEIGHT_MAX = 2
    /** Preview line one: digits and lowercase ASCII. */
    const PREVIEW_LOWERCASE = '0123456789 abcdefghijklmnopqrstuvwxyz'
    /** Preview line two: uppercase ASCII. */
    const PREVIEW_UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    /** Preview line three: Nerd Font private-use code points, one per glyph. */
    const PREVIEW_ICONS = Object.freeze(['\ue627', '\ue73c', '\uf323', '\ue620', '\ue738', '\ued0d'])
    /** Every preview line, newline-separated because the preview is `white-space: pre`. */
    const PREVIEW_GLYPHS = `${PREVIEW_LOWERCASE}\n${PREVIEW_UPPERCASE}\n${PREVIEW_ICONS.join('  ')}`

    const zh = {
      fontSection: '字体',
      family: '字体族',
      familyPlaceholder: '例如 JetBrainsMono Nerd Font Mono',
      familyHint: '字体必须安装在浏览器所在的电脑上；族名不等于文件名。留空表示沿用 DSH 默认值。',
      familyStackHint: '下拉列表来自宿主机；可输入逗号分隔的回退列表，例如 “JetBrainsMono Nerd Font Mono, monospace”。',
      familyAria: '终端字体族',
      streamHint: '宿主机上的字体会按需通过本服务下载到浏览器：没装字体的远程电脑也能直接使用，无需在本地安装。',
      catalogLoading: '正在读取宿主机字体…',
      catalogReady: '宿主机共 {count} 个字体族，其中 {mono} 个等宽。',
      catalogError: '无法读取宿主机字体：{error}',
      catalogRetry: '重试',
      catalogRefresh: '刷新列表',
      catalogEmpty: '没有匹配的字体族',
      catalogMore: '还有 {count} 个匹配项，继续输入以缩小范围。',
      onlyMonospace: '仅等宽',
      monoTag: '等宽',
      optionUse: '使用字体 {family}',
      pickerOpen: '展开宿主机字体列表',
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
      familyStackHint: 'The list comes from the Host. You can also type a comma-separated fallback stack, e.g. “JetBrainsMono Nerd Font Mono, monospace”.',
      familyAria: 'Terminal font family',
      streamHint: 'Host fonts are streamed to this browser on demand, so a remote machine renders them without installing anything locally.',
      catalogLoading: 'Reading the Host’s fonts…',
      catalogReady: 'The Host has {count} font families, {mono} of them monospaced.',
      catalogError: 'Could not read the Host’s fonts: {error}',
      catalogRetry: 'Retry',
      catalogRefresh: 'Refresh list',
      catalogEmpty: 'No matching font family',
      catalogMore: '{count} more matches — keep typing to narrow the list.',
      onlyMonospace: 'Monospace only',
      monoTag: 'Mono',
      optionUse: 'Use font {family}',
      pickerOpen: 'Open the Host font list',
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
      '.dshTerminalFont_combo{position:relative;display:flex;flex-direction:column;gap:6px}',
      '.dshTerminalFont_inputRow{display:flex;align-items:center;gap:6px}',
      '.dshTerminalFont_combobox{box-sizing:border-box;flex:1 1 auto;min-width:0;height:30px;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-sm,6px);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;padding:0 10px}',
      '.dshTerminalFont_combobox::placeholder{color:var(--dsw-alias-label-tertiary)}',
      '.dshTerminalFont_combobox:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}',
      '.dshTerminalFont_toggle{box-sizing:border-box;flex:none;display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-sm,6px);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);cursor:pointer;padding:0}',
      '.dshTerminalFont_toggle:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.dshTerminalFont_toggle[aria-expanded="true"]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.dshTerminalFont_toggle:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}',
      '.dshTerminalFont_popover{position:absolute;z-index:30;left:0;right:0;top:calc(100% + 4px);box-sizing:border-box;max-height:280px;overflow-y:auto;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-layer-2);padding:4px;box-shadow:var(--dsw-elevation-prominent,0 8px 24px rgba(0,0,0,.18))}',
      '.dshTerminalFont_option{display:flex;align-items:center;justify-content:space-between;gap:12px;box-sizing:border-box;width:100%;margin:0;border:0;border-radius:var(--dsw-radius-sm,6px);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;text-align:left;padding:6px 8px;cursor:pointer}',
      '.dshTerminalFont_option[data-active="true"]{background:var(--dsw-alias-interactive-bg-hover)}',
      '.dshTerminalFont_option[aria-selected="true"]{font-weight:600}',
      '.dshTerminalFont_optionName{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dshTerminalFont_optionTag{flex:none;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}',
      '.dshTerminalFont_catalogBar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}',
      '.dshTerminalFont_catalogNote{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}',
      '.dshTerminalFont_catalogError{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-state-error-primary)}',
      '.dshTerminalFont_linkButton{border:0;background:transparent;color:var(--dsw-alias-state-business-primary);font:inherit;font-size:12px;line-height:18px;padding:0;cursor:pointer}',
      '.dshTerminalFont_linkButton:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}',
      '.dshTerminalFont_check{display:inline-flex;align-items:center;gap:6px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);cursor:pointer}',
    ].join('')

    /**
     * The Host font catalog fetched by the configuration page.
     *
     * `status` is `idle` before the first request, `loading` while the Host
     * enumerates, `ready` once a list is available and `error` when the route
     * failed. A failed catalog never blocks the field: the family stays free
     * text, the list is only a suggestion source.
     */
    let fontCatalogState = Object.freeze({
      status: 'idle',
      fonts: [],
      source: undefined,
      error: undefined,
      total: 0,
      streaming: Object.freeze({ supported: false, styles: [] }),
    })
    let fontCatalogRequest
    const fontCatalogListeners = new Set()

    /** @param {{status:string,fonts:Array,source?:string,error?:string,total?:number}} next - catalog state. */
    function setFontCatalog(next) {
      fontCatalogState = Object.freeze({
        status: next.status,
        fonts: next.fonts ?? [],
        source: next.source,
        error: next.error,
        total: next.total ?? next.fonts?.length ?? 0,
        streaming: next.streaming ?? fontCatalogState.streaming,
      })
      for (const listener of fontCatalogListeners) listener()
    }

    /** @param {() => void} listener - page subscription. @returns {() => void} unsubscribe. */
    function subscribeFontCatalog(listener) {
      fontCatalogListeners.add(listener)
      return () => {
        fontCatalogListeners.delete(listener)
      }
    }

    /**
     * Keep only usable catalog rows and de-duplicate by family name.
     * @param {unknown} value - wire value from the Host route.
     * @returns {Array<{family:string,monospace:boolean}>} normalized fonts.
     */
    function normalizeFontCatalog(value) {
      if (!Array.isArray(value)) return []
      const seen = new Set()
      const fonts = []
      for (const entry of value) {
        const family = typeof entry?.family === 'string' ? entry.family.trim() : ''
        if (family === '' || seen.has(family)) continue
        seen.add(family)
        fonts.push({ family, monospace: entry?.monospace === true })
      }
      return fonts
    }

    /**
     * Read the Host font catalog once, or force a fresh enumeration.
     * Concurrent callers share one request.
     * @param {boolean} [force] - bypass the cached catalog and ask the Host to rescan.
     * @returns {Promise<typeof fontCatalogState>} settled catalog state.
     */
    function loadHostFonts(force = false) {
      if (!force && fontCatalogState.status === 'ready') return Promise.resolve(fontCatalogState)
      if (fontCatalogRequest !== undefined) return fontCatalogRequest
      setFontCatalog({ status: 'loading', fonts: fontCatalogState.fonts, source: fontCatalogState.source, total: fontCatalogState.total })
      fontCatalogRequest = (async () => {
        try {
          if (typeof globalThis.fetch !== 'function') throw new Error('fetch unavailable')
          const url = force ? `${FONT_LIST_ROUTE}?refresh=1` : FONT_LIST_ROUTE
          const response = await globalThis.fetch(url, { cache: 'no-store', credentials: 'same-origin' })
          if (response?.ok !== true) throw new Error(`HTTP ${response?.status ?? 'error'}`)
          const body = await response.json()
          if (body?.ok !== true) throw new Error(typeof body?.error === 'string' ? body.error : 'invalid font catalog')
          const fonts = normalizeFontCatalog(body.fonts)
          setFontCatalog({
            status: 'ready',
            fonts,
            source: typeof body.source === 'string' ? body.source : undefined,
            streaming: normalizeStreaming(body.streaming),
          })
          // Publishing and re-adoption are best effort: a broken terminal
          // surface must never turn a good catalog into an error state.
          try {
            ensureRemoteStack(currentSettings.family)
            adoptMountedTerminals(currentSettings)
          } catch {
            // Ignore: the next scan retries once the surface is usable.
          }
        } catch (error) {
          setFontCatalog({
            status: 'error',
            fonts: [],
            error: error instanceof Error ? error.message : String(error),
          })
        } finally {
          fontCatalogRequest = undefined
        }
        return fontCatalogState
      })()
      return fontCatalogRequest
    }

    /**
     * Normalize the Host's streaming capability flag.
     * @param {unknown} value - wire value.
     * @returns {{supported:boolean,styles:string[]}} capability.
     */
    function normalizeStreaming(value) {
      if (value === null || typeof value !== 'object') return Object.freeze({ supported: false, styles: [] })
      const styles = Array.isArray(value.styles) ? value.styles.filter((style) => typeof style === 'string') : []
      return Object.freeze({ supported: value.supported === true, styles: Object.freeze(styles) })
    }

    /** Families whose `@font-face` rules this page already published. */
    const remoteFamilies = new Set()
    /** `<style>` element carrying the published `@font-face` rules, created on first use. */
    let remoteFaceStyle

    /**
     * Quote a family list segment for CSS.
     * @param {string} family - one family name, never a stack.
     * @returns {string} a double-quoted CSS string with escapes.
     */
    function cssString(family) {
      return `"${String(family).replace(/\\/gu, '\\\\').replace(/"/gu, '\\"')}"`
    }

    /**
     * URL of one streamed face on this Host.
     * @param {string} family - family name.
     * @param {'regular'|'bold'|'italic'|'bolditalic'} style - face.
     * @returns {string} same-origin URL.
     */
    function remoteFaceUrl(family, style) {
      return `${FONT_FILE_ROUTE}${encodeURIComponent(family)}/${style}.ttf`
    }

    /**
     * Publish `@font-face` rules for one Host family, so a browser that does not
     * have the font installed downloads it from this Host instead of falling
     * back. Called lazily: nothing is fetched until the family is selected or
     * previewed, and the browser itself fetches a face only when a glyph needs it.
     *
     * The rules cover regular and bold with both styles, which is what a
     * terminal renders. Each `src` points at the streaming route, so the file
     * arrives compressed and stays in the HTTP cache.
     *
     * @param {string} family - family name to publish.
     * @returns {boolean} whether a rule set was published now.
     */
    function ensureRemoteFamily(family) {
      const name = typeof family === 'string' ? family.trim() : ''
      if (name === '' || typeof document === 'undefined') return false
      if (fontCatalogState.streaming?.supported !== true) return false
      if (remoteFamilies.has(name)) return false
      const registered = fontCatalogState.fonts.some((font) => font.family.toLowerCase() === name.toLowerCase())
      if (!registered) return false
      remoteFamilies.add(name)
      if (remoteFaceStyle === undefined) {
        remoteFaceStyle = document.createElement('style')
        remoteFaceStyle.dataset.plugin = PLUGIN_ID
        remoteFaceStyle.dataset.pluginCss = `${PLUGIN_ID}/HostFonts.css`
        document.head.appendChild(remoteFaceStyle)
      }
      const quoted = cssString(name)
      // `local()` comes first so a browser that already has the face installed
      // uses it without downloading; the streaming URL is the fallback that
      // makes the Host font work on a machine where it is not installed.
      const face = (weight, style, suffix) => `@font-face{font-family:${quoted};font-style:${style};font-weight:${weight};font-display:swap;src:local(${quoted}),url("${remoteFaceUrl(name, suffix)}") format("truetype")}`
      remoteFaceStyle.textContent += [
        face(400, 'normal', 'regular'),
        face(700, 'normal', 'bold'),
        face(400, 'italic', 'italic'),
        face(700, 'italic', 'bolditalic'),
      ].join('')
      // Warm the regular face so the next paint already has the metrics xterm
      // measures; a failure here only means the fallback stays in effect.
      try {
        document.fonts?.load?.(`13px ${quoted}`)?.catch?.(() => {})
      } catch {
        // No FontFaceSet (older engine): the CSS rule still works when used.
      }
      return true
    }

    /**
     * Publish rules for every family named in a CSS font stack.
     * @param {string} value - comma-separated family list.
     * @returns {void}
     */
    function ensureRemoteStack(value) {
      for (const part of String(value ?? '').split(',')) {
        const family = part.trim().replace(/^["']|["']$/gu, '')
        if (family !== '') ensureRemoteFamily(family)
      }
    }

    /** The segment of a comma-separated stack the picker is currently editing. */
    function fontQuery(value) {
      const parts = String(value ?? '').split(',')
      return parts[parts.length - 1].trim()
    }

    /** @param {string} needle - lowercase query. @param {string} haystack - lowercase family. @returns {boolean} subsequence match. */
    function isSubsequence(needle, haystack) {
      let cursor = 0
      for (const character of haystack) {
        if (character === needle[cursor]) cursor += 1
        if (cursor === needle.length) return true
      }
      return needle.length === 0
    }

    /**
     * Score one family against the typed query. Whole-token substring matches
     * win over fuzzy subsequence matches, and a prefix beats a later hit.
     * @param {string} family - candidate family.
     * @param {string} query - raw lowercase query.
     * @returns {number|undefined} score, or undefined when the family does not match.
     */
    function scoreFontFamily(family, query) {
      const lower = family.toLowerCase()
      const tokens = query.split(/\s+/u).filter((token) => token !== '')
      if (tokens.length > 0 && tokens.every((token) => lower.includes(token))) {
        const index = lower.indexOf(query.replace(/\s+/gu, ' '))
        return 100 - (index < 0 ? 0 : Math.min(index, 40))
      }
      const compact = query.replace(/\s+/gu, '')
      if (compact !== '' && isSubsequence(compact, lower)) return 40
      return undefined
    }

    /**
     * Rank the catalog for the picker.
     * @param {Array<{family:string,monospace:boolean}>} fonts - catalog.
     * @param {string} value - current family field value (only its last segment is searched).
     * @param {boolean} onlyMonospace - filter to faces the Host reports as monospaced.
     * @param {number} [limit] - maximum rows returned.
     * @returns {{items:Array<{family:string,monospace:boolean}>, total:number}} matches and the untruncated count.
     */
    function rankFonts(fonts, value, onlyMonospace, limit = 60) {
      const pool = onlyMonospace ? fonts.filter((font) => font.monospace) : fonts
      const query = fontQuery(value).toLowerCase()
      if (query === '') return { items: pool.slice(0, limit), total: pool.length }
      const scored = []
      for (const font of pool) {
        const score = scoreFontFamily(font.family, query)
        if (score !== undefined) scored.push({ font, score })
      }
      scored.sort((left, right) => right.score - left.score
        || Number(right.font.monospace) - Number(left.font.monospace)
        || left.font.family.localeCompare(right.font.family))
      return { items: scored.slice(0, limit).map((entry) => entry.font), total: scored.length }
    }

    /**
     * Replace the segment the picker is editing, keeping earlier fallbacks.
     * @param {string} value - current family field value.
     * @param {string} family - chosen family.
     * @returns {string} the new family value.
     */
    function withSelectedFamily(value, family) {
      const current = String(value ?? '').trim()
      if (current === '' || current.endsWith(',')) return current === '' ? family : `${current} ${family}`
      const parts = current.split(',').map((part) => part.trim())
      if (parts.length <= 1) return family
      parts[parts.length - 1] = family
      return parts.join(', ')
    }

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
      // A Host font the browser lacks must be published as a web font before
      // the emulator measures its cells, or xterm would measure the fallback.
      ensureRemoteStack(settings.family)
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

    /**
     * Font-family field: a free-text combobox over the Host's font catalog.
     *
     * Typing both edits the family and filters the list, so an arbitrary
     * fallback stack stays possible while installed faces are one keystroke
     * away. Arrow keys move through the suggestions, Enter picks one, Escape
     * closes the list. Selecting replaces the last comma-separated segment and
     * keeps earlier fallbacks intact.
     * @param {object} props - field props.
     * @returns {import('react').ReactElement} the field.
     */
    function FontFamilyPicker({ id, t, value, overridden, label, hint, overriddenLabel, resetLabel, disabled, onEdit, onReset }) {
      const [catalog, setCatalog] = React.useState(fontCatalogState)
      const [open, setOpen] = React.useState(false)
      const [active, setActive] = React.useState(-1)
      const [onlyMonospace, setOnlyMonospace] = React.useState(false)
      const container = React.useRef(null)
      React.useEffect(() => subscribeFontCatalog(() => setCatalog(fontCatalogState)), [])
      React.useEffect(() => {
        loadHostFonts()
      }, [])

      const matches = rankFonts(catalog.fonts, value, onlyMonospace)
      const monoCount = catalog.fonts.filter((font) => font.monospace).length
      const listId = `${id}-listbox`
      const optionId = (index) => `${id}-option-${index}`

      const openList = () => {
        if (disabled) return
        setOpen(true)
        setActive(-1)
        if (fontCatalogState.status === 'idle' || fontCatalogState.status === 'error') loadHostFonts()
      }
      const choose = (family) => {
        onEdit(withSelectedFamily(value, family))
        setOpen(false)
        setActive(-1)
      }
      const onKeyDown = (event) => {
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          if (!open) openList()
          setActive((previous) => Math.min(matches.items.length - 1, previous + 1))
        } else if (event.key === 'ArrowUp') {
          event.preventDefault()
          if (!open) openList()
          setActive((previous) => Math.max(0, previous - 1))
        } else if (event.key === 'Enter') {
          const chosen = open ? matches.items[active] : undefined
          if (chosen !== undefined) {
            event.preventDefault()
            choose(chosen.family)
          }
        } else if (event.key === 'Escape') {
          setOpen(false)
          setActive(-1)
        } else if (event.key === 'Tab') {
          setOpen(false)
        }
      }
      const onBlur = (event) => {
        if (container.current?.contains?.(event.relatedTarget) === true) return
        setOpen(false)
        setActive(-1)
      }

      let catalogNote
      if (catalog.status === 'loading') {
        catalogNote = React.createElement('p', { className: 'dshTerminalFont_catalogNote' }, t('catalogLoading'))
      } else if (catalog.status === 'error') {
        catalogNote = React.createElement(
          'p',
          { className: 'dshTerminalFont_catalogError', role: 'status' },
          t('catalogError', { error: catalog.error ?? '' }),
          ' ',
          React.createElement('button', {
            type: 'button',
            className: 'dshTerminalFont_linkButton',
            onClick: () => loadHostFonts(true),
          }, t('catalogRetry')),
        )
      } else if (catalog.status === 'ready') {
        catalogNote = React.createElement(
          'div',
          { className: 'dshTerminalFont_catalogBar' },
          React.createElement('p', { className: 'dshTerminalFont_catalogNote' }, t('catalogReady', { count: catalog.fonts.length, mono: monoCount })),
          React.createElement(
            'span',
            { className: 'dshTerminalFont_catalogBar' },
            React.createElement(
              'label',
              { className: 'dshTerminalFont_check' },
              React.createElement('input', {
                type: 'checkbox',
                checked: onlyMonospace,
                onChange: (event) => {
                  setOnlyMonospace(event.target.checked)
                  setActive(-1)
                },
              }),
              t('onlyMonospace'),
            ),
            React.createElement('button', {
              type: 'button',
              className: 'dshTerminalFont_linkButton',
              disabled: catalog.status === 'loading',
              onClick: () => loadHostFonts(true),
            }, t('catalogRefresh')),
          ),
        )
      }

      const popover = open && catalog.status !== 'loading' && (
        matches.items.length === 0
          ? React.createElement('div', { className: 'dshTerminalFont_popover' },
              React.createElement('p', { className: 'dshTerminalFont_catalogNote' }, t('catalogEmpty')))
          : React.createElement(
              'div',
              { className: 'dshTerminalFont_popover', role: 'listbox', id: listId, 'aria-label': label },
              matches.items.map((font, index) => React.createElement(
                'button',
                {
                  key: font.family,
                  type: 'button',
                  role: 'option',
                  id: optionId(index),
                  'aria-selected': index === active,
                  'aria-label': t('optionUse', { family: font.family }),
                  'data-active': index === active ? 'true' : 'false',
                  className: 'dshTerminalFont_option',
                  onClick: () => choose(font.family),
                  onMouseEnter: () => setActive(index),
                },
                React.createElement('span', { className: 'dshTerminalFont_optionName' }, font.family),
                font.monospace ? React.createElement('span', { className: 'dshTerminalFont_optionTag' }, t('monoTag')) : null,
              )),
              matches.total > matches.items.length
                ? React.createElement('p', { className: 'dshTerminalFont_catalogNote', role: 'status' },
                    t('catalogMore', { count: matches.total - matches.items.length }))
                : null,
            )
      )

      return React.createElement(
        'div',
        { className: 'dshTerminalFont_field', 'data-terminal-font-picker': true },
        React.createElement(
          'div',
          { className: 'dshTerminalFont_catalogBar' },
          React.createElement('label', { className: 'dshTerminalFont_label', htmlFor: id }, label),
          overridden
            ? React.createElement(
                'span',
                { className: 'dshTerminalFont_catalogBar' },
                Tag === undefined ? null : React.createElement(Tag, { tone: 'neutral' }, overriddenLabel),
                React.createElement('button', {
                  type: 'button',
                  className: 'dshTerminalFont_linkButton',
                  disabled: disabled === true,
                  onClick: onReset,
                }, resetLabel),
              )
            : null,
        ),
        React.createElement(
          'div',
          { className: 'dshTerminalFont_combo', ref: container, onBlur },
          React.createElement(
            'div',
            { className: 'dshTerminalFont_inputRow' },
            React.createElement('input', {
              id,
              className: 'dshTerminalFont_combobox',
              type: 'text',
              role: 'combobox',
              autoComplete: 'off',
              spellCheck: false,
              'aria-expanded': open,
              'aria-controls': open ? listId : undefined,
              'aria-activedescendant': open && active >= 0 ? optionId(active) : undefined,
              'aria-label': t('familyAria'),
              disabled: disabled === true,
              value,
              onChange: (event) => {
                onEdit(event.target.value)
                setOpen(true)
                setActive(-1)
              },
              onFocus: openList,
              onKeyDown,
            }),
            React.createElement('button', {
              type: 'button',
              className: 'dshTerminalFont_toggle',
              'aria-label': t('pickerOpen'),
              'aria-expanded': open,
              disabled: disabled === true,
              onClick: () => {
                if (open) {
                  setOpen(false)
                  setActive(-1)
                } else {
                  openList()
                }
              },
            }, '▾'),
          ),
          popover,
        ),
        catalogNote,
        catalog.streaming?.supported === true && value.trim() !== ''
          ? React.createElement('p', { className: 'dshTerminalFont_hint', 'data-terminal-font-streaming': true }, t('streamHint'))
          : null,
        hint === undefined ? null : React.createElement('p', { className: 'dshTerminalFont_hint' }, hint),
      )
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
      // The preview must show the Host face the terminal will use, so publish
      // the rule as soon as the family is typed.
      ensureRemoteStack(previewFont)
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
          React.createElement(FontFamilyPicker, {
            id: 'terminal-font-family',
            t,
            label: t('family'),
            hint: `${t('familyHint')} ${t('familyStackHint')}`,
            value: draft.family,
            overridden: draft.family !== '',
            overriddenLabel: t('overridden'),
            resetLabel: t('reset'),
            disabled: false,
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
      isSubsequence,
      isTerminalLike,
      loadHostFonts,
      normalizeFontCatalog,
      rankFonts,
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
      FontFamilyPicker,
      SidebarTerminalEnhanceConfig,
      cssString,
      ensureRemoteFamily,
      ensureRemoteStack,
      fontCatalogState: () => fontCatalogState,
      normalizeStreaming,
      remoteFamilies,
      remoteFaceUrl,
      fontQuery,
      scoreFontFamily,
      withSelectedFamily,
      CSS,
      COLOR_STORAGE_KEY,
      PREVIEW_GLYPHS,
      PREVIEW_ICONS,
      PREVIEW_LOWERCASE,
      PREVIEW_UPPERCASE,
      ROW_KEY,
      STORAGE_KEY,
      THEME_SOURCE,
    }
    return module.exports
  },
})

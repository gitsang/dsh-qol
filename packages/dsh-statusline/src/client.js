/**
 * Browser half of dsh-statusline.
 *
 * The shipped composer statistics (`StatsPills`, slot id `stats`) renders two
 * pills: a gauge pill for turn/step counts plus throughput, and a database
 * pill for token usage plus cache hit. Its detail dialog is closed, though:
 * "模型用时" is one total and there is no row-extension seam inside it.
 *
 * A list slot keeps the first entry per id in ascending priority order, so this
 * package registers the same id at priority -1 and supplies a replacement that
 * keeps the shipped markup and CSS values, and uses the shipped primitives
 * (`IconGaugeOutlineRegular`, `IconDatabaseOutlineRegular`,
 * `useAnchoredPosition`, `useDismissOnOutsidePointer`) for the same icons and
 * placement behavior. The one intentional difference is the model-time rows:
 * the time dialog splits the total into first-token wait, decode, the
 * unattributed remainder, plus the original average-TTFT and TPS rows.
 *
 * Every number is a read of an existing session projection. No Host code, log
 * replay, or provider internals are needed:
 *
 * - `sessionStats.llmMs`      step/start -> assistant/message
 * - `sessionStats.ttftMs`     step/start -> first non-empty delta (client wall clock)
 * - `sessionStats.decodeMs`   first token -> assistant/message, on usage-reporting steps
 * - `tokenUsage`              cumulative provider usage over the whole durable log
 *
 * The first-token figure is deliberately labelled "首 token 等待" rather than
 * "prefill": it is a client-observed wall time that also contains networking,
 * queueing, and the provider's first-token generation.
 */
window.__ModuleLoader__.load({
  id: '@gitsang/dsh-statusline',
  factory: (require) => {
    const React = require('react')
    const ReactDOM = require('react-dom')
    const primitives = require('@deepseek-ai/dsh-client-ui-primitives')
    const module = { exports: {} }
    const exports = module.exports

    const { IconDatabaseOutlineRegular, IconGaugeOutlineRegular, useAnchoredPosition, useDismissOnOutsidePointer } = primitives

    /** Dictionary namespace owned by this plugin. */
    const NS = 'statusline'

    const zh = {
      'stats.counts': '{turns} 轮 {steps} 步',
      'stats.cacheHit': '缓存命中 {percent}%',
      'stats.dialog.title': '会话统计',
      'stats.dialog.usageTitle': 'Token 用量',
      'stats.dialog.llmTime': '模型用时',
      'stats.dialog.firstTokenTime': '首 token 用时',
      'stats.dialog.outputTime': '输出用时',
      'stats.dialog.toolTime': '工具调用用时',
      'stats.dialog.ttft': '首 token 平均（TTFT）',
      'stats.dialog.speed': '输出速度（TPS）',
      'message.tokensPerSecond': '{tps} tok/s',
      'message.turnUsage.count': '{count} tok',
      'message.turnUsage.cacheHit': '缓存命中',
      'message.turnUsage.input': '未缓存输入',
      'message.turnUsage.cacheRead': '缓存读取',
      'message.turnUsage.cacheWrite': '缓存写入',
      'message.turnUsage.output': '输出',
      'duration.compactSeconds': '{seconds}秒',
      'duration.compactMinutes': '{minutes}分{seconds}秒',
      'duration.compactHours': '{hours}小时{minutes}分',
      'number.thousand': '{value}K',
      'number.million': '{value}M',
      'number.groupSeparator': ',',
    }

    const en = {
      'stats.counts': '{turns} turns {steps} steps',
      'stats.cacheHit': 'Cache hit {percent}%',
      'stats.dialog.title': 'Session statistics',
      'stats.dialog.usageTitle': 'Token usage',
      'stats.dialog.llmTime': 'LLM time',
      'stats.dialog.firstTokenTime': 'First-token time',
      'stats.dialog.outputTime': 'Output time',
      'stats.dialog.toolTime': 'Tool time',
      'stats.dialog.ttft': 'Avg time to first token (TTFT)',
      'stats.dialog.speed': 'Tokens per second (TPS)',
      'message.tokensPerSecond': '{tps} tok/s',
      'message.turnUsage.count': '{count} tok',
      'message.turnUsage.cacheHit': 'Cache hit',
      'message.turnUsage.input': 'Uncached input',
      'message.turnUsage.cacheRead': 'Cached input',
      'message.turnUsage.cacheWrite': 'Cache write',
      'message.turnUsage.output': 'Output',
      'duration.compactSeconds': '{seconds}s',
      'duration.compactMinutes': '{minutes}m{seconds}s',
      'duration.compactHours': '{hours}h{minutes}m',
      'number.thousand': '{value}K',
      'number.million': '{value}M',
      'number.groupSeparator': ',',
    }

    const CSS_ID = '@gitsang/dsh-statusline/Statusline.css'
    // Field-for-field copy of the shipped StatsPills.module.css and
    // stat-dialog.module.css values, under this package's class prefix. The
    // `_pill` / `_root` / `_label` suffixes also keep dsh-mobile's existing
    // `[data-composer-stats] [class*="_pill"]` compatibility rules working.
    const CSS = [
      '.dshStatusline_root{box-sizing:border-box;min-width:0;max-width:100%;font-size:calc(var(--dsh-content-font-size-secondary,13px) - 1px);line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px));justify-content:center;gap:12px;display:flex}',
      '.dshStatusline_anchor{min-width:0;display:inline-flex}',
      '.dshStatusline_pill{box-sizing:border-box;corner-shape:round;max-width:100%;color:var(--dsw-alias-label-tertiary);font:inherit;font-variant-numeric:tabular-nums;line-height:inherit;white-space:nowrap;background:0 0;border:none;border-radius:999px;align-items:center;gap:6px;padding:1px 8px;display:inline-flex}',
      '.dshStatusline_pill svg{flex:none;width:14px;height:14px}',
      'button.dshStatusline_pill{cursor:pointer}',
      'button.dshStatusline_pill:hover,button.dshStatusline_pill[aria-expanded="true"]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}',
      '.dshStatusline_label{text-overflow:ellipsis;min-width:0;overflow:hidden}',
      '.dshStatusline_sep{color:var(--dsw-alias-separator-primary);margin:0 6px}',
      '.dshStatusline_panel{z-index:1100;box-sizing:border-box;border-radius:var(--dsw-radius-lg);background:var(--dsw-specific-menu);width:max-content;min-width:min(300px,100vw - 24px);max-width:min(440px,100vw - 24px);backdrop-filter:var(--dsw-menu-backdrop-filter);--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);box-shadow:var(--dsw-elevation-prominent);color:var(--dsw-alias-label-secondary);cursor:default;border:0;padding:16px;font-size:12px;line-height:18px;position:fixed}',
      '.dshStatusline_title{color:var(--dsw-alias-label-primary);justify-content:space-between;gap:16px;margin-bottom:8px;font-weight:500;display:flex}',
      '.dshStatusline_titleRule{border-top:.5px solid var(--dsw-alias-border-l2);margin-bottom:10px}',
      '.dshStatusline_titleValue{font-variant-numeric:tabular-nums}',
      '.dshStatusline_titleLabel{align-items:center;gap:6px;min-width:0;display:inline-flex}',
      '.dshStatusline_titleLabel svg{flex:none;width:14px;height:14px}',
      '.dshStatusline_details{color:var(--dsw-alias-label-tertiary);grid-template-columns:minmax(76px,auto) minmax(0,1fr);gap:6px 16px;margin:0;display:grid}',
      '.dshStatusline_details dt,.dshStatusline_details dd{min-width:0;margin:0}',
      '.dshStatusline_details dd{color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;text-align:right}',
      '.dshStatusline_details .dshStatusline_route{overflow-wrap:anywhere}',
    ].join('')

    /**
     * Install this plugin's stylesheet and return its disposer. Kept inside
     * `apply` so unloading the bundle removes the tag instead of leaving a dead
     * copy behind; non-browser harnesses simply skip styling.
     * @returns {(() => void)|undefined} removal callback when a document exists.
     */
    function installStyles() {
      if (typeof document === 'undefined' || document.head === undefined) return undefined
      const tag = document.createElement('style')
      tag.dataset.plugin = '@gitsang/dsh-statusline'
      tag.dataset.pluginCss = CSS_ID
      tag.textContent = CSS
      document.head.appendChild(tag)
      return () => {
        tag.remove()
      }
    }

    /** Viewport margin the placement clamp keeps (the Menu portal margin). */
    const PANEL_MARGIN = 12
    /** Distance between the trigger's top edge and the panel's bottom. */
    const PANEL_GAP = 8
    /**
     * Unplaced portal panel: hidden but laid out so the clamp measures real
     * dimensions (the `useAnchoredPosition` measure pass).
     */
    const MEASURE_STYLE = { visibility: 'hidden', left: 0, top: 0 }

    /** @param {unknown} value - candidate timer reading. @returns {boolean} finite non-negative number. */
    function isNonNegativeNumber(value) {
      return typeof value === 'number' && Number.isFinite(value) && value >= 0
    }

    /** @param {unknown} value - candidate count. @returns {number} the count, or 0. */
    function countOf(value) {
      return isNonNegativeNumber(value) ? value : 0
    }

    /**
     * Compact duration: 45.2s under a minute, 2m42s from there on, and
     * 5h55m once the session has run past an hour.
     * @param {number} ms - duration in milliseconds.
     * @param {(key: string, params?: object) => string} t - locale seat.
     * @returns {string} display duration.
     */
    function formatDuration(ms, t) {
      const seconds = Math.max(0, ms) / 1000
      if (seconds < 60) return t('duration.compactSeconds', { seconds: Math.round(seconds * 10) / 10 })
      const whole = Math.round(seconds)
      if (whole < 3600) return t('duration.compactMinutes', { minutes: Math.floor(whole / 60), seconds: whole % 60 })
      return t('duration.compactHours', { hours: Math.floor(whole / 3600), minutes: Math.floor((whole % 3600) / 60) })
    }

    /**
     * Compact token count: 517 / 12.2K / 517K / 1.2M (shipped wording).
     * @param {number} value - non-negative token count.
     * @param {(key: string, params?: object) => string} t - locale seat.
     * @returns {string} compact count.
     */
    function formatTokens(value, t) {
      const scaled = (candidate) => (candidate >= 100 ? String(Math.round(candidate)) : String(Math.round(candidate * 10) / 10))
      if (value < 1000) return String(Math.round(value))
      if (value < 1000000) return t('number.thousand', { value: scaled(value / 1000) })
      return t('number.million', { value: scaled(value / 1000000) })
    }

    /**
     * Exact integer token count with locale grouping.
     * @param {number} value - non-negative token count.
     * @param {(key: string, params?: object) => string} t - locale seat.
     * @returns {string} exact count.
     */
    function formatExactTokens(value, t) {
      const digits = String(Math.round(Math.max(0, value)))
      const groups = []
      for (let end = digits.length; end > 0; end -= 3) groups.unshift(digits.slice(Math.max(0, end - 3), end))
      return groups.join(t('number.groupSeparator'))
    }

    /** Round a cache-read ratio to exact percentage units, with positive ties rounded up. */
    function roundedPercentUnits(cacheReadTokens, denominator, decimalPlaces) {
      const scale = (decimalPlaces === 0 ? 1 : 10) * 100
      const doubledScale = scale * 2
      const denominatorQuotient = Math.floor(denominator / doubledScale)
      const denominatorRemainder = denominator % doubledScale
      let lower = 0
      let upper = scale
      while (lower < upper) {
        const candidate = Math.floor((lower + upper + 1) / 2)
        const factor = candidate * 2 - 1
        if (cacheReadTokens >= factor * denominatorQuotient + Math.ceil((factor * denominatorRemainder) / doubledScale)) lower = candidate
        else upper = candidate - 1
      }
      return lower
    }

    /** Render percentage units with at most one decimal. */
    function displayPercentUnits(units, decimalPlaces) {
      if (decimalPlaces === 0) return String(units)
      const whole = Math.floor(units / 10)
      const tenths = units % 10
      return tenths === 0 ? String(whole) : `${whole}.${tenths}`
    }

    /**
     * Display-ready cache-hit share without rounding a partial hit to 100%.
     * Field-for-field copy of the shipped token-format helper.
     * @param {number} cacheReadTokens - exact prompt tokens served from cache.
     * @param {number} promptTokens - exact aggregate prompt tokens.
     * @param {number} decimalPlaces - ordinary-ratio precision.
     * @returns {string|null} percentage text, or null when there was no prompt input.
     */
    function formatCacheHitPercent(cacheReadTokens, promptTokens, decimalPlaces = 0) {
      if (promptTokens === 0) return null
      const missedInputTokens = promptTokens - cacheReadTokens
      if (missedInputTokens === 0) return '100'
      const roundedUnits = roundedPercentUnits(cacheReadTokens, promptTokens, decimalPlaces)
      if (roundedUnits < (decimalPlaces === 0 ? 100 : 1000)) return displayPercentUnits(roundedUnits, decimalPlaces)
      let distinguishingPlaces = 1
      let scaledDoubleGap = missedInputTokens * 200
      const denominatorTens = Math.floor(promptTokens / 10)
      while (scaledDoubleGap <= denominatorTens) {
        scaledDoubleGap *= 10
        distinguishingPlaces += 1
      }
      const denominatorOnes = promptTokens % 10
      let roundedLoss = 5
      for (let loss = 1; loss < 5; loss += 1) {
        const factor = loss * 2 + 1
        const threshold = factor * denominatorTens + Math.floor((factor * denominatorOnes) / 10)
        if (scaledDoubleGap <= threshold) {
          roundedLoss = loss
          break
        }
      }
      return `99.${'9'.repeat(distinguishingPlaces - 1)}${10 - roundedLoss}`
    }

    /**
     * Decode-throughput figure: whole tokens from ten up, one decimal below.
     * @param {number} tps - tokens per second.
     * @returns {string} display number without unit.
     */
    function formatTokensPerSecond(tps) {
      const clamped = Math.max(0, tps)
      return clamped >= 10 ? String(Math.round(clamped)) : String(Math.round(clamped * 10) / 10)
    }

    /**
     * Reduce the session projections to the figures this statusline shows.
     * Pure so the arithmetic can be exercised outside React.
     * @param {object|undefined} stats - sessionStats projection value.
     * @param {object|undefined} usage - tokenUsage projection value.
     * @returns {object} display metrics.
     */
    function deriveMetrics(stats, usage) {
      const hasStats = typeof stats === 'object' && stats !== null
      const turns = hasStats ? countOf(stats.turns) : 0
      const steps = hasStats ? countOf(stats.steps) : 0
      const llmMs = hasStats ? countOf(stats.llmMs) : 0
      const toolMs = hasStats ? countOf(stats.toolMs) : 0
      const ttftSteps = hasStats ? countOf(stats.ttftSteps) : 0
      const ttftMs = hasStats ? countOf(stats.ttftMs) : 0
      const decodeMs = hasStats ? countOf(stats.decodeMs) : 0
      const decodeTokens = hasStats ? countOf(stats.decodeTokens) : 0
      const avgWaitMs = ttftSteps > 0 ? ttftMs / ttftSteps : null
      const tps = decodeMs > 0 ? decodeTokens / (decodeMs / 1000) : null
      const otherMs = Math.max(0, llmMs - ttftMs - decodeMs)

      const hasUsage = typeof usage === 'object' && usage !== null
      const uncachedInputTokens = hasUsage ? countOf(usage.uncachedInputTokens) : 0
      const cacheReadTokens = hasUsage ? countOf(usage.cacheReadTokens) : 0
      const cacheWriteTokens = hasUsage ? countOf(usage.cacheWriteTokens) : 0
      const outputTokens = hasUsage ? countOf(usage.outputTokens) : 0
      const billedInputTokens = uncachedInputTokens + cacheReadTokens + cacheWriteTokens
      const totalTokens = billedInputTokens + outputTokens

      return {
        visible: (hasStats && steps > 0) || totalTokens > 0,
        turns,
        steps,
        llmMs,
        toolMs,
        ttftMs,
        ttftSteps,
        avgWaitMs,
        decodeMs,
        decodeTokens,
        tps,
        otherMs,
        uncachedInputTokens,
        cacheReadTokens,
        cacheWriteTokens,
        outputTokens,
        billedInputTokens,
        totalTokens,
      }
    }

    /**
     * One trigger-anchored dialog seat: open state, viewport-clamped placement,
     * outside-close. Uses the shipped primitives so the behavior matches the
     * stock statistics pill exactly.
     * @returns {object} dialog seat.
     */
    function useStatDialog() {
      const [open, setOpen] = React.useState(false)
      const rootRef = React.useRef(null)
      const panelRef = React.useRef(null)
      const pos = useAnchoredPosition({
        open,
        anchorRef: rootRef,
        panelRef,
        side: 'top',
        gap: PANEL_GAP,
        margin: PANEL_MARGIN,
      })
      useDismissOnOutsidePointer(rootRef, open, setOpen, panelRef)
      React.useEffect(() => {
        if (!open) return undefined
        const onKeyDown = (event) => {
          if (event.key === 'Escape') setOpen(false)
        }
        document.addEventListener('keydown', onKeyDown)
        return () => {
          document.removeEventListener('keydown', onKeyDown)
        }
      }, [open])
      return { open, setOpen, rootRef, panelRef, pos }
    }

    /** One detail row in a stat dialog. */
    function DetailRow({ label, value }) {
      return React.createElement(React.Fragment, null, React.createElement('dt', null, label), React.createElement('dd', null, value))
    }

    /** The shared dialog shell: title, rule, and the rows. */
    function StatPanel({ panelRef, pos, title, icon, titleValue, rows }) {
      return React.createElement(
        'div',
        {
          ref: panelRef,
          className: 'dshStatusline_panel',
          role: 'dialog',
          'aria-label': title,
          style: pos ?? MEASURE_STYLE,
        },
        React.createElement(
          'div',
          { className: 'dshStatusline_title' },
          React.createElement(
            'span',
            { className: 'dshStatusline_titleLabel' },
            React.createElement(icon),
            title,
          ),
          titleValue === null || titleValue === undefined ? null : React.createElement('span', { className: 'dshStatusline_titleValue' }, titleValue),
        ),
        React.createElement('div', { className: 'dshStatusline_titleRule', 'aria-hidden': true }),
        React.createElement(
          'dl',
          { className: 'dshStatusline_details' },
          rows.map((row) => React.createElement(DetailRow, { key: row.key, label: row.label, value: row.value })),
        ),
      )
    }

    /**
     * Gauge pill: counts plus throughput, mirroring the shipped TimePill. The
     * split itself lives in the dialog so the collapsed strip stays identical
     * to the stock one.
     */
    function TimePill({ metrics, t }) {
      const { open, setOpen, rootRef, panelRef, pos } = useStatDialog()
      const counts = t('stats.counts', { turns: metrics.turns, steps: metrics.steps })
      const tps = metrics.tps !== null ? t('message.tokensPerSecond', { tps: formatTokensPerSecond(metrics.tps) }) : null
      const label = React.createElement(
        'span',
        { className: 'dshStatusline_label' },
        counts,
        tps !== null
          ? React.createElement(React.Fragment, null, React.createElement('span', { className: 'dshStatusline_sep', 'aria-hidden': true }, '·'), tps)
          : null,
      )
      const hasTiming = metrics.llmMs > 0 || metrics.toolMs > 0 || metrics.ttftSteps > 0 || metrics.decodeMs > 0

      if (!hasTiming) {
        return React.createElement(
          'span',
          { className: 'dshStatusline_anchor' },
          React.createElement('span', { className: 'dshStatusline_pill' }, React.createElement(IconGaugeOutlineRegular), label),
        )
      }

      const rows = []
      if (metrics.llmMs > 0) rows.push({ key: 'llm', label: t('stats.dialog.llmTime'), value: formatDuration(metrics.llmMs, t) })
      if (metrics.ttftMs > 0) rows.push({ key: 'wait', label: t('stats.dialog.firstTokenTime'), value: formatDuration(metrics.ttftMs, t) })
      if (metrics.decodeMs > 0) rows.push({ key: 'output', label: t('stats.dialog.outputTime'), value: formatDuration(metrics.decodeMs, t) })
      if (metrics.toolMs > 0) rows.push({ key: 'tool', label: t('stats.dialog.toolTime'), value: formatDuration(metrics.toolMs, t) })
      if (metrics.avgWaitMs !== null) rows.push({ key: 'ttft', label: t('stats.dialog.ttft'), value: formatDuration(metrics.avgWaitMs, t) })
      if (metrics.tps !== null) rows.push({ key: 'tps', label: t('stats.dialog.speed'), value: t('message.tokensPerSecond', { tps: formatTokensPerSecond(metrics.tps) }) })

      return React.createElement(
        'span',
        { ref: rootRef, className: 'dshStatusline_anchor' },
        React.createElement(
          'button',
          {
            type: 'button',
            className: 'dshStatusline_pill',
            'aria-haspopup': 'dialog',
            'aria-expanded': open,
            'aria-label': tps === null ? counts : `${counts} · ${tps}`,
            onClick: () => {
              setOpen(!open)
            },
          },
          React.createElement(IconGaugeOutlineRegular),
          label,
        ),
        open
          ? ReactDOM.createPortal(
              React.createElement(StatPanel, {
                panelRef,
                pos,
                title: t('stats.dialog.title'),
                icon: IconGaugeOutlineRegular,
                titleValue: null,
                rows,
              }),
              document.body,
            )
          : null,
      )
    }

    /**
     * Database pill: total tokens plus cache hit, with the shipped usage
     * breakdown dialog.
     */
    function UsagePill({ metrics, t }) {
      const { open, setOpen, rootRef, panelRef, pos } = useStatDialog()
      const cacheHit = formatCacheHitPercent(metrics.cacheReadTokens, metrics.billedInputTokens)
      const totalText = t('message.turnUsage.count', { count: formatTokens(metrics.totalTokens, t) })
      const cacheHitText = cacheHit !== null ? t('stats.cacheHit', { percent: cacheHit }) : null
      const exactTotal = t('message.turnUsage.count', { count: formatExactTokens(metrics.totalTokens, t) })
      const exact = (value) => t('message.turnUsage.count', { count: formatExactTokens(value, t) })
      const rows = []
      if (cacheHit !== null) rows.push({ key: 'cacheHit', label: t('message.turnUsage.cacheHit'), value: `${cacheHit}%` })
      rows.push({ key: 'input', label: t('message.turnUsage.input'), value: exact(metrics.uncachedInputTokens) })
      rows.push({ key: 'cacheRead', label: t('message.turnUsage.cacheRead'), value: exact(metrics.cacheReadTokens) })
      if (metrics.cacheWriteTokens > 0) rows.push({ key: 'cacheWrite', label: t('message.turnUsage.cacheWrite'), value: exact(metrics.cacheWriteTokens) })
      rows.push({ key: 'output', label: t('message.turnUsage.output'), value: exact(metrics.outputTokens) })

      return React.createElement(
        'span',
        { ref: rootRef, className: 'dshStatusline_anchor' },
        React.createElement(
          'button',
          {
            type: 'button',
            className: 'dshStatusline_pill',
            'aria-haspopup': 'dialog',
            'aria-expanded': open,
            'aria-label': cacheHitText === null ? totalText : `${totalText} · ${cacheHitText}`,
            onClick: () => {
              setOpen(!open)
            },
          },
          React.createElement(IconDatabaseOutlineRegular),
          React.createElement(
            'span',
            { className: 'dshStatusline_label' },
            totalText,
            cacheHitText !== null
              ? React.createElement(React.Fragment, null, React.createElement('span', { className: 'dshStatusline_sep', 'aria-hidden': true }, '·'), cacheHitText)
              : null,
          ),
        ),
        open
          ? ReactDOM.createPortal(
              React.createElement(StatPanel, {
                panelRef,
                pos,
                title: t('stats.dialog.usageTitle'),
                icon: IconDatabaseOutlineRegular,
                titleValue: exactTotal,
                rows,
              }),
              document.body,
            )
          : null,
      )
    }

    /**
     * Composer statusline. Replaces the shipped `stats` cell with the same two
     * pills the stock component renders, reading only Host-computed session
     * projections so paging and compaction never change the figures.
     */
    function Statusline({ useProjection, t }) {
      const stats = useProjection('sessionStats')
      const usage = useProjection('tokenUsage')
      const metrics = deriveMetrics(stats, usage)
      if (!metrics.visible) return null
      return React.createElement(
        'div',
        { className: 'dshStatusline_root', 'data-composer-stats': true },
        metrics.steps > 0 ? React.createElement(TimePill, { metrics, t }) : null,
        metrics.totalTokens > 0 ? React.createElement(UsagePill, { metrics, t }) : null,
      )
    }

    const inject = ['slots', 'locale']

    function apply(ctx) {
      ctx.effect(installStyles, 'statusline: styles')
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'statusline: dictionaries')
      ctx.slots.inject('conversation.composer.dock', () =>
        ctx.slots.register(
          {
            name: 'conversation.composer.dock',
            id: 'stats',
            order: 0,
            locale: NS,
            // Same id as the shipped statistics cell; a lower priority wins it.
            priority: -1,
          },
          Statusline,
        ),
      )
    }

    exports.apply = apply
    exports.inject = inject
    exports.__test = {
      Statusline,
      deriveMetrics,
      formatDuration,
      formatTokens,
      formatExactTokens,
      formatCacheHitPercent,
      formatTokensPerSecond,
    }
    return module.exports
  },
})

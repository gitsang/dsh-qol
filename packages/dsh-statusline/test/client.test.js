import assert from 'node:assert/strict'
import test from 'node:test'

/** Minimal locale seat with the same interpolation contract as the client. */
const dictionary = {
  'duration.compactSeconds': '{seconds}s',
  'duration.compactMinutes': '{minutes}m{seconds}s',
  'duration.compactHours': '{hours}h{minutes}m',
  'number.thousand': '{value}K',
  'number.million': '{value}M',
  'number.groupSeparator': ',',
}

function t(key, params = {}) {
  const template = dictionary[key]
  assert.equal(typeof template, 'string', `missing test dictionary key ${key}`)
  return template.replace(/\{(\w+)\}/gu, (_match, name) => String(params[name]))
}

/** Browser primitives used by the client half, stubbed for pure unit tests. */
const primitives = {
  IconDatabaseOutlineRegular: () => null,
  IconGaugeOutlineRegular: () => null,
  useAnchoredPosition: () => null,
  useDismissOnOutsidePointer: () => {},
}

/** Load the browser half through a fake module-loader registration. */
async function loadClient() {
  const factories = new Map()
  globalThis.window = {
    __ModuleLoader__: {
      load({ id, factory }) {
        factories.set(id, factory)
      },
    },
  }
  await import('../src/client.js')
  const factory = factories.get('@gitsang/dsh-statusline')
  assert.equal(typeof factory, 'function')
  return factory((specifier) => {
    if (specifier === 'react' || specifier === 'react-dom') return {}
    if (specifier === '@deepseek-ai/dsh-client-ui-primitives') return primitives
    throw new Error(`unexpected require ${specifier}`)
  })
}

const client = await loadClient()
const {
  deriveMetrics,
  formatDuration,
  formatTokens,
  formatExactTokens,
  formatCacheHitPercent,
  formatTokensPerSecond,
} = client.__test

test('no projections means no statusline', () => {
  const metrics = deriveMetrics(undefined, undefined)
  assert.equal(metrics.visible, false)
  assert.equal(metrics.steps, 0)
})

test('model time splits into first-token wait, decode, and unattributed time', () => {
  const metrics = deriveMetrics(
    { turns: 2, steps: 5, llmMs: 10_000, toolMs: 4_000, ttftMs: 3_000, ttftSteps: 3, decodeMs: 5_000, decodeTokens: 250 },
    undefined,
  )
  assert.equal(metrics.visible, true)
  assert.equal(metrics.avgWaitMs, 1_000)
  assert.equal(metrics.decodeMs, 5_000)
  assert.equal(metrics.tps, 50)
  assert.equal(metrics.otherMs, 2_000)
  assert.equal(metrics.toolMs, 4_000)
})

test('decode is only derived from steps that actually report it', () => {
  const metrics = deriveMetrics(
    { turns: 1, steps: 1, llmMs: 2_000, toolMs: 0, ttftMs: 0, ttftSteps: 0, decodeMs: 0, decodeTokens: 0 },
    undefined,
  )
  assert.equal(metrics.avgWaitMs, null)
  assert.equal(metrics.tps, null)
  assert.equal(metrics.otherMs, 2_000)
})

test('unattributed time never goes negative when the projections disagree', () => {
  const metrics = deriveMetrics(
    { turns: 1, steps: 1, llmMs: 1_000, toolMs: 0, ttftMs: 900, ttftSteps: 1, decodeMs: 900, decodeTokens: 10 },
    undefined,
  )
  assert.equal(metrics.otherMs, 0)
})

test('usage buckets stay disjoint and feed the shipped cache-hit wording', () => {
  const metrics = deriveMetrics(
    undefined,
    { uncachedInputTokens: 10, cacheReadTokens: 999, cacheWriteTokens: 1, outputTokens: 50 },
  )
  assert.equal(metrics.billedInputTokens, 1_010)
  assert.equal(metrics.totalTokens, 1_060)
  assert.equal(formatCacheHitPercent(metrics.cacheReadTokens, metrics.billedInputTokens, 1), '98.9')
  assert.equal(formatCacheHitPercent(999, 1_000, 1), '99.9')
  assert.equal(formatCacheHitPercent(1_000, 1_000, 1), '100')
  assert.equal(formatCacheHitPercent(0, 1_000, 1), '0')
  assert.equal(formatCacheHitPercent(0, 0, 1), null)
})

test('a usage-only session still renders the usage pill', () => {
  const metrics = deriveMetrics(undefined, { uncachedInputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 20 })
  assert.equal(metrics.visible, true)
  assert.equal(metrics.steps, 0)
  assert.equal(metrics.totalTokens, 120)
})

test('display helpers follow the shipped compact wording', () => {
  assert.equal(formatDuration(45_230, t), '45.2s')
  assert.equal(formatDuration(162_000, t), '2m42s')
  assert.equal(formatDuration(20_298_000, t), '5h38m')
  assert.equal(formatDuration(3_600_000, t), '1h0m')
  assert.equal(formatTokens(517, t), '517')
  assert.equal(formatTokens(12_200, t), '12.2K')
  assert.equal(formatTokens(517_000, t), '517K')
  assert.equal(formatTokens(1_200_000, t), '1.2M')
  assert.equal(formatExactTokens(1_234_567, t), '1,234,567')
  assert.equal(formatTokensPerSecond(9.84), '9.8')
  assert.equal(formatTokensPerSecond(38.2), '38')
})

test('apply registers both locale dictionaries and shadows the shipped stats cell', () => {
  const events = []
  const ctx = {
    effect(fn) {
      const dispose = fn()
      events.push(['effect', typeof dispose])
      return dispose
    },
    locale: {
      register(ns, dicts) {
        events.push(['locale', ns, Object.keys(dicts).sort()])
        return () => {}
      },
    },
    slots: {
      inject(name, register) {
        events.push(['inject', name])
        register()
      },
      register(options) {
        events.push(['register', options])
        return () => {}
      },
    },
  }
  client.apply(ctx)
  const locale = events.find((event) => event[0] === 'locale')
  assert.deepEqual(locale, ['locale', 'statusline', ['en', 'zh']])
  assert.deepEqual(events.find((event) => event[0] === 'inject'), ['inject', 'conversation.composer.dock'])
  const registration = events.find((event) => event[0] === 'register')
  assert.equal(registration[1].name, 'conversation.composer.dock')
  assert.equal(registration[1].id, 'stats')
  assert.equal(registration[1].priority, -1)
  assert.equal(registration[1].locale, 'statusline')
})

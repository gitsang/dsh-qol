import assert from 'node:assert/strict'
import test from 'node:test'

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
  const factory = factories.get('@gitsang/dsh-experimental-auto-review-enhance')
  assert.equal(typeof factory, 'function')
  return factory((specifier) => {
    if (specifier === 'react') return {}
    throw new Error(`unexpected require ${specifier}`)
  })
}

const client = await loadClient()

test('only English and Chinese are accepted; English is the fallback', () => {
  assert.equal(client.__test.normalizeLanguage('zh'), 'zh')
  assert.equal(client.__test.normalizeLanguage('en'), 'en')
  assert.equal(client.__test.normalizeLanguage('fr'), 'en')
  assert.equal(client.__test.normalizeLanguage(undefined), 'en')
})

test('the component configuration normalizes both stored fields', () => {
  assert.deepEqual(client.__test.normalizeConfig({
    defaultPreset: 'auto',
    reviewLanguage: 'zh',
    autoAvailable: true,
  }), { defaultPreset: 'auto', reviewLanguage: 'zh', autoAvailable: true })
  assert.deepEqual(client.__test.normalizeConfig({
    defaultPreset: 'read-only',
    reviewLanguage: 'fr',
    autoAvailable: false,
  }), { defaultPreset: '', reviewLanguage: 'en', autoAvailable: false })
  assert.deepEqual(client.__test.normalizeConfig(undefined), {
    defaultPreset: '',
    reviewLanguage: 'en',
    autoAvailable: true,
  })
})

test('registers a configuration page for this component row', () => {
  const events = []
  const ctx = {
    effect(fn, label) {
      events.push(['effect', label])
      return fn()
    },
    locale: {
      register(ns, dictionaries) {
        events.push(['locale', ns, Object.keys(dictionaries).sort()])
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
  assert.deepEqual(events.find((event) => event[0] === 'locale'), ['locale', 'autoReviewEnhance', ['en', 'zh']])
  assert.deepEqual(events.find((event) => event[0] === 'inject'), ['inject', 'plugins.row.config'])
  const registration = events.find((event) => event[0] === 'register')
  assert.equal(registration[1].name, 'plugins.row.config')
  assert.equal(registration[1].key, '@gitsang/dsh-qol#experimental-auto-review-enhance')
  assert.equal(registration[1].locale, 'autoReviewEnhance')
  assert.equal(client.__test.CONFIG_PATH, '/experimental-auto-review-enhance/config')
})

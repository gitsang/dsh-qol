import assert from 'node:assert/strict'
import test from 'node:test'

/** In-memory localStorage with the small surface the browser half uses. */
class MemoryStorage {
  data = new Map()
  getItem(key) {
    return this.data.has(key) ? this.data.get(key) : null
  }
  setItem(key, value) {
    this.data.set(key, String(value))
  }
  removeItem(key) {
    this.data.delete(key)
  }
}

const storage = new MemoryStorage()
globalThis.localStorage = storage

/** Load the browser half through a fake module-loader registration. */
async function loadClient() {
  const factories = new Map()
  globalThis.window = {
    localStorage: storage,
    addEventListener() {},
    removeEventListener() {},
    __ModuleLoader__: {
      load({ id, factory }) {
        factories.set(id, factory)
      },
    },
  }
  await import('../src/client.js')
  const factory = factories.get('@gitsang/dsh-enter-swap')
  assert.equal(typeof factory, 'function')
  return factory((specifier) => {
    if (specifier === 'react') return {}
    throw new Error(`unexpected require ${specifier}`)
  })
}

const client = await loadClient()

test('the preference is validated and persisted in this browser', () => {
  assert.equal(client.__test.readMode(), 'swap')
  client.__test.writeMode('default')
  assert.equal(storage.getItem('dsh.enterSwap.v1'), 'default')
  assert.equal(client.__test.readMode(), 'default')
  client.__test.writeMode('unknown')
  assert.equal(client.__test.readMode(), 'default')
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
  assert.deepEqual(events.find((event) => event[0] === 'locale'), ['locale', 'enterSwap', ['en', 'zh']])
  assert.deepEqual(events.find((event) => event[0] === 'inject'), ['inject', 'plugins.row.config'])
  const registration = events.find((event) => event[0] === 'register')
  assert.equal(registration[1].name, 'plugins.row.config')
  assert.equal(registration[1].key, '@gitsang/dsh-qol#enter-swap')
  assert.equal(registration[1].locale, 'enterSwap')
})

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

globalThis.localStorage = new MemoryStorage()

/** Browser primitives used by the client half, stubbed for pure unit tests. */
const primitives = {
  IconLightOutlineMedium: () => null,
  IconDarkOutlineMedium: () => null,
  IconFollowsystemOutlineMedium: () => null,
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
  const factory = factories.get('@gitsang/dsh-terminal-color')
  assert.equal(typeof factory, 'function')
  return factory((specifier) => {
    if (specifier === 'react') return {}
    if (specifier === '@deepseek-ai/dsh-client-ui-primitives') return primitives
    throw new Error(`unexpected require ${specifier}`)
  })
}

const client = await loadClient()
const {
  buildThemeTokens,
  commitPreference,
  getPreference,
  normalizePreference,
  parseStoredPreference,
  PALETTES,
  CSS,
} = client.__test

test('only light, dark, and follow-appearance are accepted', () => {
  assert.equal(normalizePreference('light'), 'light')
  assert.equal(normalizePreference('dark'), 'dark')
  assert.equal(normalizePreference('system'), 'system')
  assert.equal(normalizePreference('blue'), 'system')
  assert.equal(normalizePreference(null), 'system')
  assert.equal(parseStoredPreference(null), 'system')
  assert.equal(parseStoredPreference('dark'), 'dark')
})

test('fixed choices publish the matching terminal palette for both theme modes', () => {
  assert.equal(buildThemeTokens('system', 1), undefined)
  assert.deepEqual(buildThemeTokens('light', 2), {
    '--dsh-terminal-color-background': { light: PALETTES.light.background, dark: PALETTES.light.background },
    '--dsh-terminal-color-foreground': { light: PALETTES.light.foreground, dark: PALETTES.light.foreground },
    '--dsh-terminal-color-revision': { light: '2', dark: '2' },
  })
  assert.deepEqual(buildThemeTokens('dark', 3), {
    '--dsh-terminal-color-background': { light: PALETTES.dark.background, dark: PALETTES.dark.background },
    '--dsh-terminal-color-foreground': { light: PALETTES.dark.foreground, dark: PALETTES.dark.foreground },
    '--dsh-terminal-color-revision': { light: '3', dark: '3' },
  })
})

test('commits persist, notify, and add/remove exactly one theme layer', () => {
  let disposed = 0
  const layers = []
  const events = []
  const ctx = {
    effect(fn, label) {
      events.push(['effect', label])
      const dispose = fn()
      return () => dispose?.()
    },
    locale: {
      register(ns, dictionaries) {
        events.push(['locale', ns, Object.keys(dictionaries).sort()])
        return () => {}
      },
    },
    on() {
      return () => {}
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
    theme: {
      overrideTokens(source, tokens) {
        layers.push({ source, tokens })
        return () => {
          disposed += 1
        }
      },
    },
  }

  client.apply(ctx)
  assert.deepEqual(events.find((event) => event[0] === 'locale'), ['locale', 'terminalColor', ['en', 'zh']])
  assert.deepEqual(events.find((event) => event[0] === 'inject'), ['inject', 'plugins.row.config'])
  const registration = events.find((event) => event[0] === 'register')
  assert.equal(registration[1].name, 'plugins.row.config')
  assert.equal(registration[1].key, '@gitsang/dsh-qol#terminal-color')
  assert.equal(registration[1].locale, 'terminalColor')

  // Default follow-appearance state publishes no layer.
  assert.equal(layers.length, 0)
  assert.equal(getPreference(), 'system')
  assert.equal(globalThis.localStorage.getItem('@gitsang/dsh-terminal-color/preference'), null)

  commitPreference('dark')
  assert.equal(getPreference(), 'dark')
  assert.equal(globalThis.localStorage.getItem('@gitsang/dsh-terminal-color/preference'), 'dark')
  assert.equal(layers.length, 1)
  assert.deepEqual(layers.at(-1).tokens['--dsh-terminal-color-background'], {
    light: PALETTES.dark.background,
    dark: PALETTES.dark.background,
  })

  commitPreference('light')
  assert.equal(layers.length, 2)
  assert.equal(disposed, 0)
  assert.deepEqual(layers.at(-1).tokens['--dsh-terminal-color-background'], {
    light: PALETTES.light.background,
    dark: PALETTES.light.background,
  })

  commitPreference('system')
  assert.equal(getPreference(), 'system')
  assert.equal(globalThis.localStorage.getItem('@gitsang/dsh-terminal-color/preference'), null)
  assert.equal(disposed, 1)
})

test('the configuration page mirrors the Appearance row and has exactly three choices', () => {
  assert.match(CSS, /dshTerminalColor_page/)
  assert.match(CSS, /dshTerminalColor_group/)
  assert.match(CSS, /dshTerminalColor_cubeRow/)
  assert.match(CSS, /dshTerminalColor_selected/)
  assert.match(CSS, /\[data-sidebar-terminal\]/)
  assert.doesNotMatch(CSS, /type=color|dshTerminalColor_input/)
  assert.equal((CSS.match(/dshTerminalColor_cube\{/gu) ?? []).length, 1)
})

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
  const factory = factories.get('@gitsang/dsh-sidebar-terminal-enhance')
  assert.equal(typeof factory, 'function')
  return factory((specifier) => {
    if (specifier === 'react') return {}
    if (specifier === '@deepseek-ai/dsh-client-ui-primitives') return primitives
    throw new Error(`unexpected require ${specifier}`)
  })
}

/** Browser primitives used by the client half, stubbed for pure unit tests. */
const primitives = {
  SegmentedControl: () => null,
  SettingsForm: ({ children }) => children,
  SettingsValueField: () => null,
}

const client = await loadClient()
const {
  applyFont,
  buildThemeTokens,
  commitPreference,
  commitSettings,
  findTerminal,
  getPreference,
  getSettings,
  inspectFiberLane,
  isFitLike,
  isTerminalLike,
  normalizeFamily,
  normalizeLineHeight,
  normalizePreference,
  normalizeSettings,
  normalizeSize,
  originalOptions,
  parseStoredPreference,
  parseStoredSettings,
  PALETTES,
  PREFERENCES,
  readRawSettings,
  refreshPreferenceFromStorage,
  refreshFromStorage,
  refit,
  resetSettings,
  setFamily,
  setLineHeight,
  setSize,
  CSS,
  COLOR_STORAGE_KEY,
  PREVIEW_GLYPHS,
  ROW_KEY,
  STORAGE_KEY,
  THEME_SOURCE,
} = client.__test

/** Minimal stand-in for an xterm Terminal with public option setters. */
function fakeTerminal(overrides = {}) {
  return {
    options: { fontFamily: 'ui-monospace, monospace', fontSize: 13, lineHeight: 1.2, ...overrides },
    cols: 80,
    rows: 24,
    _core: { _charSizeService: {} },
    resized: [],
    resize(cols, rows) {
      this.cols = cols
      this.rows = rows
      this.resized.push([cols, rows])
    },
    refresh() {},
  }
}

/** Minimal stand-in for FitAddon whose proposal the test controls. */
function fakeFit(dimensions = { cols: 96, rows: 30 }) {
  return {
    _terminal: undefined,
    proposed: 0,
    fitted: 0,
    proposeDimensions() {
      this.proposed += 1
      return dimensions
    },
    fit() {
      this.fitted += 1
    },
  }
}

/** Minimal stand-in for the terminal view model. */
function fakeModel({ environment, writable = true, info } = {}) {
  const state = {
    environment: environment ?? { maxCols: 500, maxRows: 200 },
    writable,
    info,
  }
  return {
    resized: [],
    state: { getSnapshot: () => state },
    resize(cols, rows) {
      this.resized.push([cols, rows])
    },
  }
}

test('settings normalize field by field', () => {
  assert.equal(normalizeFamily('  JetBrainsMono   Nerd Font Mono , monospace '), 'JetBrainsMono Nerd Font Mono , monospace')
  assert.equal(normalizeFamily('   '), undefined)
  assert.equal(normalizeFamily('bad\u0000family'), 'bad family')
  assert.equal(normalizeFamily(42), undefined)

  assert.equal(normalizeSize(13), 13)
  assert.equal(normalizeSize('15'), 15)
  assert.equal(normalizeSize(12.6), 13)
  assert.equal(normalizeSize(7), undefined)
  assert.equal(normalizeSize(33), undefined)
  assert.equal(normalizeSize(''), undefined)
  assert.equal(normalizeSize('abc'), undefined)

  assert.equal(normalizeLineHeight(1.2), 1.2)
  assert.equal(normalizeLineHeight('1.35'), 1.35)
  assert.equal(normalizeLineHeight(0.5), undefined)
  assert.equal(normalizeLineHeight(3), undefined)

  assert.deepEqual(normalizeSettings({ family: 'Mono', size: '14', lineHeight: 1.4 }), {
    family: 'Mono',
    size: 14,
    lineHeight: 1.4,
  })
  assert.deepEqual(normalizeSettings({ family: '', size: 0 }), {})
  assert.equal(Object.isFrozen(normalizeSettings(undefined)), true)
})

test('stored settings are validated and never throw on bad JSON', () => {
  assert.deepEqual(parseStoredSettings('{"family":"Mono","size":14}'), { family: 'Mono', size: 14 })
  assert.deepEqual(parseStoredSettings('{"family":"Mono","size":"nope"}'), { family: 'Mono' })
  assert.deepEqual(parseStoredSettings('broken'), {})
  assert.deepEqual(parseStoredSettings(''), {})
  assert.deepEqual(parseStoredSettings(null), {})
})

test('palette preferences accept only light, dark, and follow-appearance', () => {
  assert.equal(normalizePreference('light'), 'light')
  assert.equal(normalizePreference('dark'), 'dark')
  assert.equal(normalizePreference('system'), 'system')
  assert.equal(normalizePreference('blue'), 'system')
  assert.equal(normalizePreference(null), 'system')
  assert.equal(parseStoredPreference(null), 'system')
  assert.equal(parseStoredPreference('dark'), 'dark')
  assert.deepEqual(PREFERENCES, ['light', 'dark', 'system'])
})

test('fixed palettes publish matching terminal theme tokens for both modes', () => {
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

test('palette commits persist and reuse the previous storage key', () => {
  globalThis.localStorage.removeItem(COLOR_STORAGE_KEY)
  globalThis.localStorage.setItem('@gitsang/dsh-terminal-color/palette', 'old')
  commitPreference('dark')
  assert.equal(getPreference(), 'dark')
  assert.equal(globalThis.localStorage.getItem(COLOR_STORAGE_KEY), 'dark')
  assert.equal(globalThis.localStorage.getItem('@gitsang/dsh-terminal-color/palette'), null)
  commitPreference('system')
  assert.equal(getPreference(), 'system')
  assert.equal(globalThis.localStorage.getItem(COLOR_STORAGE_KEY), null)
})

test('an external palette write is adopted on the next scan', () => {
  globalThis.localStorage.setItem(COLOR_STORAGE_KEY, 'light')
  assert.equal(refreshPreferenceFromStorage(), true)
  assert.equal(getPreference(), 'light')
  assert.equal(refreshPreferenceFromStorage(), false)
  globalThis.localStorage.removeItem(COLOR_STORAGE_KEY)
  assert.equal(refreshPreferenceFromStorage(), true)
  assert.equal(getPreference(), 'system')
})

test('terminal shape checks reject look-alikes', () => {
  assert.equal(isTerminalLike(fakeTerminal()), true)
  assert.equal(isTerminalLike({ options: { fontFamily: 'mono' } }), false)
  assert.equal(isTerminalLike(null), false)
  assert.equal(isFitLike(fakeFit()), true)
  assert.equal(isFitLike({ fit() {} }), false)
})

test('applyFont writes options and restores the captured originals', () => {
  const terminal = fakeTerminal()
  assert.equal(applyFont(terminal, { family: 'JetBrainsMono Nerd Font Mono', size: 15, lineHeight: 1.3 }), true)
  assert.equal(terminal.options.fontFamily, 'JetBrainsMono Nerd Font Mono')
  assert.equal(terminal.options.fontSize, 15)
  assert.equal(terminal.options.lineHeight, 1.3)
  assert.deepEqual(originalOptions(terminal), {
    fontFamily: 'ui-monospace, monospace',
    fontSize: 13,
    lineHeight: 1.2,
  })

  // Idempotent: a second pass with the same settings changes nothing.
  assert.equal(applyFont(terminal, { family: 'JetBrainsMono Nerd Font Mono', size: 15, lineHeight: 1.3 }), false)

  // Resetting only size restores the shipped family and line height.
  assert.equal(applyFont(terminal, {}), true)
  assert.equal(terminal.options.fontFamily, 'ui-monospace, monospace')
  assert.equal(terminal.options.fontSize, 13)
  assert.equal(terminal.options.lineHeight, 1.2)
})

test('refit re-measures and reports the clamped grid to the Host', () => {
  const terminal = fakeTerminal()
  const fit = fakeFit({ cols: 120, rows: 40 })
  fit._terminal = terminal
  const model = fakeModel({ environment: { maxCols: 100, maxRows: 30 } })
  const dimensions = refit({ terminal, fit, model })
  assert.deepEqual(dimensions, { cols: 100, rows: 30 })
  assert.equal(fit.fitted, 1)
  assert.deepEqual(model.resized, [[100, 30]])

  // A read-only viewer keeps its Host grid: no PTY resize is sent.
  const readOnlyModel = fakeModel({ writable: false })
  refit({ terminal, fit: fakeFit({ cols: 50, rows: 10 }), model: readOnlyModel })
  assert.deepEqual(readOnlyModel.resized, [])
})

test('findTerminal resolves the emulator, FitAddon and model from a fiber lane', () => {
  const terminal = fakeTerminal()
  const fit = fakeFit()
  fit._terminal = terminal
  const model = fakeModel()
  const screen = {}
  const hookList = { memoizedState: { current: terminal }, next: { memoizedState: { current: fit }, next: null } }
  screen.__reactFiber$test = {
    memoizedState: hookList,
    memoizedProps: { model },
    return: { memoizedState: null, memoizedProps: {}, return: null },
  }
  const lane = inspectFiberLane(screen)
  assert.equal(lane.length, 1)
  assert.deepEqual(lane[0].terminals, [terminal])
  assert.deepEqual(lane[0].fits, [fit])
  assert.deepEqual(lane[0].models, [model])

  const found = findTerminal(screen)
  assert.equal(found.terminal, terminal)
  assert.equal(found.fit, fit)
  assert.equal(found.model, model)

  // A node React never touched has no handle at all.
  assert.equal(findTerminal({}), undefined)
})

test('commits persist, notify the row, and re-adopt mounted terminals', () => {
  const terminal = fakeTerminal()
  const fit = fakeFit()
  fit._terminal = terminal
  const model = fakeModel()
  const screen = { parentElement: null }
  screen.__reactFiber$test = {
    memoizedState: { memoizedState: { current: terminal }, next: { memoizedState: { current: fit }, next: null } },
    memoizedProps: { model },
    return: null,
  }
  const xterm = { parentElement: screen }
  globalThis.document = {
    querySelectorAll(selector) {
      assert.equal(selector, '[data-sidebar-terminal] .xterm')
      return [xterm]
    },
  }

  let notified = 0
  const unsubscribe = client.__test.subscribe(() => {
    notified += 1
  })
  setFamily('FiraCode Nerd Font Mono')
  assert.deepEqual(getSettings(), { family: 'FiraCode Nerd Font Mono' })
  assert.equal(globalThis.localStorage.getItem(STORAGE_KEY), '{"family":"FiraCode Nerd Font Mono"}')
  assert.equal(terminal.options.fontFamily, 'FiraCode Nerd Font Mono')
  assert.equal(fit.proposed, 1)

  setSize(16)
  setLineHeight(1.4)
  assert.deepEqual(getSettings(), { family: 'FiraCode Nerd Font Mono', size: 16, lineHeight: 1.4 })
  assert.equal(terminal.options.fontSize, 16)
  assert.equal(terminal.options.lineHeight, 1.4)

  resetSettings()
  assert.deepEqual(getSettings(), {})
  assert.equal(globalThis.localStorage.getItem(STORAGE_KEY), null)
  assert.equal(terminal.options.fontFamily, 'ui-monospace, monospace')

  delete globalThis.document
  assert.equal(notified, 4)
  unsubscribe()
  setFamily('Other Mono')
  assert.equal(notified, 4)
  assert.equal(commitSettings !== undefined, true)
})

test('an external storage write is adopted on the next scan', () => {
  const terminal = fakeTerminal()
  const fit = fakeFit()
  fit._terminal = terminal
  const model = fakeModel()
  const screen = { parentElement: null }
  screen.__reactFiber$test = {
    memoizedState: { memoizedState: { current: terminal }, next: { memoizedState: { current: fit }, next: null } },
    memoizedProps: { model },
    return: null,
  }
  globalThis.document = { querySelectorAll: () => [{ parentElement: screen }] }

  setFamily('Mono A')
  assert.equal(terminal.options.fontFamily, 'Mono A')

  // A same-document write never fires `storage`; the scan picks it up.
  globalThis.localStorage.setItem(STORAGE_KEY, '{"family":"Mono B","size":17}')
  assert.equal(refreshFromStorage(), true)
  assert.deepEqual(getSettings(), { family: 'Mono B', size: 17 })

  // Unchanged raw value is a no-op.
  assert.equal(refreshFromStorage(), false)

  // A cleared value restores the shipped defaults.
  globalThis.localStorage.removeItem(STORAGE_KEY)
  assert.equal(readRawSettings(), null)
  assert.equal(refreshFromStorage(), true)
  assert.deepEqual(getSettings(), {})

  delete globalThis.document
})

test('CSS is scoped to the terminal surface and configuration page', () => {
  assert.match(CSS, /dshTerminalFont_section/)
  assert.match(CSS, /dshTerminalFont_preview/)
  assert.match(CSS, /\[data-sidebar-terminal\]/)
  assert.doesNotMatch(CSS, /^body\{/)
  assert.match(PREVIEW_GLYPHS, /\ue0b0/u)
})


test('registers the component configuration page on the Plugins row', () => {
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
        events.push(['theme', source, tokens])
        return () => {}
      },
    },
  }
  client.apply(ctx)
  assert.deepEqual(events.find((event) => event[0] === 'inject'), ['inject', 'plugins.row.config'])
  const registration = events.find((event) => event[0] === 'register')
  assert.equal(registration[1].name, 'plugins.row.config')
  assert.equal(registration[1].key, ROW_KEY)
  assert.equal(ROW_KEY, '@gitsang/dsh-qol#sidebar-terminal-enhance')
  assert.equal(registration[1].locale, 'sidebarTerminalEnhance')
})

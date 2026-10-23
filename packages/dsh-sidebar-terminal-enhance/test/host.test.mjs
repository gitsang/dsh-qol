import assert from 'node:assert/strict'
import test from 'node:test'

import {
  FONT_LIST_PATH,
  fontCatalog,
  mergeFonts,
  parseFamilyLines,
  parseFontconfig,
  parseSystemProfiler,
  readHostFonts,
  resetFontCache,
} from '../src/index.js'

/** Fake command runner: file name → stdout, or an Error to throw. */
function runner(table) {
  const calls = []
  const run = async (file, args) => {
    calls.push({ file, args })
    const answer = table[file]
    if (answer instanceof Error) throw answer
    if (answer === undefined) throw new Error(`unexpected command ${file}`)
    return { stdout: answer }
  }
  run.calls = calls
  return run
}

test('fontconfig rows become family faces with a monospace verdict', () => {
  const faces = parseFontconfig('DejaVu Sans Mono|100\nNoto Sans|90\nBroken row\n\nLiberation Mono|100\n')
  assert.deepEqual(faces, [
    { family: 'DejaVu Sans Mono', monospace: true },
    { family: 'Noto Sans', monospace: false },
    { family: 'Liberation Mono', monospace: true },
  ])
})

test('families merge with the monospace verdict of any face and sort mono first', () => {
  const fonts = mergeFonts([
    { family: 'Noto Sans', monospace: false },
    { family: 'DejaVu Sans Mono', monospace: false },
    { family: 'DejaVu Sans Mono', monospace: true },
    { family: 'Arial', monospace: false },
    { family: '  ', monospace: false },
  ])
  assert.deepEqual(fonts, [
    { family: 'DejaVu Sans Mono', monospace: true },
    { family: 'Arial', monospace: false },
    { family: 'Noto Sans', monospace: false },
  ])
})

test('the macOS profiler JSON maps family names and name-based monospace hints', () => {
  const stdout = JSON.stringify({
    SPFontsDataType: [
      { _name: 'Menlo', typefaces: [{ _name: 'Menlo-Regular' }] },
      { _name: 'SF Mono', typefaces: [{ _name: 'SFMono-Regular' }] },
      { _name: 'Helvetica', typefaces: [{ _name: 'Helvetica' }] },
      { _name: '', typefaces: [] },
    ],
  })
  assert.deepEqual(parseSystemProfiler(stdout), [
    { family: 'Menlo', monospace: false },
    { family: 'SF Mono', monospace: true },
    { family: 'Helvetica', monospace: false },
  ])
  assert.deepEqual(parseSystemProfiler('not json'), [])
})

test('Windows family lines are trimmed and classified by name', () => {
  assert.deepEqual(parseFamilyLines('Cascadia Code\r\nArial\r\n\r\n'), [
    { family: 'Cascadia Code', monospace: true },
    { family: 'Arial', monospace: false },
  ])
})

test('readHostFonts uses fontconfig on Linux', async () => {
  const run = runner({ 'fc-list': 'DejaVu Sans Mono|100\nNoto Sans|90\n' })
  const result = await readHostFonts({ platform: 'linux', run })
  assert.equal(result.source, 'fc-list')
  assert.deepEqual(result.fonts, [
    { family: 'DejaVu Sans Mono', monospace: true },
    { family: 'Noto Sans', monospace: false },
  ])
  assert.equal(run.calls.length, 1)
  assert.deepEqual(run.calls[0].args, ['--format=%{family[0]}|%{spacing}\n'])
})

test('readHostFonts falls back to system_profiler on macOS', async () => {
  const run = runner({
    'fc-list': new Error('spawn fc-list ENOENT'),
    'system_profiler': JSON.stringify({ SPFontsDataType: [{ _name: 'SF Mono', typefaces: [] }] }),
  })
  const result = await readHostFonts({ platform: 'darwin', run })
  assert.equal(result.source, 'system_profiler')
  assert.deepEqual(result.fonts, [{ family: 'SF Mono', monospace: true }])
})

test('readHostFonts fails loudly when no helper answers', async () => {
  const run = runner({ 'fc-list': new Error('spawn fc-list ENOENT') })
  await assert.rejects(() => readHostFonts({ platform: 'linux', run }), /no usable font catalog/u)
})

test('the catalog is cached until explicitly refreshed', async () => {
  resetFontCache()
  const first = runner({ 'fc-list': 'Alpha Mono|100\n' })
  const cachedCall = await fontCatalog({ platform: 'linux', run: first })
  assert.equal(cachedCall.cached, false)
  assert.deepEqual(cachedCall.fonts, [{ family: 'Alpha Mono', monospace: true }])

  const second = runner({ 'fc-list': 'Beta Sans|90\n' })
  const reused = await fontCatalog({ platform: 'linux', run: second })
  assert.equal(reused.cached, true)
  assert.deepEqual(reused.fonts, cachedCall.fonts)
  assert.equal(second.calls.length, 0)

  const refreshed = await fontCatalog({ platform: 'linux', run: second, refresh: true })
  assert.equal(refreshed.cached, false)
  assert.deepEqual(refreshed.fonts, [{ family: 'Beta Sans', monospace: false }])
  resetFontCache()
})

test('the route path stays under the component namespace', () => {
  assert.equal(FONT_LIST_PATH, '/sidebar-terminal-enhance/fonts')
})

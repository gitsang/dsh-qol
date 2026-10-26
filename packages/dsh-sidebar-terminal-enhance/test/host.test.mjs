import assert from 'node:assert/strict'
import test from 'node:test'

import {
  FONT_FILE_PREFIX,
  FONT_LIST_PATH,
  decodeFamilySegment,
  loadFace,
  parseFaceRequest,
  resetFaceCache,
  resolveFace,
  streamingSupport,
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

test('a face request splits family and style, rejecting traversal and unknown styles', () => {
  assert.deepEqual(parseFaceRequest('Iosevka%20Nerd%20Font%20Mono/regular.ttf'), {
    family: 'Iosevka Nerd Font Mono',
    style: 'regular',
  })
  assert.deepEqual(parseFaceRequest('DejaVu%20Sans%20Mono/bolditalic.ttf'), {
    family: 'DejaVu Sans Mono',
    style: 'bolditalic',
  })
  assert.throws(() => parseFaceRequest('DejaVu%20Sans%20Mono'), /expected/u)
  assert.throws(() => parseFaceRequest('/regular.ttf'), /expected/u)
  assert.throws(() => parseFaceRequest('DejaVu%20Sans%20Mono/stretched.ttf'), /expected/u)
  assert.throws(() => parseFaceRequest('..%2F..%2Fetc%2Fpasswd/regular.ttf'), /invalid family name/u)
  assert.throws(() => decodeFamilySegment('%E0%A4%A'), /malformed/u)
})

test('resolveFace rejects silent fontconfig substitutions', async () => {
  const run = async (file, args) => {
    assert.equal(file, 'fc-match')
    assert.match(args.at(-1), /:style=Bold$/u)
    return { stdout: '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf\nNoto Sans\nRegular\n' }
  }
  await assert.rejects(() => resolveFace('Iosevka Nerd Font Mono', 'bold', { run }), /not installed/u)

  const ok = async () => ({
    stdout: '/home/sang/.local/share/fonts/IosevkaNerdFont/IosevkaNerdFontMono-Bold.ttf\nIosevka Nerd Font Mono,Iosevka NFM\nBold Bold\n',
  })
  assert.deepEqual(await resolveFace('Iosevka Nerd Font Mono', 'bold', { run: ok }), {
    file: '/home/sang/.local/share/fonts/IosevkaNerdFont/IosevkaNerdFontMono-Bold.ttf',
    family: 'Iosevka Nerd Font Mono,Iosevka NFM',
    style: 'Bold Bold',
  })
  await assert.rejects(() => resolveFace('Mono', 'stretched', { run: ok }), /unknown style/u)
})

test('streamingSupport reports whether fontconfig can stream faces', async () => {
  const yes = await streamingSupport({ run: async () => ({ stdout: '/usr/share/fonts/x.ttf' }) })
  assert.equal(yes.supported, true)
  assert.deepEqual(yes.styles, ['regular', 'bold', 'italic', 'bolditalic'])

  const missing = await streamingSupport({ run: async () => { throw new Error('spawn fc-match ENOENT') } })
  assert.equal(missing.supported, false)
  assert.match(missing.reason, /fontconfig is unavailable/u)

  const empty = await streamingSupport({ run: async () => ({ stdout: '  ' }) })
  assert.equal(empty.supported, false)
})

test('loadFace compresses once and revalidates with an etag', async () => {
  const { mkdtemp, writeFile } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { rm } = await import('node:fs/promises')
  const dir = await mkdtemp(join(tmpdir(), 'dsh-font-'))
  const file = join(dir, 'Face.ttf')
  // gzip/brotli need real bytes but never a real font, only a stable buffer.
  await writeFile(file, Buffer.from('x'.repeat(4096)))
  resetFaceCache()
  const first = await loadFace(file, 'gzip')
  assert.equal(first.encoding, 'gzip')
  assert.match(first.etag, /^"[0-9a-f]+-[0-9a-f]+"$/u)
  const again = await loadFace(file, 'gzip')
  assert.equal(again.body, first.body)
  const brotli = await loadFace(file, 'br')
  assert.equal(brotli.encoding, 'br')
  assert.notEqual(brotli.body, first.body)
  await assert.rejects(() => loadFace(dir), /not a font file/u)
  await rm(dir, { recursive: true, force: true })
})

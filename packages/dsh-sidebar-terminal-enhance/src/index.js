/**
 * Host half of dsh-sidebar-terminal-enhance.
 *
 * Two jobs:
 *
 * 1. Own one same-origin route the browser half uses to offer real font
 *    choices instead of a blind text box:
 *
 *      GET /sidebar-terminal-enhance/fonts[?refresh=1]
 *
 *    It enumerates the Host machine's installed font families with the
 *    platform's own tool — fontconfig on Linux, `system_profiler` on macOS,
 *    the .NET font collection on Windows — and marks the monospaced ones so
 *    the picker can sort terminal-appropriate faces first.
 *
 * 2. Keep the Loader row alive: the browser half is discovered from
 *    package.json `dsh.client`, and this row stays independently switchable
 *    on the bundle's Plugins page.
 *
 * The browser usually runs on a different machine than the Host. The route is
 * therefore a *suggestion* source, never a validator: the browser half keeps
 * accepting any family stack the user types.
 */
import { execFile } from 'node:child_process'
import { readFile, stat } from 'node:fs/promises'
import { promisify } from 'node:util'
import { brotliCompressSync, constants, gzipSync } from 'node:zlib'

/** Promise face of execFile; the callback form cannot be awaited. */
const execFileAsync = promisify(execFile)

export const name = 'sidebar-terminal-enhance'
export const inject = ['webServer']

/** Same-origin endpoint owned by this package: the family catalog. */
export const FONT_LIST_PATH = '/sidebar-terminal-enhance/fonts'
/**
 * Same-origin prefix that streams one installed face to the browser, so a
 * remote browser can use a Host font without installing it locally:
 *
 *   GET /sidebar-terminal-enhance/font/<family>/<style>.ttf
 *
 * `style` is one of `regular`, `bold`, `italic`, `bolditalic`. The prefix
 * carries no trailing slash because {@link WebServer.match} matches
 * `<prefix>` and `<prefix>/…`, not `<prefix/>…`.
 */
export const FONT_FILE_PREFIX = '/sidebar-terminal-enhance/font'

/** How long one enumeration is reused before the route shells out again. */
const CACHE_TTL_MS = 10 * 60 * 1000
/** Command timeouts: fontconfig is fast, the macOS profiler is not. */
const COMMAND_TIMEOUT_MS = 15_000
/** Upper bound on families returned to the browser. */
const MAX_FONTS = 5_000
/** Longest family name accepted on the font-file route. */
const MAX_FAMILY_LENGTH = 200
/** Compressed-byte budget for the in-memory face cache. */
const FACE_CACHE_BYTES = 48 * 1024 * 1024
/** Fontconfig style names for the four faces the browser may request. */
const FACE_STYLES = Object.freeze({
  regular: 'Regular',
  bold: 'Bold',
  italic: 'Italic',
  bolditalic: 'Bold Italic',
})

const FONT_NAME_MONO = /(?:^|[\s._-])(mono|monospace|code|console|fixed|courier|terminal)(?:$|[\s._-])/iu

/**
 * Run one helper command and resolve its stdout.
 * @param {string} file - executable.
 * @param {string[]} args - arguments, never shell-interpolated.
 * @param {(file: string, args: string[], options: object) => Promise<{stdout: string}>} run - command runner.
 * @returns {Promise<string>} stdout.
 */
async function commandOutput(file, args, run) {
  const { stdout } = await run(file, args, {
    timeout: COMMAND_TIMEOUT_MS,
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  })
  return typeof stdout === 'string' ? stdout : String(stdout ?? '')
}

/**
 * Parse `fc-list` families. The format is one `family|spacing` row per face,
 * where `spacing` is 100 for monospaced faces and 90 for dual-width ones.
 * @param {string} stdout - command output.
 * @returns {Array<{family: string, monospace: boolean}>} faces.
 */
export function parseFontconfig(stdout) {
  const faces = []
  for (const line of String(stdout).split('\n')) {
    if (line.trim() === '') continue
    const separator = line.lastIndexOf('|')
    if (separator <= 0) continue
    const family = line.slice(0, separator).trim()
    if (family === '') continue
    faces.push({ family, monospace: line.slice(separator + 1).trim() === '100' })
  }
  return faces
}

/**
 * Parse `system_profiler SPFontsDataType -json` into font families. A family
 * entry carries its typefaces under `typefaces`; the family name is `_name`.
 * Monospace detection falls back to the name, since the profiler publishes no
 * spacing metric.
 * @param {string} stdout - command output.
 * @returns {Array<{family: string, monospace: boolean}>} faces.
 */
export function parseSystemProfiler(stdout) {
  let parsed
  try {
    parsed = JSON.parse(String(stdout))
  } catch {
    return []
  }
  const entries = Array.isArray(parsed?.SPFontsDataType) ? parsed.SPFontsDataType : []
  const faces = []
  for (const entry of entries) {
    const family = typeof entry?._name === 'string' ? entry._name.trim() : ''
    if (family === '') continue
    const typefaces = Array.isArray(entry.typefaces) ? entry.typefaces : []
    const names = [family, ...typefaces.map((typeface) => (typeof typeface?._name === 'string' ? typeface._name : ''))]
    const monospace = names.some((name) => FONT_NAME_MONO.test(name))
    faces.push({ family, monospace })
  }
  return faces
}

/**
 * Parse one-family-per-line output from the Windows font collection query.
 * @param {string} stdout - command output.
 * @returns {Array<{family: string, monospace: boolean}>} faces.
 */
export function parseFamilyLines(stdout) {
  const faces = []
  for (const line of String(stdout).split('\n')) {
    const family = line.replace(/\r$/u, '').trim()
    if (family === '') continue
    faces.push({ family, monospace: FONT_NAME_MONO.test(family) })
  }
  return faces
}

/**
 * Collapse faces into families, keeping the monospace verdict of any face.
 * @param {Array<{family: string, monospace: boolean}>} faces - parsed faces.
 * @returns {Array<{family: string, monospace: boolean}>} sorted unique families.
 */
export function mergeFonts(faces) {
  const byFamily = new Map()
  for (const face of faces) {
    const family = typeof face?.family === 'string' ? face.family.trim() : ''
    if (family === '') continue
    const previous = byFamily.get(family)
    if (previous === undefined) byFamily.set(family, face.monospace === true)
    else if (face.monospace === true) byFamily.set(family, true)
  }
  return [...byFamily.entries()]
    .map(([family, monospace]) => ({ family, monospace }))
    .sort((left, right) => Number(right.monospace) - Number(left.monospace) || left.family.localeCompare(right.family))
    .slice(0, MAX_FONTS)
}

/**
 * Enumerate the Host's font families with the platform's own tool.
 * @param {{platform?: string, run?: Function}} [options] - injection points for tests.
 * @returns {Promise<{source: string, fonts: Array<{family: string, monospace: boolean}>}>} catalog.
 */
export async function readHostFonts(options = {}) {
  const platform = options.platform ?? process.platform
  const run = options.run ?? execFileAsync
  /** @type {Array<[string, string[], (stdout: string) => any]>} */
  const attempts = []
  if (platform === 'darwin') {
    attempts.push(['fc-list', ['--format=%{family[0]}|%{spacing}\n'], parseFontconfig])
    attempts.push(['system_profiler', ['SPFontsDataType', '-json'], parseSystemProfiler])
  } else if (platform === 'win32') {
    attempts.push([
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        '[Console]::OutputEncoding=[Text.Encoding]::UTF8; Add-Type -AssemblyName System.Drawing; (New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { $_.Name }',
      ],
      parseFamilyLines,
    ])
  } else {
    attempts.push(['fc-list', ['--format=%{family[0]}|%{spacing}\n'], parseFontconfig])
  }
  const failures = []
  for (const [file, args, parse] of attempts) {
    try {
      const fonts = mergeFonts(parse(await commandOutput(file, args, run)))
      if (fonts.length > 0) return { source: file, fonts }
      failures.push(`${file}: no families`)
    } catch (error) {
      failures.push(`${file}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  throw new Error(`no usable font catalog (${failures.join('; ')})`)
}

/** Last successful enumeration, reused until it expires. */
let cached = undefined
/** In-flight enumeration, so concurrent callers share one shell-out. */
let pending = undefined

/**
 * Read the catalog, reusing the last enumeration while it is fresh.
 * @param {{refresh?: boolean, now?: number, platform?: string, run?: Function}} [options] - overrides.
 * @returns {Promise<{source: string, fonts: Array<{family: string, monospace: boolean}>, cached: boolean}>} catalog.
 */
export async function fontCatalog(options = {}) {
  const now = options.now ?? Date.now()
  if (options.refresh !== true && cached !== undefined && now - cached.at < CACHE_TTL_MS) {
    return { source: cached.source, fonts: cached.fonts, cached: true }
  }
  if (pending === undefined) {
    pending = readHostFonts(options)
      .then((result) => {
        cached = { at: Date.now(), source: result.source, fonts: result.fonts }
        return result
      })
      .finally(() => {
        pending = undefined
      })
  }
  const result = await pending
  return { source: result.source, fonts: result.fonts, cached: false }
}

/** Reset the module cache (tests). */
export function resetFontCache() {
  cached = undefined
  pending = undefined
}

/**
 * Resolve one installed face with fontconfig.
 *
 * The family the caller asked for must appear in the family list `fc-match`
 * answers with, otherwise the match is a silent substitution (`fc-match
 * "No Such Font"` happily answers Noto Sans) and serving it would put the
 * wrong typeface behind the requested name.
 *
 * @param {string} family - requested family name.
 * @param {string} style - one of the {@link FACE_STYLES} keys.
 * @param {{run?: Function}} [options] - command runner for tests.
 * @returns {Promise<{file: string, family: string, style: string}>} resolved face.
 */
export async function resolveFace(family, style, options = {}) {
  const run = options.run ?? execFileAsync
  const fontconfigStyle = FACE_STYLES[style]
  if (fontconfigStyle === undefined) throw new Error(`unknown style "${style}"`)
  const { stdout } = await run('fc-match', ['-f', '%{file}\n%{family}\n%{style}\n', `${family}:style=${fontconfigStyle}`], {
    timeout: COMMAND_TIMEOUT_MS,
    maxBuffer: 1024 * 1024,
    windowsHide: true,
  })
  const [file = '', families = '', matchedStyle = ''] = String(stdout).split('\n')
  if (file.trim() === '') throw new Error(`no font file for "${family}"`)
  const wanted = family.trim().toLowerCase()
  const names = families.split(',').map((name) => name.trim().toLowerCase()).filter(Boolean)
  if (!names.includes(wanted)) {
    throw new Error(`"${family}" is not installed (fontconfig matched "${families.trim()}")`)
  }
  return { file: file.trim(), family: families.trim(), style: matchedStyle.trim() }
}

/** @param {string} value - family name from the URL. @returns {string} the decoded family. */
export function decodeFamilySegment(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    throw new Error('malformed family name')
  }
}

/**
 * Split the tail of a font-file URL into its family and style.
 * @param {string} tail - everything after `<prefix>/`.
 * @returns {{family: string, style: string}} requested face.
 */
export function parseFaceRequest(tail) {
  const slash = tail.lastIndexOf('/')
  if (slash <= 0) throw new Error('expected <family>/<style>.ttf')
  const family = decodeFamilySegment(tail.slice(0, slash)).trim()
  const file = decodeFamilySegment(tail.slice(slash + 1))
  const style = file.replace(/\.ttf$/iu, '')
  if (family === '' || family.length > MAX_FAMILY_LENGTH) throw new Error('invalid family name')
  // A family name is a fontconfig pattern, never a path: rejecting separators
  // and control characters keeps the decoded segment from reading as a file.
  if (/[\\/\u0000-\u001f\u007f]/u.test(family)) throw new Error('invalid family name')
  if (FACE_STYLES[style] === undefined) throw new Error('expected <family>/<style>.ttf')
  return { family, style }
}

/** Compressed faces, keyed by `<encoding>|<file>|<mtimeMs>|<size>`, in LRU order. */
const faceCache = new Map()
let faceCacheBytes = 0

/** Reset the streaming face cache (tests). */
export function resetFaceCache() {
  faceCache.clear()
  faceCacheBytes = 0
}

/**
 * Read, compress and cache one face. The key carries the file's mtime and size,
 * so an upgraded font is re-read instead of served from a stale entry.
 *
 * Brotli keeps the same face at roughly two thirds of gzip's size and both are
 * computed once per file revision, so the first request pays the compression
 * and every later request is a cached buffer write.
 *
 * @param {string} file - absolute font path from fontconfig.
 * @param {'br'|'gzip'} [encoding] - transfer encoding to prepare.
 * @returns {Promise<{body: Buffer, etag: string, encoding: 'br'|'gzip'}>} compressed face and validator.
 */
export async function loadFace(file, encoding = 'br') {
  const info = await stat(file)
  if (info.isFile() !== true) throw new Error(`not a font file: ${file}`)
  const etag = `"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`
  const key = `${encoding}|${file}|${info.mtimeMs}|${info.size}`
  const hit = faceCache.get(key)
  if (hit !== undefined) {
    faceCache.delete(key)
    faceCache.set(key, hit)
    return { body: hit.body, etag: hit.etag, encoding }
  }
  const raw = await readFile(file)
  const body = encoding === 'br'
    ? brotliCompressSync(raw, { params: {
        [constants.BROTLI_PARAM_QUALITY]: 5,
        [constants.BROTLI_PARAM_SIZE_HINT]: raw.length,
      } })
    : gzipSync(raw, { level: 6 })
  faceCache.set(key, { body, etag })
  faceCacheBytes += body.length
  for (const [oldKey, value] of faceCache) {
    if (faceCacheBytes <= FACE_CACHE_BYTES) break
    faceCache.delete(oldKey)
    faceCacheBytes -= value.body.length
  }
  return { body, etag, encoding }
}

/**
 * Report whether this Host can stream faces to the browser at all. The browser
 * half uses it to decide whether to publish `@font-face` rules.
 * @param {{run?: Function}} [options] - command runner for tests.
 * @returns {Promise<{supported: boolean, reason?: string, styles: string[]}>} capability.
 */
export async function streamingSupport(options = {}) {
  const run = options.run ?? execFileAsync
  try {
    const { stdout } = await run('fc-match', ['-f', '%{file}', 'monospace'], {
      timeout: COMMAND_TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    })
    if (String(stdout).trim() === '') return { supported: false, reason: 'fontconfig returned no file', styles: [] }
    return { supported: true, styles: Object.keys(FACE_STYLES) }
  } catch (error) {
    return {
      supported: false,
      reason: `fontconfig is unavailable: ${error instanceof Error ? error.message : String(error)}`,
      styles: [],
    }
  }
}

/**
 * Answer one font-file request by streaming the resolved face, gzip-encoded
 * inside the response. `Cache-Control: no-transform` keeps the webserver's
 * compression middleware from encoding it a second time.
 * @param {import('node:http').IncomingMessage} request - node request.
 * @param {import('node:http').ServerResponse} response - node response.
 * @param {string} tail - URL tail after `<prefix>/`.
 * @returns {Promise<void>} resolves after the response ends.
 */
async function handleFace(request, response, tail) {
  try {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { allow: 'GET, HEAD' })
      response.end()
      return
    }
    const { family, style } = parseFaceRequest(tail)
    const face = await resolveFace(family, style)
    const accepted = String(request.headers?.['accept-encoding'] ?? '')
    const encoding = /(?:^|,)\s*br(?:\s*;|,|$)/u.test(accepted) ? 'br' : 'gzip'
    const { body, etag } = await loadFace(face.file, encoding)
    const headers = {
      'content-type': 'font/ttf',
      'content-encoding': encoding,
      'cache-control': 'public, max-age=86400, no-transform',
      etag,
      'content-length': String(body.length),
      'x-dsh-font-family': face.family,
    }
    if (request.headers?.['if-none-match'] === etag) {
      delete headers['content-encoding']
      delete headers['content-length']
      response.writeHead(304, headers)
      response.end()
      return
    }
    response.writeHead(200, headers)
    if (request.method === 'HEAD') response.end()
    else response.end(body)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const status = /unknown style|expected <family>|invalid family|malformed family/u.test(message) ? 400 : 404
    response.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    })
    response.end(JSON.stringify({ ok: false, error: message }))
  }
}

/**
 * Answer one font-catalog request.
 * @param {import('node:http').IncomingMessage} request - node request.
 * @param {import('node:http').ServerResponse} response - node response.
 * @returns {Promise<void>} resolves after the response ends.
 */
async function handleFonts(request, response) {
  const json = (status, value) => {
    response.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    })
    response.end(JSON.stringify(value))
  }
  try {
    if (request.method !== 'GET') {
      json(405, { ok: false, error: 'method not allowed' })
      return
    }
    const url = new URL(request.url ?? FONT_LIST_PATH, 'http://sidebar-terminal-enhance.local')
    const catalog = await fontCatalog({ refresh: url.searchParams.get('refresh') === '1' })
    const streaming = await streamingSupport()
    json(200, { ok: true, ...catalog, streaming })
  } catch (error) {
    json(500, { ok: false, error: error instanceof Error ? error.message : String(error) })
  }
}

/**
 * Mount the route.
 * @param {import('@deepseek-ai/cordis').Context} ctx - Host context.
 */
export function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: FONT_LIST_PATH,
    handler: (request, response) => handleFonts(request, response),
  }), 'sidebar-terminal-enhance: font catalog route')
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: FONT_FILE_PREFIX,
    handler: (request, response) => {
      const pathname = new URL(request.url ?? '/', 'http://sidebar-terminal-enhance.local').pathname
      const tail = pathname.slice(FONT_FILE_PREFIX.length + 1)
      return handleFace(request, response, tail)
    },
  }), 'sidebar-terminal-enhance: font face route')
}

export const __test = {
  FONT_FILE_PREFIX,
  FONT_LIST_PATH,
  decodeFamilySegment,
  loadFace,
  parseFaceRequest,
  resetFaceCache,
  resolveFace,
  streamingSupport,
  mergeFonts,
  parseFamilyLines,
  parseFontconfig,
  parseSystemProfiler,
  readHostFonts,
  resetFontCache,
}

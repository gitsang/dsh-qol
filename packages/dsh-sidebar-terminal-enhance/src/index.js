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
import { promisify } from 'node:util'

/** Promise face of execFile; the callback form cannot be awaited. */
const execFileAsync = promisify(execFile)

export const name = 'sidebar-terminal-enhance'
export const inject = ['webServer']

/** Same-origin endpoint owned by this package. */
export const FONT_LIST_PATH = '/sidebar-terminal-enhance/fonts'

/** How long one enumeration is reused before the route shells out again. */
const CACHE_TTL_MS = 10 * 60 * 1000
/** Command timeouts: fontconfig is fast, the macOS profiler is not. */
const COMMAND_TIMEOUT_MS = 15_000
/** Upper bound on families returned to the browser. */
const MAX_FONTS = 5_000

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
    json(200, { ok: true, ...catalog })
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
}

export const __test = {
  FONT_LIST_PATH,
  mergeFonts,
  parseFamilyLines,
  parseFontconfig,
  parseSystemProfiler,
  readHostFonts,
  resetFontCache,
}

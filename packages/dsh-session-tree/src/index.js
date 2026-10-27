/**
 * Host half of @gitsang/dsh-session-tree.
 *
 * Owns one same-origin route:
 *   GET  /session-tree?sessionId=<id>  -> connected branch family + own timeline rows
 *   POST /session-tree                -> fork / edit / retry / activate
 *
 * Branch creation delegates to the public Session Controller API. The client
 * never writes Session logs or opens a private kernel path.
 */

import {
  assembleFamily,
  buildTrajectoryEventIndex,
  editForkBoundary,
  eventSeqForChatNodeKey,
  extractOwnEvents,
  forkAfterBoundary,
  lastEventSeq,
} from './tree-data.js'

export const name = 'session-tree'
export const inject = ['webServer', 'sessionQuery', 'sessionController', 'workspaceRegistry', 'agents']

/** Same-origin endpoint owned by this package. */
export const SESSION_TREE_PATH = '/session-tree'
const MAX_FAMILY_SESSIONS = 100
const READ_CONCURRENCY = 4

function errorText(error) {
  return error instanceof Error ? error.message : String(error)
}

function mapConcurrent(items, worker, limit = READ_CONCURRENCY) {
  const results = new Array(items.length)
  let cursor = 0
  const run = async () => {
    for (;;) {
      const index = cursor
      cursor += 1
      if (index >= items.length) return
      results[index] = await worker(items[index], index)
    }
  }
  return Promise.all(Array.from({ length: Math.min(limit, Math.max(1, items.length)) }, run)).then(() => results)
}

function archivedIdSet(ctx) {
  try {
    const ids = ctx.workspaceRegistry?.archivedSessionIds
    return new Set(Array.isArray(ids) ? ids : [])
  } catch {
    return new Set()
  }
}

function headerMeta(header) {
  return {
    parentSessionId: typeof header?.parentSession === 'string' ? header.parentSession : null,
    createdAt: typeof header?.createdAt === 'number' ? header.createdAt : 0,
    cwd: typeof header?.cwd === 'string' ? header.cwd : null,
    origin: typeof header?.origin === 'string' ? header.origin : null,
    isSeeded: header?.isSeeded === true,
    agentPreset: typeof header?.agentPreset === 'string' ? header.agentPreset : null,
  }
}

async function readFamily(ctx, requestedId) {
  const records = await ctx.sessionQuery.listSessions()
  const family = assembleFamily(records, requestedId)
  if (family.ids.length === 0) {
    throw new TypeError(`session "${requestedId}" not found`)
  }
  const selected = family.ids.slice(0, MAX_FAMILY_SESSIONS)
  const archived = archivedIdSet(ctx)
  const sessions = await mapConcurrent(selected, async (id) => {
    const record = family.byId.get(id)
    const fallback = {
      sessionId: id,
      ...headerMeta(record?.header),
      archived: archived.has(id),
      inheritedEventCount: 0,
      forkAtSeq: null,
      lastSeq: -1,
      ownTurns: 0,
      events: [],
      eventIndex: {},
    }
    try {
      const snapshot = await ctx.sessionQuery.readSession(id)
      const inheritedEventCount = typeof snapshot.inheritedEventCount === 'number' ? snapshot.inheritedEventCount : 0
      const projected = extractOwnEvents(snapshot.events, inheritedEventCount)
      return {
        sessionId: id,
        ...headerMeta(snapshot.session ?? record?.header),
        archived: archived.has(id),
        inheritedEventCount,
        forkAtSeq: inheritedEventCount > 0 ? inheritedEventCount - 1 : null,
        lastSeq: projected.lastSeq,
        ownTurns: projected.ownTurns,
        events: projected.events,
        ...(id === requestedId ? { eventIndex: buildTrajectoryEventIndex(snapshot.events) } : {}),
      }
    } catch (error) {
      return { ...fallback, error: errorText(error) }
    }
  })
  return {
    sessionId: requestedId,
    rootId: family.rootId,
    truncated: family.ids.length > MAX_FAMILY_SESSIONS,
    totalSessions: family.ids.length,
    sessions,
  }
}

function requiredSessionId(value) {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError('sessionId must be a non-empty string')
  return value
}

function requiredSeq(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError('atSeq must be a non-negative safe integer')
  return value
}

/**
 * Resolve an exact durable event boundary from either a numeric seq or the
 * stable Chat row identity. The latter is what the browser actually has in
 * hand; it must never be parsed as a seq because it begins with the
 * Conversation definition-name length.
 */
function eventSeqFromRequest(events, body, field) {
  if (typeof body.chatNodeKey === 'string' && body.chatNodeKey.length > 0) {
    return eventSeqForChatNodeKey(events, body.chatNodeKey)
  }
  return requiredSeq(body[field])
}

async function readJson(request) {
  const decoder = new TextDecoder()
  let text = ''
  for await (const chunk of request) text += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true })
  text += decoder.decode()
  try {
    const value = JSON.parse(text)
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('request body must be a JSON object')
    return value
  } catch (error) {
    if (error instanceof TypeError && error.message === 'request body must be a JSON object') throw error
    throw new TypeError('request body must be valid JSON')
  }
}

function respondJson(response, status, value) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  response.end(JSON.stringify(value))
}

async function stopRunningSession(ctx, sessionId) {
  const agent = ctx.agents?.get(sessionId)
  try {
    await Promise.resolve(ctx.sessionController.cancel({ sessionId }))
  } catch {
    // Idle sessions reject cancellation; that is not an edit failure.
  }
  if (agent === undefined) return
  try {
    await Promise.race([
      agent.whenIdle(),
      new Promise((resolve) => setTimeout(resolve, 4000)),
    ])
  } catch {
    // A settling turn must not make the branch action fail.
  }
}

function sourceModelSelection(events) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const config = events[index]?.type === 'request/header' ? events[index].data?.header?.config : undefined
    if (typeof config?.provider === 'string' && typeof config?.model === 'string') {
      return {
        provider: config.provider,
        model: config.model,
        ...typeof config.reasoningEffort === 'string' ? { reasoningEffort: config.reasoningEffort } : {},
      }
    }
  }
  return undefined
}

async function inheritModel(ctx, childId, selection) {
  if (selection === undefined) return
  try {
    await ctx.sessionController.selectModel({ sessionId: childId, ...selection })
  } catch {
    // The forked Session remains usable with the Host default route.
  }
}

async function promptFreshBranch(ctx, childId, text, clientTimeZone) {
  // The Session Controller facade treats its second argument as the caller
  // lifetime and dereferences it before delegating. Omitting it leaves the
  // child forked but never prompts, so pass an explicit live signal.
  const lifetime = new AbortController()
  await ctx.sessionController.prompt({
    requestId: crypto.randomUUID(),
    sessionId: childId,
    mode: 'queue',
    content: [{ type: 'text', text }],
    ...typeof clientTimeZone === 'string' && clientTimeZone.length > 0 ? { clientTimeZone } : {},
  }, lifetime.signal)
}

async function createBranch(ctx, source, atSeq, body, promptText) {
  if (body.stopPrevious !== false) await stopRunningSession(ctx, source.sessionId)
  const fork = await ctx.sessionController.fork({ sessionId: source.sessionId, atSeq })
  const childId = fork.sessionId
  try {
    await inheritModel(ctx, childId, sourceModelSelection(source.events))
    if (promptText !== undefined) await promptFreshBranch(ctx, childId, promptText, body.clientTimeZone)
    return { sessionId: childId, atSeq, action: body.action }
  } catch (error) {
    const wrapped = new Error(errorText(error))
    wrapped.childSessionId = childId
    throw wrapped
  }
}

async function activateSession(ctx, sessionId) {
  const registry = ctx.workspaceRegistry
  if (registry === undefined) throw new Error('workspace registry is unavailable')
  if (!Array.isArray(registry.archivedSessionIds) || !registry.archivedSessionIds.includes(sessionId)) {
    return { sessionId, unarchived: false }
  }
  if (typeof registry.unarchiveSession === 'function') {
    await registry.unarchiveSession(sessionId)
    return { sessionId, unarchived: true }
  }
  if (typeof registry.enqueueOperation !== 'function'
    || typeof registry.requireState !== 'function'
    || typeof registry.setState !== 'function') {
    throw new Error('this DSH version exposes no way to unarchive a Session')
  }
  await registry.enqueueOperation(async () => {
    const state = registry.requireState()
    if (!state.archivedSessionIds.includes(sessionId)) return
    await registry.setState({
      ...state,
      archivedSessionIds: state.archivedSessionIds.filter((id) => id !== sessionId),
    })
  })
  return { sessionId, unarchived: true }
}

async function handlePost(ctx, body) {
  const action = body.action
  const sessionId = requiredSessionId(body.sessionId)
  if (action === 'activate') return activateSession(ctx, sessionId)
  if (action === 'fork') {
    const snapshot = typeof body.chatNodeKey === 'string' && body.chatNodeKey.length > 0
      ? await ctx.sessionQuery.readSession(sessionId)
      : undefined
    const atSeq = body.atSeq === undefined && body.chatNodeKey === undefined
      ? undefined
      : eventSeqFromRequest(snapshot?.events, body, 'atSeq')
    await stopRunningSession(ctx, sessionId)
    const fork = await ctx.sessionController.fork({ sessionId, ...atSeq === undefined ? {} : { atSeq } })
    return { sessionId: fork.sessionId, atSeq: atSeq ?? null, action }
  }
  const snapshot = await ctx.sessionQuery.readSession(sessionId)
  if (action === 'edit') {
    if (typeof body.text !== 'string' || body.text.trim() === '') throw new TypeError('text must be a non-empty string')
    const boundary = editForkBoundary(snapshot.events, eventSeqFromRequest(snapshot.events, body, 'eventSeq'))
    return createBranch(ctx, { sessionId, events: snapshot.events }, boundary.atSeq, body, body.text)
  }
  if (action === 'retry') {
    const boundary = editForkBoundary(snapshot.events, eventSeqFromRequest(snapshot.events, body, 'eventSeq'))
    return createBranch(ctx, { sessionId, events: snapshot.events }, boundary.atSeq, body, boundary.userText)
  }
  if (action === 'fork-last') {
    const atSeq = lastEventSeq(snapshot.events)
    if (atSeq < 0) throw new TypeError('this Session has no events to fork from')
    await stopRunningSession(ctx, sessionId)
    const fork = await ctx.sessionController.fork({ sessionId, atSeq })
    return { sessionId: fork.sessionId, atSeq, action }
  }
  throw new TypeError('action must be fork, fork-last, edit, retry, or activate')
}

async function handleRoute(ctx, request, response) {
  try {
    if (request.method === 'GET') {
      const url = new URL(request.url ?? SESSION_TREE_PATH, 'http://session-tree.local')
      respondJson(response, 200, await readFamily(ctx, requiredSessionId(url.searchParams.get('sessionId'))))
      return
    }
    if (request.method === 'POST') {
      respondJson(response, 200, await handlePost(ctx, await readJson(request)))
      return
    }
    response.writeHead(405)
    response.end()
  } catch (error) {
    const status = error instanceof TypeError ? 400 : 409
    respondJson(response, status, {
      error: errorText(error),
      ...typeof error?.childSessionId === 'string' ? { childSessionId: error.childSessionId } : {},
    })
  }
}

export function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: SESSION_TREE_PATH,
    handler: (request, response) => handleRoute(ctx, request, response),
  }), 'session-tree: HTTP route')
}

export const __test = {
  readFamily,
  handlePost,
  sourceModelSelection,
}

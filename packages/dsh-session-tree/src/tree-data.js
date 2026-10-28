/**
 * Pure session-tree projection helpers.
 *
 * The Host route owns transport and persistence; this module only folds raw
 * Session events into the compact shape the browser needs. Keeping it free of
 * Cordis and Node APIs makes the branch-boundary rules directly testable.
 */

/** Event types worth showing in the Timeline browser. */
const VISIBLE_EVENT_TYPES = new Set([
  'user/message',
  'assistant/message',
  'tool/call',
  'tool/result',
  'turn/end',
  'llm/retry',
  'compaction/summary',
])

/** Join every text block in an ordered content list. */
export function textFromContent(content) {
  if (!Array.isArray(content)) return ''
  return content
    .filter((part) => part !== null && typeof part === 'object' && part.type === 'text')
    .map((part) => typeof part.text === 'string' ? part.text : '')
    .join('\n')
}

/**
 * Longest Markdown source carried per row to the browser.
 *
 * The browser folds this source into the same bounded single-line preview the
 * native Trajectory ledger shows, so the Host keeps the original Markdown
 * instead of pre-collapsing it: a list or code block must still parse as such
 * on the other side. The cap only bounds the route payload for a large family.
 */
export const ROW_TEXT_CHARS = 600

/**
 * Bound one row's stored text while keeping its Markdown structure.
 * @param {unknown} text - raw message, argument, or result text.
 * @param {number} max - maximum stored characters.
 * @returns {string} the text, ending in an ellipsis when it was cut.
 */
export function previewSource(text, max = ROW_TEXT_CHARS) {
  const value = typeof text === 'string' ? text : ''
  return value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1))}…`
}

/** Join every reasoning block; Trajectory falls back to it when a message has no text. */
export function reasoningFromContent(content) {
  if (!Array.isArray(content)) return ''
  return content
    .filter((part) => part !== null && typeof part === 'object' && part.type === 'reasoning')
    .map((part) => typeof part.text === 'string' ? part.text : '')
    .join('\n')
}

/** Read the raw argument payload of one tool call event, whatever the field name. */
function toolCallArguments(data) {
  if (typeof data?.arguments === 'string') return data.arguments
  if (typeof data?.argsRaw === 'string') return data.argsRaw
  return ''
}

/** Read the recorded call id from either half of a tool exchange. */
function toolCallId(event) {
  const candidates = [
    event?.data?.callId,
    event?.data?.toolCallId,
    event?.data?.message?.toolCallId,
    event?.data?.message?.source?.callId,
  ]
  for (const value of candidates) {
    if (typeof value === 'string' && value.length > 0) return value
  }
  return null
}

/**
 * Fold one raw event into a renderable timeline row.
 * @param {object} event - durable Session event.
 * @param {{turn: number|null, step: number|null}} cursor - surrounding boundaries.
 * @returns {object|null} compact row, or null when the event adds no useful timeline node.
 */
export function describeEvent(event, cursor) {
  if (event === null || typeof event !== 'object') return null
  const base = {
    seq: event.seq,
    type: event.type,
    time: event.time,
    turn: cursor.turn,
    step: cursor.step,
  }
  switch (event.type) {
    case 'user/message': {
      const sourceKind = event.data?.source?.kind
      const text = textFromContent(event.data?.content)
      return {
        ...base,
        role: sourceKind === 'user' ? 'user' : 'context',
        text: previewSource(text),
        messageId: event.data?.id,
        sourceKind,
        editable: sourceKind === 'user' && text.trim() !== '',
      }
    }
    case 'assistant/message': {
      const blocks = event.data?.message?.content
      // A message that only calls tools has no answer text. Trajectory labels
      // that state instead of printing the call names, which already own their
      // own rows; thinking is the same fallback Trajectory previews.
      const text = textFromContent(blocks) || reasoningFromContent(blocks)
      const toolCallCount = Array.isArray(blocks)
        ? blocks.filter((block) => block !== null && typeof block === 'object' && block.type === 'tool-call').length
        : 0
      return {
        ...base,
        role: 'assistant',
        text: previewSource(text),
        toolCallCount,
        toolCallOnly: text.trim() === '' && toolCallCount > 0,
      }
    }
    case 'tool/call': {
      const name = typeof event.data?.name === 'string' && event.data.name !== '' ? event.data.name : 'tool'
      return {
        ...base,
        role: 'tool',
        toolName: name,
        // Trajectory previews the raw argument payload beside the tool name.
        text: previewSource(toolCallArguments(event.data)),
      }
    }
    case 'tool/result': {
      const message = event.data?.message
      const errorCode = event.data?.error?.code ?? message?.error?.code
      return {
        ...base,
        role: 'tool-result',
        text: previewSource(textFromContent(message?.content)),
        isError: message?.isError === true || event.data?.isError === true,
        errorCode: typeof errorCode === 'string' && errorCode !== '' ? errorCode : null,
      }
    }
    case 'turn/end':
      return {
        ...base,
        role: 'turn-end',
        text: typeof event.data?.reason?.kind === 'string' ? event.data.reason.kind : 'completed',
      }
    case 'llm/retry':
      return {
        ...base,
        role: 'retry',
        text: typeof event.data?.reason === 'string' ? event.data.reason : 'retry',
      }
    case 'compaction/summary':
      return {
        ...base,
        role: 'compaction',
        text: previewSource(textFromContent(event.data?.message?.content) || event.data?.summary || ''),
      }
    default:
      return null
  }
}

/**
 * Resolve the row identity the Trajectory table assigns to one durable event.
 *
 * Trajectory records do not all expose the same identity: user/context rows use
 * their event seq, assistant rows use turn+step, and tool rows use the call id.
 * Returning null means the event does not own a visible Trajectory row.
 *
 * @param {object} event - raw durable Session event.
 * @param {{turn: number|null, step: number|null}} cursor - surrounding boundaries.
 * @returns {string|null} stable Trajectory row key, or null.
 */
export function trajectoryEventKey(event, cursor = {}) {
  if (event === null || typeof event !== 'object' || !Number.isSafeInteger(event.seq)) return null
  switch (event.type) {
    case 'user/message': {
      const role = event.data?.source?.kind === 'user' ? 'user' : 'context'
      return `${role}\u0000seq\u0000${event.seq}`
    }
    case 'assistant/message': {
      const turn = typeof event.data?.turn === 'number' ? event.data.turn : cursor.turn
      const step = typeof event.data?.step === 'number' ? event.data.step : cursor.step
      return typeof turn === 'number' && typeof step === 'number'
        ? `assistant\u0000${turn}\u0000${step}`
        : null
    }
    case 'tool/call':
    case 'tool/result': {
      const callId = event.data?.callId
      return typeof callId === 'string' && callId.length > 0 ? `tool\u0000call\u0000${callId}` : null
    }
    default:
      return null
  }
}

/**
 * Index every visible Trajectory row in a complete Session log.
 *
 * Forked Sessions keep their inherited prefix in the log, so this index is
 * deliberately built from the complete log rather than only the child-owned
 * suffix. The browser uses the seq to place an inherited event on its owning
 * branch lane.
 *
 * @param {readonly object[]} events - complete raw Session log.
 * @returns {Record<string, {seq: number, type: string, turn: number|null, step: number|null}>}
 */
export function buildTrajectoryEventIndex(events) {
  const index = {}
  let turn = null
  let step = null
  for (const event of Array.isArray(events) ? events : []) {
    if (event === null || typeof event !== 'object') continue
    if (event.type === 'turn/start') {
      turn = typeof event.data?.turn === 'number' ? event.data.turn : turn
      step = null
    } else if (event.type === 'step/start') {
      step = typeof event.data?.step === 'number' ? event.data.step : step
    } else if (event.type === 'turn/end') {
      turn = typeof event.data?.turn === 'number' ? event.data.turn : turn
      step = null
    }
    const key = trajectoryEventKey(event, { turn, step })
    if (key === null || index[key] !== undefined) continue
    index[key] = {
      seq: event.seq,
      type: event.type,
      turn,
      step,
    }
  }
  return index
}

/**
 * Project the child-owned suffix of one Session log.
 *
 * A fork materializes its inherited prefix in the child log. Those inherited
 * events belong to the parent's branch, not to a new edge in the tree; only
 * events at or after `inheritedEventCount` are shown under the child card.
 *
 * @param {readonly object[]} events - complete raw log.
 * @param {number} inheritedEventCount - exact inherited prefix length.
 * @returns {{events: object[], lastSeq: number, ownTurns: number, firstOwnSeq: number|null}}
 */
export function extractOwnEvents(events, inheritedEventCount = 0) {
  const rows = []
  let turn = null
  let step = null
  let ownTurns = 0
  let firstOwnSeq = null
  /** Tool calls awaiting their result, keyed by the recorded call id. */
  const pendingCalls = new Map()
  const inherited = Math.max(0, Number.isSafeInteger(inheritedEventCount) ? inheritedEventCount : 0)
  for (const event of Array.isArray(events) ? events : []) {
    if (event === null || typeof event !== 'object') continue
    if (event.type === 'turn/start') {
      turn = typeof event.data?.turn === 'number' ? event.data.turn : turn
      step = null
      if (event.seq >= inherited) ownTurns += 1
    } else if (event.type === 'step/start') {
      step = typeof event.data?.step === 'number' ? event.data.step : step
    } else if (event.type === 'turn/end') {
      turn = typeof event.data?.turn === 'number' ? event.data.turn : turn
      step = null
    }
    if (event.seq < inherited) continue
    if (firstOwnSeq === null) firstOwnSeq = event.seq
    if (!VISIBLE_EVENT_TYPES.has(event.type)) continue
    const row = describeEvent(event, { turn, step })
    if (row === null) continue
    // The native Trajectory ledger draws one line per tool call and appends its
    // result as the `→ output` tail of that same line. Folding here keeps both
    // views reading one call+result exchange as one record, and the row's fork
    // boundary becomes the end of that exchange instead of its beginning: a
    // branch cut before the result would start with a dangling call that the
    // Host has to pad with a synthetic result.
    if (row.role === 'tool') {
      const callId = toolCallId(event)
      if (callId !== null) pendingCalls.set(callId, row)
    } else if (row.role === 'tool-result') {
      const callId = toolCallId(event)
      const call = callId === null ? undefined : pendingCalls.get(callId)
      if (call !== undefined) {
        call.result = {
          seq: row.seq,
          text: row.text,
          isError: row.isError === true,
          errorCode: row.errorCode ?? null,
        }
        // The row stands for the whole exchange; forking after it keeps the
        // result inside the copied prefix.
        if (Number.isSafeInteger(row.seq)) call.forkSeq = row.seq
        pendingCalls.delete(callId)
        continue
      }
    }
    rows.push(row)
  }
  return {
    events: rows,
    lastSeq: Array.isArray(events) && events.length > 0 ? events[events.length - 1].seq : -1,
    ownTurns,
    firstOwnSeq,
  }
}

/** Find one exact raw event. */
export function findEvent(events, seq) {
  return (Array.isArray(events) ? events : []).find((event) => event?.seq === seq)
}

/**
 * Build the stable Chat Context key for one durable user message.
 *
 * The Conversation engine keys an input context as
 * `<definition-kind-length>:<definition-kind><definition-local-id>` and exposes
 * that exact key as `data-chat-node-key` on the rendered row. Negotiation
 * messages use the `input-message` definition, whose local id is the durable
 * message id. Keeping this conversion on the Host lets the browser pass the
 * row identity back verbatim instead of guessing a sequence number from it.
 *
 * @param {object} event - raw durable Session event.
 * @returns {string|null} Chat Context key, or null for other events.
 */
export function chatNodeKey(event) {
  if (event?.type !== 'user/message') return null
  const id = event.data?.id
  if (typeof id !== 'string' && typeof id !== 'number') return null
  return `${'input-message'.length}:input-message${String(id)}`
}

/**
 * Resolve a Chat `data-chat-node-key` back to its durable event sequence.
 *
 * The row key is a Conversation Context key, not a Session seq. Parsing the
 * digits before `:` as a seq would read the definition-name length instead and
 * fork from an unrelated early event, so resolution must go through the full
 * event log.
 *
 * @param {readonly object[]} events - complete Session log.
 * @param {string} key - exact `data-chat-node-key` value.
 * @returns {number} durable seq of the matching user message.
 */
export function eventSeqForChatNodeKey(events, key) {
  if (typeof key !== 'string' || key.length === 0) throw new TypeError('chatNodeKey must be a non-empty string')
  for (const event of Array.isArray(events) ? events : []) {
    if (chatNodeKey(event) === key) {
      if (!Number.isSafeInteger(event.seq) || event.seq < 0) break
      return event.seq
    }
  }
  throw new TypeError(`chat node "${key}" does not resolve to a user message event`)
}

/**
 * Compute the fork boundary immediately before the Turn containing a user
 * message. Native `fork` takes an inclusive prefix, so the boundary is the
 * event before that Turn's `turn/start`.
 *
 * @param {readonly object[]} events - complete source log.
 * @param {number} userSeq - exact `user/message` event sequence.
 * @returns {{atSeq: number, turnStartSeq: number, userText: string, userEvent: object}}
 */
export function editForkBoundary(events, userSeq) {
  const list = Array.isArray(events) ? events : []
  const userIndex = list.findIndex((event) => event?.seq === userSeq)
  if (userIndex < 0) throw new TypeError(`event ${String(userSeq)} does not exist`)
  const userEvent = list[userIndex]
  if (userEvent.type !== 'user/message' || userEvent.data?.source?.kind !== 'user') {
    throw new TypeError('event is not a user message')
  }
  let turnIndex = -1
  for (let index = userIndex; index >= 0; index -= 1) {
    if (list[index]?.type === 'turn/start') {
      turnIndex = index
      break
    }
  }
  if (turnIndex < 0) throw new TypeError('user message is not inside a Turn')
  if (turnIndex === 0) throw new TypeError('the first Turn has no forkable prefix')
  const atSeq = list[turnIndex - 1].seq
  if (!Number.isSafeInteger(atSeq) || atSeq < 0) throw new TypeError('no forkable prefix before this Turn')
  return {
    atSeq,
    turnStartSeq: list[turnIndex].seq,
    userText: textFromContent(userEvent.data?.content),
    userEvent,
  }
}

/** Validate a positive exact-prefix boundary for the generic fork action. */
export function forkAfterBoundary(events, seq) {
  const event = findEvent(events, seq)
  if (event === undefined) throw new TypeError(`event ${String(seq)} does not exist`)
  return event.seq
}

/** The latest event sequence in a log. */
export function lastEventSeq(events) {
  return Array.isArray(events) && events.length > 0 ? events[events.length - 1].seq : -1
}

/**
 * Build the connected Session family around one requested Session.
 *
 * The host catalog can contain unrelated roots and subagent descendants. A
 * caller opening the tree wants the branch family rooted at the oldest known
 * ancestor of the requested Session, so this walks parents first and then
 * collects only reachable descendants.
 *
 * @param {readonly {header: object}[]} records - logical session records.
 * @param {string} requestedId - session currently displayed.
 * @returns {{rootId: string, ids: string[], byId: Map<string, object>, children: Map<string, string[]>}}
 */
export function assembleFamily(records, requestedId) {
  const list = Array.isArray(records) ? records : []
  const byId = new Map()
  for (const record of list) {
    const id = record?.header?.id
    if (typeof id === 'string') byId.set(id, record)
  }
  const requested = byId.get(requestedId)
  if (requested === undefined) {
    return { rootId: requestedId, ids: [], byId, children: new Map() }
  }
  let root = requested
  const seen = new Set()
  while (typeof root.header.parentSession === 'string' && !seen.has(root.header.id)) {
    seen.add(root.header.id)
    const parent = byId.get(root.header.parentSession)
    if (parent === undefined) break
    root = parent
  }
  const children = new Map()
  for (const record of byId.values()) {
    const parentId = record.header.parentSession
    if (typeof parentId !== 'string' || !byId.has(parentId)) continue
    const bucket = children.get(parentId)
    if (bucket === undefined) children.set(parentId, [record.header.id])
    else bucket.push(record.header.id)
  }
  for (const bucket of children.values()) {
    bucket.sort((left, right) => {
      const a = byId.get(left)?.header?.createdAt ?? 0
      const b = byId.get(right)?.header?.createdAt ?? 0
      return a - b || left.localeCompare(right)
    })
  }
  const ids = []
  const visited = new Set()
  const visit = (id) => {
    if (visited.has(id)) return
    const record = byId.get(id)
    if (record === undefined) return
    visited.add(id)
    ids.push(id)
    for (const child of children.get(id) ?? []) visit(child)
  }
  visit(root.header.id)
  return { rootId: root.header.id, ids, byId, children }
}

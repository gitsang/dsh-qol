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
 * Replay the durable Agent inbox up to one inclusive seq.
 *
 * A prompt is not published as `user/message` when it is submitted: the Agent
 * first records it as an `agent/inbox/spliced` insertion, and a later splice
 * claims it by removing it again. A forked Session resumes from that durable
 * projection, so a prefix that ends with a still-pending insertion makes the
 * child claim and emit that message as its own first Turn. Replaying the
 * splices is therefore the only way to know which prompts a fork boundary
 * would drag back into the child.
 *
 * The fold mirrors the Agent Loop's own projection: every splice applies
 * `start`/`removedCount`/`inserted` to its target queue, and `outcome`
 * changes only claim bookkeeping, never the pending list.
 *
 * @param {readonly object[]} events - complete source log.
 * @param {number} maxSeq - inclusive last seq to fold.
 * @returns {Map<string, {id: string, seq: number}>} pending message by id, valued with the seq that inserted it.
 */
export function pendingInboxAt(events, maxSeq) {
  const queues = { 'next-turn': [], 'next-step': [] }
  for (const event of Array.isArray(events) ? events : []) {
    if (event === null || typeof event !== 'object' || event.type !== 'agent/inbox/spliced') continue
    if (!Number.isSafeInteger(event.seq) || event.seq > maxSeq) continue
    const data = event.data
    const queue = queues[data?.target]
    if (queue === undefined) continue
    const start = Number.isSafeInteger(data.start) && data.start >= 0 ? Math.min(data.start, queue.length) : queue.length
    const removedCount = Number.isSafeInteger(data.removedCount) && data.removedCount > 0
      ? Math.min(data.removedCount, queue.length - start)
      : 0
    if (removedCount > 0) queue.splice(start, removedCount)
    const inserted = Array.isArray(data.inserted) ? data.inserted : []
    const entries = []
    for (const message of inserted) {
      if (typeof message?.id !== 'string' || message.id === '') continue
      entries.push({ id: message.id, seq: event.seq })
    }
    if (entries.length > 0) queue.splice(start, 0, ...entries)
  }
  const pending = new Map()
  for (const queue of Object.values(queues)) {
    for (const entry of queue) pending.set(entry.id, entry)
  }
  return pending
}

/**
 * Find the seq of the inbox splice that last admitted one durable message.
 *
 * A prompt can be admitted more than once: a canceled claim leaves the queue
 * untouched, so the Agent re-inserts the message on the next wake. The latest
 * admission is the one that produced the published `user/message`, so it is
 * the reservation an edit has to cut before.
 *
 * @param {readonly object[]} events - complete source log.
 * @param {unknown} messageId - durable `user/message` id.
 * @returns {number|null} latest admission seq, or null when the log records none.
 */
export function inboxAdmissionSeq(events, messageId) {
  if (typeof messageId !== 'string' || messageId === '') return null
  let latest = null
  for (const event of Array.isArray(events) ? events : []) {
    if (event === null || typeof event !== 'object' || event.type !== 'agent/inbox/spliced') continue
    if (!Number.isSafeInteger(event.seq)) continue
    const inserted = event.data?.inserted
    if (!Array.isArray(inserted)) continue
    if (inserted.some((message) => message?.id === messageId)) latest = event.seq
  }
  return latest
}

/**
 * Compute the fork boundary immediately before one user message was submitted.
 *
 * Native `fork` takes an inclusive prefix, so the boundary is the last event
 * the edit must not drag along. The documented rule is "before the Turn that
 * contains the message", but that is not sufficient on its own: a queued
 * prompt is admitted to the durable inbox *before* its Turn opens, so a cut
 * before `turn/start` copies the original message as still-pending inbox work.
 * A child resumed from that prefix claims the old prompt first, replays it as
 * its own Turn, and only then delivers the edit — and it also drags along any
 * prompt queued behind it.
 *
 * Because the maximum prefix is what the user asked for ("branch before this
 * Turn"), the boundary is the later of two cuts:
 *   - just before the owning `turn/start`, which keeps every completed Turn;
 *   - just before this message's inbox admission, which only matters for a
 *     steering message admitted mid-Turn, where it keeps the steps the Turn
 *     already ran.
 *
 * A prefix chosen that way can still end with unclaimed prompts — the original
 * message itself, and anything queued behind it. They are reported as
 * `danglingInbox` so the Host can retire them in the child before prompting;
 * that keeps the earlier Turns intact instead of rewinding past them.
 * `cleanAtSeq` is the deepest rewind that leaves no pending inbox work at all,
 * for a Host that cannot retire inbox items.
 *
 * @param {readonly object[]} events - complete source log.
 * @param {number} userSeq - exact `user/message` event sequence.
 * @returns {{atSeq: number, cleanAtSeq: number, danglingInbox: string[], turnStartSeq: number, userText: string, userEvent: object}}
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
  const turnStartSeq = list[turnIndex].seq
  const beforeTurn = turnIndex === 0 ? null : list[turnIndex - 1].seq
  const admissionSeq = inboxAdmissionSeq(list, userEvent.data?.id)
  const beforeAdmission = admissionSeq === null || admissionSeq <= 0 ? null : admissionSeq - 1
  let atSeq
  if (beforeTurn === null && beforeAdmission === null) throw new TypeError('the first Turn has no forkable prefix')
  atSeq = Math.max(beforeTurn ?? -1, beforeAdmission ?? -1)
  if (!Number.isSafeInteger(atSeq) || atSeq < 0) throw new TypeError('the first Turn has no forkable prefix')
  // Unclaimed prompts inside the prefix would be claimed and emitted by the
  // child as its own Turns; the Host retires them after forking.
  const danglingInbox = [...pendingInboxAt(list, atSeq).keys()]
  let cleanAtSeq = atSeq
  for (;;) {
    let earliest = null
    for (const entry of pendingInboxAt(list, cleanAtSeq).values()) {
      if (earliest === null || entry.seq < earliest) earliest = entry.seq
    }
    if (earliest === null) break
    if (earliest <= 0) throw new TypeError('no forkable prefix before this message')
    cleanAtSeq = earliest - 1
  }
  return {
    atSeq,
    cleanAtSeq,
    danglingInbox,
    turnStartSeq,
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

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

/** Clip a display preview without changing the stored message. */
export function clip(text, max = 220) {
  const value = typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : ''
  return value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1))}…`
}

/** Describe one tool argument payload without assuming it is valid JSON. */
function toolCallText(data) {
  const name = typeof data?.name === 'string' ? data.name : 'tool'
  const raw = typeof data?.arguments === 'string' ? data.arguments : ''
  return raw === '' ? name : `${name}(${clip(raw, 120)})`
}

/** Extract assistant text plus a compact marker for non-text blocks. */
function assistantText(blocks) {
  if (!Array.isArray(blocks)) return ''
  const text = textFromContent(blocks)
  const calls = blocks
    .filter((block) => block !== null && typeof block === 'object' && block.type === 'tool-call')
    .map((block) => `${block.name ?? 'tool'}(${clip(typeof block.argsRaw === 'string' ? block.argsRaw : '', 70)})`)
  return [text, ...calls].filter((part) => part !== '').join('\n')
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
        text: clip(text),
        messageId: event.data?.id,
        sourceKind,
        editable: sourceKind === 'user' && text.trim() !== '',
      }
    }
    case 'assistant/message':
      return {
        ...base,
        role: 'assistant',
        text: clip(assistantText(event.data?.message?.content)),
      }
    case 'tool/call':
      return {
        ...base,
        role: 'tool',
        text: clip(toolCallText(event.data)),
      }
    case 'tool/result':
      return {
        ...base,
        role: 'tool-result',
        text: clip(textFromContent(event.data?.message?.content)),
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
        text: clip(textFromContent(event.data?.message?.content) || event.data?.summary || ''),
      }
    default:
      return null
  }
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
    if (row !== null) rows.push(row)
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

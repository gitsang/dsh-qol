import test from 'node:test'
import assert from 'node:assert/strict'
import { __test } from '../src/index.js'

const events = [
  { seq: 0, type: 'session/end-seed', time: 0, data: {} },
  { seq: 1, type: 'turn/start', time: 1, data: { turn: 1 } },
  { seq: 2, type: 'user/message', time: 2, data: { id: 'm2', content: [{ type: 'text', text: 'old prompt' }], source: { kind: 'user' } } },
  { seq: 3, type: 'request/header', time: 3, data: { header: { config: { provider: 'p', model: 'm', reasoningEffort: 'high' } } } },
  { seq: 4, type: 'assistant/message', time: 4, data: { turn: 1, step: 1, message: { role: 'assistant', content: [{ type: 'text', text: 'answer' }] } } },
  { seq: 5, type: 'turn/end', time: 5, data: { turn: 1, reason: { kind: 'completed' } } },
]

/**
 * Build the fixture Host.
 *
 * `fork` and `updateQueue` mutate a simulated child log so the post-retirement
 * verification reads what a real forked Session would contain: the inherited
 * prefix plus an `agent/inbox/spliced` removal for every retired occurrence.
 * Passing `parentEvents` overrides the source log the route reads.
 */
function fixture(parentEvents = events) {
  const calls = { fork: [], prompt: [], selectModel: [], cancel: [], updateQueue: [] }
  let childEvents = null
  const ctx = {
    agents: { get: () => undefined },
    sessionController: {
      async fork(request) {
        calls.fork.push(request)
        const prefix = parentEvents.filter((event) => event.seq <= request.atSeq)
        childEvents = [
          ...prefix,
          { seq: request.atSeq + 1, type: 'session/end-seed', time: 0, data: { inherited: true } },
        ]
        return { sessionId: 'child-1' }
      },
      async prompt(request, signal) {
        // The real Session Controller dereferences this lifetime immediately.
        signal.throwIfAborted()
        calls.prompt.push(request)
        return { accepted: true }
      },
      async selectModel(request) {
        calls.selectModel.push(request)
        return { selected: request }
      },
      async updateQueue(request) {
        calls.updateQueue.push(request)
        const tail = childEvents[childEvents.length - 1].seq
        childEvents = [
          ...childEvents,
          { seq: tail + 1, type: 'agent/inbox/spliced', time: 0, data: { target: 'next-turn', start: 0, removedCount: 1 } },
        ]
        return { accepted: true }
      },
      cancel(request) {
        calls.cancel.push(request)
        return { accepted: true }
      },
    },
    sessionQuery: {
      async readSession(sessionId) {
        if (sessionId === 'child-1' && childEvents !== null) {
          return { session: { id: 'child-1' }, inheritedEventCount: 0, events: childEvents }
        }
        return { session: { id: 'root' }, inheritedEventCount: 0, events: parentEvents }
      },
    },
  }
  return { ctx, calls }
}

test('edit forks before the owning Turn and sends the edited prompt', async () => {
  const { ctx, calls } = fixture()
  const result = await __test.handlePost(ctx, {
    action: 'edit',
    sessionId: 'root',
    eventSeq: 2,
    text: 'edited prompt',
    stopPrevious: true,
    clientTimeZone: 'Asia/Shanghai',
  })
  assert.deepEqual(calls.fork, [{ sessionId: 'root', atSeq: 0 }])
  assert.equal(calls.prompt.length, 1)
  assert.equal(calls.prompt[0].sessionId, 'child-1')
  assert.deepEqual(calls.prompt[0].content, [{ type: 'text', text: 'edited prompt' }])
  assert.equal(calls.prompt[0].clientTimeZone, 'Asia/Shanghai')
  assert.deepEqual(calls.selectModel, [{ sessionId: 'child-1', provider: 'p', model: 'm', reasoningEffort: 'high' }])
  assert.deepEqual(result, { sessionId: 'child-1', atSeq: 0, action: 'edit' })
})

test('fork uses the exact inclusive atSeq without prompting', async () => {
  const { ctx, calls } = fixture()
  const result = await __test.handlePost(ctx, { action: 'fork', sessionId: 'root', atSeq: 3 })
  assert.deepEqual(calls.fork, [{ sessionId: 'root', atSeq: 3 }])
  assert.equal(calls.prompt.length, 0)
  assert.deepEqual(result, { sessionId: 'child-1', atSeq: 3, action: 'fork' })
})

test('fork-last resolves the durable tail sequence', async () => {
  const { ctx, calls } = fixture()
  await __test.handlePost(ctx, { action: 'fork-last', sessionId: 'root' })
  assert.deepEqual(calls.fork, [{ sessionId: 'root', atSeq: 5 }])
})

test('invalid edit payload is rejected before any Host mutation', async () => {
  const { ctx, calls } = fixture()
  await assert.rejects(
    __test.handlePost(ctx, { action: 'edit', sessionId: 'root', eventSeq: 2, text: '   ' }),
    /text must be a non-empty string/,
  )
  assert.equal(calls.fork.length, 0)
  assert.equal(calls.prompt.length, 0)
})

test('sourceModelSelection reads the latest request header route', () => {
  assert.deepEqual(__test.sourceModelSelection(events), { provider: 'p', model: 'm', reasoningEffort: 'high' })
  assert.equal(__test.sourceModelSelection([]), undefined)
})

test('readFamily returns a Trajectory row index only for the requested Session', async () => {
  const rootEvents = [
    { seq: 1, type: 'turn/start', time: 1, data: { turn: 1 } },
    { seq: 2, type: 'user/message', time: 2, data: { content: [{ type: 'text', text: 'root' }], source: { kind: 'user' } } },
    { seq: 3, type: 'turn/end', time: 3, data: { turn: 1, reason: { kind: 'completed' } } },
  ]
  const childEvents = [
    ...rootEvents,
    { seq: 4, type: 'turn/start', time: 4, data: { turn: 2 } },
    { seq: 5, type: 'user/message', time: 5, data: { content: [{ type: 'text', text: 'child' }], source: { kind: 'user' } } },
  ]
  const ctx = {
    workspaceRegistry: { archivedSessionIds: [] },
    sessionQuery: {
      async listSessions() {
        return [
          { header: { id: 'root', createdAt: 1 } },
          { header: { id: 'child', parentSession: 'root', createdAt: 2 } },
        ]
      },
      async readSession(sessionId) {
        return sessionId === 'root'
          ? { session: { id: 'root' }, inheritedEventCount: 0, events: rootEvents }
          : { session: { id: 'child' }, inheritedEventCount: 3, events: childEvents }
      },
    },
  }
  const family = await __test.readFamily(ctx, 'root')
  const root = family.sessions.find((session) => session.sessionId === 'root')
  const child = family.sessions.find((session) => session.sessionId === 'child')
  assert.equal(root.eventIndex['user\u0000seq\u00002'].seq, 2)
  assert.equal(child.eventIndex, undefined)
  assert.equal(child.forkAtSeq, 2)
})

test('edit resolves the Chat row key instead of reading its definition-name length as a seq', async () => {
  const { ctx, calls } = fixture()
  const rowKey = '13:input-messagem2'
  const result = await __test.handlePost(ctx, {
    action: 'edit',
    sessionId: 'root',
    chatNodeKey: rowKey,
    text: 'edited prompt',
    stopPrevious: true,
  })
  assert.deepEqual(calls.fork, [{ sessionId: 'root', atSeq: 0 }])
  assert.equal(calls.prompt.length, 1)
  assert.deepEqual(result, { sessionId: 'child-1', atSeq: 0, action: 'edit' })
})

test('fork resolves the Chat row key to the selected user event', async () => {
  const { ctx, calls } = fixture()
  const result = await __test.handlePost(ctx, {
    action: 'fork',
    sessionId: 'root',
    chatNodeKey: '13:input-messagem2',
  })
  assert.deepEqual(calls.fork, [{ sessionId: 'root', atSeq: 2 }])
  assert.deepEqual(result, { sessionId: 'child-1', atSeq: 2, action: 'fork' })
})

test('an unknown Chat row key is rejected before any Host mutation', async () => {
  const { ctx, calls } = fixture()
  await assert.rejects(
    __test.handlePost(ctx, { action: 'fork', sessionId: 'root', chatNodeKey: '13:input-messagemissing' }),
    /does not resolve to a user message event/,
  )
  assert.equal(calls.fork.length, 0)
})

test('a per-row fork boundary that names no stored event is rejected before cancelling', async () => {
  const { ctx, calls } = fixture()
  await assert.rejects(
    __test.handlePost(ctx, { action: 'fork', sessionId: 'root', atSeq: 999 }),
    /does not exist/,
  )
  assert.equal(calls.cancel.length, 0)
  assert.equal(calls.fork.length, 0)
})

test('a per-row fork accepts any durable event, not only a completed Turn', async () => {
  const { ctx, calls } = fixture()
  const result = await __test.handlePost(ctx, { action: 'fork', sessionId: 'root', atSeq: 3 })
  assert.deepEqual(calls.fork, [{ sessionId: 'root', atSeq: 3 }])
  assert.equal(calls.prompt.length, 0)
  assert.deepEqual(result, { sessionId: 'child-1', atSeq: 3, action: 'fork' })
})

/** A log where the edited prompt was queued into the inbox before its Turn. */
function queuedEvents() {
  return [
    { seq: 0, type: 'session/end-seed', time: 0, data: {} },
    { seq: 1, type: 'turn/start', time: 1, data: { turn: 1 } },
    { seq: 2, type: 'agent/inbox/spliced', time: 2, data: { target: 'next-turn', start: 0, removedCount: 1 } },
    { seq: 3, type: 'step/start', time: 3, data: { turn: 1, step: 1 } },
    { seq: 4, type: 'user/message', time: 4, data: { id: 'old', content: [{ type: 'text', text: 'old prompt' }], source: { kind: 'user' } } },
    { seq: 5, type: 'turn/end', time: 5, data: { turn: 1, reason: { kind: 'completed' } } },
    {
      seq: 6,
      type: 'agent/inbox/spliced',
      time: 6,
      data: { target: 'next-turn', start: 0, inserted: [{ id: 'edited', content: [{ type: 'text', text: 'old prompt' }], source: { kind: 'user' }, role: 'user' }] },
    },
    {
      seq: 7,
      type: 'agent/inbox/spliced',
      time: 7,
      data: { target: 'next-turn', start: 1, inserted: [{ id: 'queued', content: [{ type: 'text', text: 'later' }], source: { kind: 'user' }, role: 'user' }] },
    },
    { seq: 8, type: 'turn/start', time: 8, data: { turn: 2 } },
    { seq: 9, type: 'agent/inbox/spliced', time: 9, data: { target: 'next-turn', start: 0, removedCount: 1 } },
    { seq: 10, type: 'user/message', time: 10, data: { id: 'edited', content: [{ type: 'text', text: 'old prompt' }], source: { kind: 'user' } } },
    { seq: 11, type: 'turn/end', time: 11, data: { turn: 2, reason: { kind: 'completed' } } },
  ]
}

test('edit forks before its Turn and retires the inherited inbox occurrences in the child', async () => {
  const { ctx, calls } = fixture(queuedEvents())
  const result = await __test.handlePost(ctx, {
    action: 'edit',
    sessionId: 'root',
    chatNodeKey: '13:input-messageedited',
    text: 'rewritten',
    stopPrevious: true,
  })
  // The fork keeps Turn 1: it cuts at the event before the Turn that owns the
  // edited message.
  assert.deepEqual(calls.fork, [{ sessionId: 'root', atSeq: 7 }])
  // Both the edited message and the prompt queued behind it are still pending
  // in that prefix, so the child pins them away before it is prompted.
  assert.deepEqual(calls.updateQueue, [
    { sessionId: 'child-1', itemId: 'edited', action: { kind: 'remove' } },
    { sessionId: 'child-1', itemId: 'queued', action: { kind: 'remove' } },
  ])
  assert.equal(calls.prompt.length, 1)
  assert.deepEqual(calls.prompt[0].content, [{ type: 'text', text: 'rewritten' }])
  assert.deepEqual(result, { sessionId: 'child-1', atSeq: 7, action: 'edit' })
})

test('edit falls back to the clean cut when the Host exposes no queue mutation', async () => {
  const { ctx, calls } = fixture()
  delete ctx.sessionController.updateQueue
  const events = queuedEvents()
  ctx.sessionQuery.readSession = async () => ({ session: { id: 'root' }, inheritedEventCount: 0, events })
  const result = await __test.handlePost(ctx, {
    action: 'edit',
    sessionId: 'root',
    chatNodeKey: '13:input-messageedited',
    text: 'rewritten',
    stopPrevious: true,
  })
  // Without a way to retire the inherited occurrences, keeping the prefix at 7
  // would let the child replay the original prompt first. Cutting at the last
  // event before anything was queued (5) keeps the inbox empty instead.
  assert.deepEqual(calls.fork, [{ sessionId: 'root', atSeq: 5 }])
  assert.equal(calls.prompt.length, 1)
  assert.deepEqual(calls.prompt[0].content, [{ type: 'text', text: 'rewritten' }])
  assert.deepEqual(result, { sessionId: 'child-1', atSeq: 5, action: 'edit' })
})

test('an edit fails loudly instead of replaying the original prompt when retirement is ineffective', async () => {
  // A Host whose removal silently does nothing leaves the inherited occurrence
  // pending in the child. Prompting then would let the child claim the ORIGINAL
  // text first, so the action must fail rather than pretend it succeeded.
  const { ctx, calls } = fixture(queuedEvents())
  ctx.sessionController.updateQueue = async (request) => {
    calls.updateQueue.push(request)
    return { accepted: true }
  }
  await assert.rejects(
    __test.handlePost(ctx, {
      action: 'edit',
      sessionId: 'root',
      chatNodeKey: '13:input-messageedited',
      text: 'rewritten',
      stopPrevious: true,
    }),
    (error) => {
      assert.match(error.message, /still holds 2 inherited queued message/)
      assert.equal(error.childSessionId, 'child-1')
      return true
    },
  )
  assert.equal(calls.prompt.length, 0)
})

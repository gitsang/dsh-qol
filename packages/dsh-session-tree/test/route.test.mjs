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

function fixture() {
  const calls = { fork: [], prompt: [], selectModel: [], cancel: [] }
  const ctx = {
    agents: { get: () => undefined },
    sessionController: {
      async fork(request) {
        calls.fork.push(request)
        return { sessionId: 'child-1' }
      },
      async prompt(request) {
        calls.prompt.push(request)
        return { accepted: true }
      },
      async selectModel(request) {
        calls.selectModel.push(request)
        return { selected: request }
      },
      cancel(request) {
        calls.cancel.push(request)
        return { accepted: true }
      },
    },
    sessionQuery: {
      async readSession() {
        return { session: { id: 'root' }, inheritedEventCount: 0, events }
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

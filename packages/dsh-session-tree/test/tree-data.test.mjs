import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ROW_TEXT_CHARS,
  assembleFamily,
  buildTrajectoryEventIndex,
  chatNodeKey,
  describeEvent,
  editForkBoundary,
  eventSeqForChatNodeKey,
  extractOwnEvents,
  forkAfterBoundary,
  lastEventSeq,
  previewSource,
  textFromContent,
} from '../src/tree-data.js'

const user = (seq, text, turn) => ({
  seq,
  type: 'user/message',
  time: seq,
  data: { id: `m${seq}`, content: [{ type: 'text', text }], source: { kind: 'user' }, turn },
})
const assistant = (seq, text, turn) => ({
  seq,
  type: 'assistant/message',
  time: seq,
  data: { turn, step: 1, message: { role: 'assistant', content: [{ type: 'text', text }] } },
})

function log() {
  return [
    { seq: 0, type: 'session/end-seed', time: 0, data: {} },
    { seq: 1, type: 'turn/start', time: 1, data: { turn: 1 } },
    { seq: 2, type: 'step/start', time: 2, data: { turn: 1, step: 1 } },
    user(3, 'first question', 1),
    assistant(4, 'first answer', 1),
    { seq: 5, type: 'step/end', time: 5, data: { turn: 1, step: 1 } },
    { seq: 6, type: 'turn/end', time: 6, data: { turn: 1, reason: { kind: 'completed' } } },
    { seq: 7, type: 'turn/start', time: 7, data: { turn: 2 } },
    { seq: 8, type: 'step/start', time: 8, data: { turn: 2, step: 1 } },
    user(9, 'second question', 2),
    assistant(10, 'second answer', 2),
    { seq: 11, type: 'step/end', time: 11, data: { turn: 2, step: 1 } },
    { seq: 12, type: 'turn/end', time: 12, data: { turn: 2, reason: { kind: 'completed' } } },
  ]
}

test('textFromContent joins text blocks and ignores images and files', () => {
  assert.equal(textFromContent([
    { type: 'text', text: 'one' },
    { type: 'image', attachment: { id: 'img' } },
    { type: 'text', text: 'two' },
  ]), 'one\ntwo')
  assert.equal(textFromContent(undefined), '')
})

test('editForkBoundary cuts immediately before the turn that owns the user message', () => {
  const boundary = editForkBoundary(log(), 9)
  assert.equal(boundary.atSeq, 6)
  assert.equal(boundary.turnStartSeq, 7)
  assert.equal(boundary.userText, 'second question')
})

test('editForkBoundary rejects non-user and prefixed-only events', () => {
  assert.throws(() => editForkBoundary(log(), 10), /not a user message/)
  assert.throws(() => editForkBoundary(log(), 999), /does not exist/)
})

test('forkAfterBoundary validates the exact seq exists', () => {
  assert.equal(forkAfterBoundary(log(), 4), 4)
  assert.throws(() => forkAfterBoundary(log(), 400), /does not exist/)
  assert.equal(lastEventSeq(log()), 12)
})

test('extractOwnEvents omits inherited prefix and keeps displayable own rows', () => {
  const events = log()
  const projected = extractOwnEvents(events, 7)
  assert.deepEqual(projected.events.map((event) => event.seq), [9, 10, 12])
  assert.equal(projected.ownTurns, 1)
  assert.equal(projected.firstOwnSeq, 7)
  assert.equal(projected.lastSeq, 12)
  assert.equal(projected.events.find((event) => event.seq === 9).editable, true)
})

test('extractOwnEvents keeps a root log whole and counts its turns', () => {
  const projected = extractOwnEvents(log(), 0)
  assert.equal(projected.firstOwnSeq, 0)
  assert.equal(projected.ownTurns, 2)
  assert.equal(projected.events.filter((event) => event.role === 'user').length, 2)
})


test('Chat row keys resolve back to the exact durable user-message seq', () => {
  const events = log()
  const key = chatNodeKey(events[9])
  assert.equal(key, '13:input-messagem9')
  assert.equal(eventSeqForChatNodeKey(events, key), 9)
  assert.throws(() => eventSeqForChatNodeKey(events, '13:input-messagem999'), /does not resolve/)
})

test('describeEvent marks context messages as non-editable', () => {
  const row = describeEvent({
    seq: 3,
    type: 'user/message',
    time: 3,
    data: { content: [{ type: 'text', text: 'sampled time' }], source: { kind: 'system' } },
  }, { turn: 1, step: 1 })
  assert.equal(row.role, 'context')
  assert.equal(row.editable, false)
})

test('a tool call keeps the name and the raw argument payload apart', () => {
  const row = describeEvent({
    seq: 18,
    type: 'tool/call',
    time: 18,
    data: { turn: 1, step: 1, callId: 'call-a', name: 'bash', arguments: '{"command":"pwd && ls"}' },
  }, { turn: 1, step: 1 })
  assert.equal(row.role, 'tool')
  assert.equal(row.toolName, 'bash')
  assert.equal(row.text, '{"command":"pwd && ls"}')
  assert.equal(row.text.includes('bash('), false)
})

test('an assistant row drops the tool-call markers that own their own rows', () => {
  const row = describeEvent({
    seq: 17,
    type: 'assistant/message',
    time: 17,
    data: {
      turn: 1,
      step: 1,
      message: {
        role: 'assistant',
        content: [
          { type: 'text', text: '先看一下实现。' },
          { type: 'tool-call', id: 'call-a', name: 'bash', arguments: '{}' },
          { type: 'tool-call', id: 'call-b', name: 'glob', arguments: '{}' },
        ],
      },
    },
  }, { turn: 1, step: 1 })
  assert.equal(row.text, '先看一下实现。')
  assert.equal(row.toolCallCount, 2)
  assert.equal(row.toolCallOnly, false)
  assert.equal(row.text.includes('bash()'), false)
})

test('an assistant row with only tool calls is labelled instead of printing call names', () => {
  const row = describeEvent({
    seq: 18,
    type: 'assistant/message',
    time: 18,
    data: { turn: 1, step: 1, message: { content: [{ type: 'tool-call', name: 'bash', arguments: '{}' }] } },
  }, { turn: 1, step: 1 })
  assert.equal(row.text, '')
  assert.equal(row.toolCallOnly, true)
  assert.equal(row.toolCallCount, 1)
})

test('a message with only thinking previews that thinking like Trajectory', () => {
  const row = describeEvent({
    seq: 19,
    type: 'assistant/message',
    time: 19,
    data: { turn: 1, step: 1, message: { content: [{ type: 'reasoning', text: '想一想' }] } },
  }, { turn: 1, step: 1 })
  assert.equal(row.text, '想一想')
  assert.equal(row.toolCallOnly, false)
})

test('a failed tool result carries its error code for the ledger cell', () => {
  const row = describeEvent({
    seq: 396,
    type: 'tool/result',
    time: 396,
    data: {
      turn: 2,
      step: 27,
      message: { isError: true, content: [{ type: 'text', text: 'file changed since it was read' }] },
      error: { name: 'FsError', code: 'FS_STALE_VERSION' },
    },
  }, { turn: 2, step: 27 })
  assert.equal(row.role, 'tool-result')
  assert.equal(row.isError, true)
  assert.equal(row.errorCode, 'FS_STALE_VERSION')
  assert.equal(row.text, 'file changed since it was read')
})

test('previewSource bounds the Markdown without collapsing it', () => {
  const source = '# 标题\n\n- 一\n- 二'
  assert.equal(previewSource(source), source)
  const long = previewSource('x'.repeat(ROW_TEXT_CHARS + 100))
  assert.equal(long.length, ROW_TEXT_CHARS)
  assert.ok(long.endsWith('…'))
})

test('assembleFamily returns the root and every reachable descendant', () => {
  const records = [
    { header: { id: 'root', createdAt: 1 } },
    { header: { id: 'child-a', parentSession: 'root', createdAt: 2 } },
    { header: { id: 'child-b', parentSession: 'root', createdAt: 3 } },
    { header: { id: 'grand', parentSession: 'child-a', createdAt: 4 } },
    { header: { id: 'other-root', createdAt: 5 } },
    { header: { id: 'other-child', parentSession: 'other-root', createdAt: 6 } },
  ]
  const family = assembleFamily(records, 'grand')
  assert.equal(family.rootId, 'root')
  assert.deepEqual(family.ids, ['root', 'child-a', 'grand', 'child-b'])
  assert.deepEqual(family.children.get('root'), ['child-a', 'child-b'])
})

test('assembleFamily tolerates a missing requested session', () => {
  const family = assembleFamily([], 'missing')
  assert.equal(family.rootId, 'missing')
  assert.deepEqual(family.ids, [])
})


test('buildTrajectoryEventIndex maps every visible Trajectory row identity back to its seq', () => {
  const events = [
    ...log().slice(0, 5),
    {
      seq: 5,
      type: 'tool/call',
      time: 5,
      data: { turn: 1, step: 1, callId: 'call-a', name: 'bash', arguments: '{}' },
    },
    {
      seq: 6,
      type: 'tool/result',
      time: 6,
      data: { turn: 1, step: 1, callId: 'call-a', message: { content: [] } },
    },
  ]
  const index = buildTrajectoryEventIndex(events)
  assert.equal(index['user\u0000seq\u00003']?.seq, 3)
  assert.equal(index['assistant\u00001\u00001']?.seq, 4)
  assert.equal(index['tool\u0000call\u0000call-a']?.seq, 5)
  assert.equal(index['session/end-seed']?.seq, undefined)
})

test('a tool exchange folds into one Trajectory-style row that forks after its result', () => {
  const events = [
    { seq: 1, type: 'turn/start', time: 1, data: { turn: 1 } },
    { seq: 2, type: 'step/start', time: 2, data: { turn: 1, step: 1 } },
    {
      seq: 3,
      type: 'tool/call',
      time: 3,
      data: { turn: 1, step: 1, callId: 'call-a', name: 'bash', arguments: '{"command":"ls"}' },
    },
    {
      seq: 4,
      type: 'tool/result',
      time: 4,
      data: { turn: 1, step: 1, message: { toolCallId: 'call-a', content: [{ type: 'text', text: 'a.txt' }] } },
    },
  ]
  const { events: rows } = extractOwnEvents(events, 0)
  assert.equal(rows.length, 1, 'the call and its result are one ledger line')
  const [call] = rows
  assert.equal(call.role, 'tool')
  assert.equal(call.toolName, 'bash')
  assert.deepEqual(call.result, { seq: 4, text: 'a.txt', isError: false, errorCode: null })
  // The row's boundary is the end of the exchange: forking before the result
  // would copy a call the Host has to pad with a synthetic result.
  assert.equal(call.forkSeq, 4)
})

test('a failed tool exchange keeps the error code on the folded row', () => {
  const events = [
    { seq: 1, type: 'tool/call', time: 1, data: { turn: 1, step: 1, callId: 'call-b', name: 'read', arguments: '{}' } },
    {
      seq: 2,
      type: 'tool/result',
      time: 2,
      data: {
        turn: 1,
        step: 1,
        message: { toolCallId: 'call-b', isError: true, content: [{ type: 'text', text: 'gone' }] },
        error: { name: 'FsError', code: 'ENOENT' },
      },
    },
  ]
  const { events: rows } = extractOwnEvents(events, 0)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].result.isError, true)
  assert.equal(rows[0].result.errorCode, 'ENOENT')
  assert.equal(rows[0].forkSeq, 2)
})

test('a result whose call is not in the own window stays a standalone row', () => {
  const events = [
    {
      seq: 1,
      type: 'tool/result',
      time: 1,
      data: { turn: 1, step: 1, message: { toolCallId: 'call-gone', content: [{ type: 'text', text: 'orphan' }] } },
    },
    { seq: 2, type: 'tool/call', time: 2, data: { turn: 1, step: 1, callId: 'call-next', name: 'bash', arguments: '{}' } },
  ]
  const { events: rows } = extractOwnEvents(events, 0)
  assert.deepEqual(rows.map((row) => row.role), ['tool-result', 'tool'])
  assert.equal(rows[0].text, 'orphan')
  assert.equal(rows[1].result, undefined)
  assert.equal(rows[1].forkSeq, undefined)
})

test('two calls keep their own results', () => {
  const events = [
    { seq: 1, type: 'tool/call', time: 1, data: { turn: 1, step: 1, callId: 'a', name: 'bash', arguments: '{}' } },
    { seq: 2, type: 'tool/call', time: 2, data: { turn: 1, step: 1, callId: 'b', name: 'glob', arguments: '{}' } },
    { seq: 3, type: 'tool/result', time: 3, data: { turn: 1, step: 1, message: { toolCallId: 'b', content: [{ type: 'text', text: 'glob-out' }] } } },
    { seq: 4, type: 'tool/result', time: 4, data: { turn: 1, step: 1, message: { toolCallId: 'a', content: [{ type: 'text', text: 'bash-out' }] } } },
  ]
  const { events: rows } = extractOwnEvents(events, 0)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].toolName, 'bash')
  assert.equal(rows[0].result.text, 'bash-out')
  assert.equal(rows[0].forkSeq, 4)
  assert.equal(rows[1].toolName, 'glob')
  assert.equal(rows[1].result.text, 'glob-out')
  assert.equal(rows[1].forkSeq, 3)
})

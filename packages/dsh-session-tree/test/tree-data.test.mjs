import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assembleFamily,
  describeEvent,
  editForkBoundary,
  extractOwnEvents,
  forkAfterBoundary,
  lastEventSeq,
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

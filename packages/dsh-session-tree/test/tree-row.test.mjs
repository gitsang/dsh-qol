import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

/**
 * Load the browser half through the same ModuleLoader factory the Web bundle
 * uses, so the assertions below run against the shipped component rather than a
 * copied fixture.
 */
let exported = null
globalThis.window = {
  __ModuleLoader__: {
    load(definition) {
      assert.equal(definition.id, '@gitsang/dsh-session-tree')
      exported = definition.factory(createRequire(import.meta.url))
    },
  },
}
await import('../src/client.js')
const { __test } = exported

function rowFixture(overrides = {}) {
  return {
    kind: 'event',
    sessionId: 'root',
    lane: 0,
    event: { seq: 0, role: 'user', text: 'hello', turn: 1 },
    branchStart: false,
    parentLane: null,
    branchId: 'root',
    branchTitle: 'Root',
    branchForkAt: null,
    collapsible: false,
    collapsed: false,
    hiddenCount: 0,
    isMainline: true,
    isContinuation: false,
    rowPosition: 0,
    activeLanes: [0],
    pendingBranchEdges: [],
    ...overrides,
  }
}

function renderRow(row, extra = {}) {
  return renderToStaticMarkup(React.createElement(__test.TreeRow, {
    row,
    maxLane: 1,
    firstByLane: new Map([[0, 0], [1, 0]]),
    lastByLane: new Map([[0, 0], [1, 0]]),
    onToggle: () => {},
    onFork: () => {},
    forking: false,
    ...extra,
  }))
}

test('every durable tree row offers a fork at its own event', () => {
  const row = rowFixture({ sessionId: 'ancestor', event: { seq: 42, role: 'tool', text: 'bash(ls)', turn: 2 } })
  const html = renderRow(row)
  assert.match(html, /data-dst-row-fork="true"/)
  assert.match(html, /data-fork-session="ancestor"/)
  assert.match(html, /data-fork-seq="42"/)
  assert.match(html, /Fork after this event/)
  assert.equal(html.includes('disabled'), false)
})

test('a lane that belongs to another Session forks that Session, not the open one', () => {
  const html = renderRow(rowFixture({ sessionId: 'grandparent', lane: 1, isMainline: false }))
  assert.match(html, /data-fork-session="grandparent"/)
  assert.equal(html.includes('data-fork-session="current"'), false)
})

test('the synthetic placeholder of an empty branch offers no fork', () => {
  const html = renderRow(rowFixture({
    sessionId: 'child',
    event: { seq: 7, role: 'context', text: '', turn: null, synthetic: true },
  }))
  assert.equal(html.includes('data-dst-row-fork'), false)
  assert.match(html, /disabled=""/)
})

test('a row that is already forking is disabled until the Host answers', () => {
  const html = renderRow(rowFixture(), { forking: true })
  assert.match(html, /data-busy="true"/)
  assert.match(html, /disabled=""/)
})

test('rowForkRequest names the row Session and the inclusive durable seq', () => {
  assert.deepEqual(
    __test.rowForkRequest({ sessionId: 'root', event: { seq: 3 } }),
    { action: 'fork', sessionId: 'root', atSeq: 3 },
  )
  assert.equal(__test.rowForkRequest({ sessionId: 'root', event: { seq: 3, synthetic: true } }), null)
  assert.equal(__test.rowForkRequest({ sessionId: 'root', event: {} }), null)
  assert.equal(__test.rowForkRequest({ sessionId: 'root', event: { seq: -1 } }), null)
  assert.equal(__test.rowForkRequest({ event: { seq: 3 } }), null)
})

test('a row fork posts the owning Session and seq, then opens the child', async () => {
  const calls = { fetch: [], open: [] }
  const previous = globalThis.window.fetch
  globalThis.window.fetch = async (url, init) => {
    calls.fetch.push({ url, init })
    return { ok: true, json: async () => ({ sessionId: 'child-9', atSeq: 3, action: 'fork' }) }
  }
  try {
    const sessions = {
      refresh: async () => {},
      list: { getSnapshot: () => ({ byId: { 'child-9': { sessionId: 'child-9' } } }) },
    }
    const uiWorkspace = { openSession: (id) => calls.open.push(id) }
    const mutate = __test.makeMutation(sessions, uiWorkspace)
    const result = await mutate(__test.rowForkRequest({ sessionId: 'ancestor', event: { seq: 3 } }))
    assert.deepEqual(result, { sessionId: 'child-9', atSeq: 3, action: 'fork' })
    assert.equal(calls.fetch.length, 1)
    assert.equal(calls.fetch[0].url, '/session-tree')
    assert.equal(calls.fetch[0].init.method, 'POST')
    assert.deepEqual(JSON.parse(calls.fetch[0].init.body), { action: 'fork', sessionId: 'ancestor', atSeq: 3 })
    assert.deepEqual(calls.open, ['child-9'])
  } finally {
    if (previous === undefined) delete globalThis.window.fetch
    else globalThis.window.fetch = previous
  }
})

test('a parent-continuation row forks its ancestor even when it shares a seq with the trunk', () => {
  // root seq 3 continues on a side lane while the opened child owns its own
  // seq 3. Same number, different Session: the row decides.
  const data = {
    sessions: [
      {
        sessionId: 'root',
        parentSessionId: null,
        createdAt: 1,
        events: [
          { seq: 1, role: 'user', text: 'root ask', turn: 1 },
          { seq: 2, role: 'assistant', text: 'root answer', turn: 1 },
          { seq: 3, role: 'tool', text: 'bash(root)', turn: 1 },
        ],
      },
      {
        sessionId: 'child',
        parentSessionId: 'root',
        forkAtSeq: 2,
        createdAt: 2,
        events: [
          { seq: 3, role: 'user', text: 'child ask', turn: 2 },
          { seq: 4, role: 'assistant', text: 'child answer', turn: 2 },
        ],
      },
    ],
  }
  const list = { byId: { root: { displayTitle: 'Root' }, child: { displayTitle: 'Child' } } }
  const projection = __test.projectTree(data, 'child', new Set(), list)
  const continuation = projection.rows.filter((row) => row.isContinuation === true)
  assert.ok(continuation.length > 0, 'the parent Session continues on a side lane')
  for (const row of continuation) {
    assert.equal(row.sessionId, 'root')
    // The lane is labelled by its own Session title, never as "the mainline":
    // any branch can be opened and becomes lane 0.
    assert.equal(row.branchTitle, 'Root')
    assert.equal(row.isMainline, false)
    assert.deepEqual(__test.rowForkRequest(row), { action: 'fork', sessionId: 'root', atSeq: row.event.seq })
  }
  const trunk = projection.rows.filter((row) => row.lane === 0)
  assert.deepEqual(
    __test.rowForkRequest(trunk.find((row) => row.event.seq === 3)),
    { action: 'fork', sessionId: 'child', atSeq: 3 },
  )
})

test('every lane is labelled by its own Session title and none claims the mainline', () => {
  const data = {
    sessions: [
      {
        sessionId: 'root',
        parentSessionId: null,
        createdAt: 1,
        events: [
          { seq: 1, role: 'user', turn: 1 },
          { seq: 2, role: 'assistant', turn: 1 },
        ],
      },
      {
        sessionId: 'left',
        parentSessionId: 'root',
        forkAtSeq: 1,
        createdAt: 2,
        events: [{ seq: 2, role: 'user', turn: 2 }],
      },
      {
        sessionId: 'right',
        parentSessionId: 'root',
        forkAtSeq: 1,
        createdAt: 3,
        events: [{ seq: 2, role: 'user', turn: 2 }],
      },
    ],
  }
  const list = { byId: { root: { displayTitle: 'Root' }, left: { displayTitle: 'Left' }, right: { displayTitle: 'Right' } } }
  const titles = (sessionId) => {
    const rows = __test.projectTree(data, sessionId, new Set(), list).rows
    return rows.filter((row) => row.branchStart).map((row) => row.branchTitle)
  }
  // Each lane names its own Session; re-rooting only changes which lane is 0.
  assert.deepEqual(titles('left').sort(), ['Right', 'Root'])
  assert.deepEqual(titles('right').sort(), ['Left', 'Root'])
  assert.deepEqual(titles('root').sort(), ['Left', 'Right'])
})

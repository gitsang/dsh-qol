import assert from 'node:assert/strict'
import test from 'node:test'

import { apply } from '../src/index.js'

/** Build a command context that captures the registered handler. */
function harness({ presetsService, rootTerminals } = {}) {
  let handler
  const ctx = {
    commands: { register: (definition) => { handler = definition.handler } },
    get: (name) => {
      if (name === 'agentPresets') return presetsService
      if (name === 'terminals') return rootTerminals
      return undefined
    }
  }
  apply(ctx)
  assert.equal(typeof handler, 'function')
  return {
    run: (agent) => handler({ agent, rawInput: '', attachments: [], signal: new AbortController().signal })
  }
}

/** Agent whose scoped context resolves a terminal service. */
function agentWith(terminals) {
  return {
    id: 'session-1',
    ctx: { get: (name) => (name === 'terminals' ? terminals : undefined) }
  }
}

/** Terminal double that records kills and drops closed sessions. */
function fakeTerminals(ids = []) {
  const live = new Set(ids)
  const killed = []
  return {
    killed,
    list: () => [...live].map((sessionId) => ({ sessionId })),
    hasOwnerActivity: () => live.size > 0,
    kill: async (_owner, sessionId, reason) => {
      killed.push({ sessionId, reason })
      live.delete(sessionId)
      return true
    }
  }
}

test('closes every persistent PTY owned by the agent', async () => {
  const terminals = fakeTerminals(['pty-1', 'pty-2'])
  const { run, agent } = harness({ agentTerminals: terminals })
  const result = await run(agentWith(terminals))
  assert.equal(result.kind, 'success')
  assert.match(result.text, /Closed 2 persistent PTY sessions/)
  assert.deepEqual(terminals.killed, [
    { sessionId: 'pty-1', reason: 'requested by /reset-terminals' },
    { sessionId: 'pty-2', reason: 'requested by /reset-terminals' }
  ])
})

test('reports no sessions on an idle agent', async () => {
  const terminals = fakeTerminals()
  const { run } = harness({})
  const result = await run(agentWith(terminals))
  assert.equal(result.kind, 'success')
  assert.match(result.text, /No persistent PTY sessions/)
})

test('refuses to claim success while a spawn is unpublished', async () => {
  const terminals = { list: () => [], hasOwnerActivity: () => true, kill: async () => true }
  const { run } = harness({})
  const result = await run(agentWith(terminals))
  assert.equal(result.kind, 'error')
  assert.match(result.text, /still being created/)
})

test('reports cleanup failures and keeps the error detail', async () => {
  const terminals = {
    list: () => [{ sessionId: 'pty-9' }],
    hasOwnerActivity: () => true,
    kill: async () => { throw new Error('PTY cleanup failed') }
  }
  const { run } = harness({})
  const result = await run(agentWith(terminals))
  assert.equal(result.kind, 'error')
  assert.match(result.text, /pty-9: PTY cleanup failed/)
})

test('resolves the isolated preset realm before the scoped context', async () => {
  const realmTerminals = fakeTerminals(['pty-realm'])
  const scopedTerminals = fakeTerminals(['pty-scoped'])
  const presetsService = {
    serviceFor: (_agent, name) => (name === 'terminals' ? realmTerminals : undefined)
  }
  const { run } = harness({ presetsService })
  const result = await run(agentWith(scopedTerminals))
  assert.equal(result.kind, 'success')
  assert.deepEqual(realmTerminals.killed.map((entry) => entry.sessionId), ['pty-realm'])
  assert.deepEqual(scopedTerminals.killed, [])
})

test('falls back to the root context when the agent has no scoped service', async () => {
  const rootTerminals = fakeTerminals(['pty-root'])
  const { run } = harness({ rootTerminals })
  const result = await run({ id: 'session-2', ctx: { get: () => undefined } })
  assert.equal(result.kind, 'success')
  assert.deepEqual(rootTerminals.killed.map((entry) => entry.sessionId), ['pty-root'])
})

test('reports a missing terminal service instead of throwing', async () => {
  const { run } = harness({})
  const result = await run({ id: 'session-3', ctx: { get: () => undefined } })
  assert.equal(result.kind, 'error')
  assert.match(result.text, /terminal service is not available/)
})

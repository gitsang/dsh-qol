import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/client.js', import.meta.url), 'utf8')

test('user actions are injected beside the native Copy button, never by replacing the Chat renderer', () => {
  assert.equal(source.includes("slots.register(\n          { name: 'conversation.chat.node'"), false)
  assert.equal(source.includes("name: 'conversation.chat.node'"), false)
  assert.match(source, /copy\.insertAdjacentElement\('afterend', branch\)/)
  assert.match(source, /copy\.insertAdjacentElement\('afterend', edit\)/)
  assert.match(source, /data-dst-action/)
})

test('the injector mounts from the session header and cleans up its DOM', () => {
  assert.match(source, /name: 'conversation\.session\.header\.actions'/)
  assert.match(source, /observer\.disconnect\(\)/)
  assert.match(source, /removeInjected\(\)/)
})

test('editing forks before the owning Turn through the Host route', () => {
  assert.match(source, /action: 'edit'/)
  assert.match(source, /eventSeq: editor\.seq/)
  assert.match(source, /clientTimeZone: Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone/)
})

test('every Tree View action uses the standard dst-button size', () => {
  assert.equal(source.includes('dst-mini'), false)
  assert.match(source, /\.dst-button\{[^}]*font-size:12px/)
  assert.match(source, /\.dst-button\{[^}]*padding:4px 9px/)
})


test('the package no longer registers a Tree View conversation tab', () => {
  assert.equal(source.includes("name: 'conversation.view'"), false)
  assert.equal(source.includes("id: 'session-tree'"), false)
})

test('the inline graph injector mounts from the session header and cleans up', () => {
  assert.match(source, /id: 'session-tree-trajectory-graph'/)
  assert.match(source, /function TrajectoryGraphInjector/)
  assert.match(source, /table\.setAttribute\('data-dst-graph', 'on'\)/)
  assert.match(source, /tr\.dataset\.dstLane/)
})


test('ancestor lanes terminate at a fork and descendant icons indent one lane', () => {
  assert.match(source, /const LANE_STEP = 24/)
  assert.match(source, /--dst-lane-offset/)
  assert.match(source, /M\$\{fromX\} 0 C\$\{fromX\}/)
  assert.match(source, /spec\.forkFrom !== null.*!active\.has\(spec\.forkFrom\)/)
  assert.match(source, /parentHasLater/)
})

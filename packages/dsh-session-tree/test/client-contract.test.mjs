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

test('the branch tree injector mounts from the session header and cleans up', () => {
  assert.match(source, /id: 'session-tree-trajectory-graph'/)
  assert.match(source, /function TrajectoryGraphInjector/)
  assert.match(source, /tr\.dataset\.dstSynth = '1'/)
  assert.match(source, /const clearGraph/)
})

test('native Trajectory rows and pills are never restyled', () => {
  assert.equal(source.includes('data-dst-graph'), false)
  assert.equal(source.includes('--dst-lane-offset'), false)
  assert.equal(source.includes('dstg-rowGraph'), false)
  assert.match(source, /visibleBranchEvents/)
  assert.match(source, /collectNativeTemplates/)
  assert.match(source, /cleanPillClone/)
  assert.match(source, /dstg-treePrefix/)
})

test('only fork branches add tree connectors and indent their rows', () => {
  assert.match(source, /const TREE_GUIDE = '│   '/)
  assert.match(source, /const TREE_FIRST = '├⊟  '/)
  assert.match(source, /const TREE_LAST = '└⊟  '/)
  assert.match(source, /treePrefix\(branch\.depth, ancestorGuides, branch\.lastSibling/)
})

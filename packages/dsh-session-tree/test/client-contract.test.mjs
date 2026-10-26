import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/client.js', import.meta.url), 'utf8')

test('user actions are injected beside the native Copy button, never by replacing the Chat renderer', () => {
  assert.equal(source.includes("name: 'conversation.chat.node'"), false)
  assert.match(source, /copy\.insertAdjacentElement\('afterend', branch\)/)
  assert.match(source, /copy\.insertAdjacentElement\('afterend', edit\)/)
  assert.match(source, /data-dst-action/)
})

test('the user action injector mounts from the session header and cleans up its DOM', () => {
  assert.match(source, /name: 'conversation\.session\.header\.actions'/)
  assert.match(source, /observer\.disconnect\(\)/)
  assert.match(source, /removeInjected\(\)/)
})

test('editing forks before the owning Turn through the Host route', () => {
  assert.match(source, /action: 'edit'/)
  assert.match(source, /eventSeq: editor\.seq/)
  assert.match(source, /clientTimeZone: Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone/)
})

test('every action uses the standard dst-button size', () => {
  assert.equal(source.includes('dst-mini'), false)
  assert.match(source, /\.dst-button\{[^}]*font-size:12px/)
  assert.match(source, /\.dst-button\{[^}]*padding:4px 9px/)
})

test('the package registers a dedicated Tree conversation view', () => {
  assert.match(source, /name: 'conversation\.view'/)
  assert.match(source, /id: 'session-tree'/)
  assert.match(source, /order: 20/)
  assert.match(source, /label: \(\) => t\('tab'\)/)
  assert.match(source, /TreeView,/)
})

test('the inline Trajectory DOM injector is gone', () => {
  assert.equal(source.includes('TrajectoryGraphInjector'), false)
  assert.equal(source.includes('data-dst-synth'), false)
  assert.equal(source.includes('useTrajectoryPresent'), false)
  assert.equal(source.includes('renderRailPaths'), false)
  assert.equal(source.includes('useViewToggle'), false)
})

test('the tree is projected as lane-based branches with the current Session at lane 0', () => {
  assert.match(source, /function projectTree/)
  assert.match(source, /const laneById = new Map\(\[\[currentId, 0\]\]\)/)
  assert.match(source, /function treeVisibleEvents/)
  assert.match(source, /branchCount: laneById\.size/)
  assert.match(source, /activeLanes/)
})

test('branch rows reuse native Trajectory visual vocabulary', () => {
  assert.match(source, /className: 'dstt-kindTag'/)
  assert.match(source, /className: 'dstt-branchChip'/)
  assert.match(source, /className: 'dstt-turn'/)
  assert.match(source, /className: 'dstt-lane'/)
  assert.match(source, /className: 'dstt-node'/)
  assert.match(source, /data-toggle/)
})

test('expand and collapse fold descendants in the projection', () => {
  assert.match(source, /const isCollapsed = !isRoot && collapsed\.has\(sessionId\)/)
  assert.match(source, /if \(isCollapsed\) return branchRows/)
  assert.match(source, /countHidden/)
  assert.match(source, /branchExpand/)
  assert.match(source, /branchCollapse/)
})

test('the family projection is cached per Session', () => {
  assert.match(source, /const TREE_CACHE = new Map\(\)/)
  assert.match(source, /function cacheTree/)
  assert.match(source, /TREE_CACHE\.get\(sessionId\)/)
})


test('fork edges leave the shared parent point and descend in the child lane', () => {
  assert.match(source, /phase: index === anchorIndex \? 'stub'/)
  assert.match(source, /C\$\{parentX\} 22 \$\{childX\} 20 \$\{childX\} 24 L\$\{childX\} 30/)
  assert.match(source, /Siblings forked at the same event share one parent anchor/)
  assert.match(source, /if \(anchorRow === null && insertAt > 0\)/)
})

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

test('the selected Session path is projected as the mainline trunk', () => {
  assert.match(source, /function projectTree/)
  assert.match(source, /const path = chainTo\(data, currentId\)/)
  assert.match(source, /const rootId = path\[0\]\?\.sessionId \?\? currentId/)
  assert.match(source, /const buildMainline = \(sessionId, inheritedAnchorRow = null\) =>/)
  assert.match(source, /function treeVisibleEvents/)
  assert.match(source, /branchCount: byId\.size/)
  assert.match(source, /activeLanes/)
})

test('branch rows reuse native Trajectory visual vocabulary', () => {
  assert.match(source, /className: 'dstt-kindTag'/)
  assert.match(source, /className: 'dstt-branchChip'/)
  assert.match(source, /className: 'dstt-turnLabel'/)
  assert.match(source, /className: 'dstt-lane'/)
  assert.match(source, /className: 'dstt-node'/)
  assert.match(source, /data-toggle/)
})

test('expand and collapse fold side-branch descendants', () => {
  assert.match(source, /const isCollapsed = options\.isMainline !== true && collapsed\.has\(branchId\)/)
  assert.match(source, /if \(isCollapsed\) return rows/)
  assert.match(source, /countHiddenFrom/)
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
  assert.match(source, /forkAnchorRow/)
  assert.match(source, /pendingBranchEdges/)
})

test('a selected branch makes the old mainline continuation a side lane', () => {
  assert.match(source, /const pathChildId = pathNext\.get\(sessionId\)/)
  assert.match(source, /isContinuation: true/)
  assert.match(source, /excludeChildren: new Set\(\[pathChildId\]\)/)
  assert.match(source, /t\('continuation'\)/)
  assert.match(source, /Original mainline/)
  assert.match(source, /原主线继续/)
})

test('the conversation tab is now labelled 轨迹树 / Trajectory Tree', () => {
  assert.match(source, /tab: '轨迹树'/)
  assert.match(source, /tab: 'Trajectory Tree'/)
  assert.equal(source.includes("tab: 'Tree'"), false)
  assert.equal(source.includes("tab: '树视图'"), false)
})


test('every fork uses one anchor-based edge treatment', () => {
  assert.match(source, /const lastRowByLane = new Map\(\)/)
  assert.match(source, /row\.forkAnchorRow = fallback/)
  assert.equal(source.includes("if (row.branchStart && Number.isSafeInteger(row.parentLane) && !(row.pendingBranchEdges"), false)
})

test('turn labels sit inside the first row of each turn like Trajectory', () => {
  assert.equal(source.includes('function TreeTurnRow'), false)
  assert.match(source, /turnStart: row\.event\.turn/)
  assert.match(source, /className: 'dstt-turnLabel'/)
})

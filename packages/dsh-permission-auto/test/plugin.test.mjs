import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { apply, name } from '../src/index.js';

/**
 * Build a fake Host context around the two services this plugin wraps.
 *
 * @param {{ home?: string, autoAdmit?: boolean, defaultPreset?: string }} [options]
 * @returns the fake context plus the recorded call log and the preset service.
 */
function makeContext(options = {}) {
  const calls = [];
  const home = options.home ?? mkdtempSync(join(tmpdir(), 'dsh-permission-auto-'));
  const state = { preset: null, sandbox: null, approval: null, seeded: false };
  const presets = {
    autoAdmit: options.autoAdmit ?? true,
    get names() {
      return ['read-only', 'workspace-write', 'danger-full-access', ...(this.autoAdmit ? ['auto'] : [])];
    },
    catalog() {
      return {
        options: this.names.map((value) => ({ value, name: value })),
        defaultOptions: ['read-only', 'workspace-write', 'danger-full-access'].map((value) => ({ value, name: value })),
        defaultPreset: options.defaultPreset ?? 'workspace-write',
      };
    },
    permissionState() {
      return { ...state };
    },
    pinInitialPermission() {
      // Mimic the official pin: a fresh session gets the configured default.
      if (state.preset === null && state.sandbox === null && state.approval === null && !state.seeded) {
        calls.push(['pin']);
        state.preset = 'workspace-write';
        state.sandbox = 'workspace-write';
        state.approval = 'ask';
      }
    },
    set(_session, preset) {
      calls.push(['set', preset]);
      if (preset === 'auto' && !this.autoAdmit) throw new Error('permission: unknown preset "auto"');
      state.preset = preset;
      state.sandbox = 'danger-full-access';
      state.approval = 'ask';
    },
    current() {
      return state.preset ?? 'workspace-write';
    },
    emitCatalogChanged() {
      calls.push(['catalog-changed']);
    },
  };
  const settings = {
    describe() {
      return [{ ns: 'permission', schema: {}, value: { defaultPreset: options.defaultPreset ?? 'workspace-write' }, revision: 7 }];
    },
    async mutate(ns, ops, revision) {
      calls.push(['mutate', ns, ops, revision]);
      return undefined;
    },
    async update(ns, patch, revision) {
      calls.push(['update', ns, patch, revision]);
      return undefined;
    },
  };
  const listeners = [];
  const ctx = {
    permissionPresets: presets,
    get(key) {
      if (key === 'settings') return settings;
      if (key === 'profileContext') return { home, name: 'web' };
      return undefined;
    },
    on(event, handler, listenerOptions) {
      listeners.push({ event, handler, options: listenerOptions });
    },
    effect(fn) {
      const dispose = fn();
      ctx.disposers.push(dispose);
    },
    disposers: [],
    logger: { info() {}, warn() {} },
  };
  return { ctx, calls, presets, settings, listeners, home, state };
}

/** Reset one fake session's permission facts to "genuinely fresh". */
function resetFacts(state) {
  state.preset = null;
  state.sandbox = null;
  state.approval = null;
  state.seeded = false;
}

test('registers under the expected Cordis name', () => {
  assert.equal(name, 'permission-auto');
});

test('offers Auto review as a future-session default and announces the change', () => {
  const { ctx, calls, presets } = makeContext();
  apply(ctx);
  const catalog = presets.catalog();
  assert.deepEqual(catalog.defaultOptions.map((option) => option.value), ['read-only', 'workspace-write', 'danger-full-access', 'auto']);
  assert.equal(catalog.defaultOptions.at(-1).name, 'Auto review');
  assert.equal(catalog.defaultPreset, 'workspace-write');
  assert.ok(calls.some(([kind]) => kind === 'catalog-changed'), 'catalog change must be published for open Settings panels');
});

test('a stored Auto choice is reported back through settings.describe()', async () => {
  const { ctx, presets, settings, home } = makeContext();
  apply(ctx);
  await settings.mutate('permission', [{ op: 'set', path: ['defaultPreset'], value: 'auto' }], 7);
  const row = settings.describe().find((candidate) => candidate.ns === 'permission');
  assert.equal(row.value.defaultPreset, 'auto');
  assert.equal(presets.catalog().defaultPreset, 'auto');
  assert.equal(JSON.parse(readFileSync(join(home, 'permission-auto', 'web.json'), 'utf8')).defaultPreset, 'auto');
});

test('choosing Auto never reaches the permission namespace', async () => {
  const { ctx, calls, settings } = makeContext();
  apply(ctx);
  await settings.mutate('permission', [{ op: 'set', path: ['defaultPreset'], value: 'auto' }], 7);
  assert.equal(calls.filter(([kind]) => kind === 'mutate').length, 0, 'the write must be intercepted');
});

test('the merge-style update() path is intercepted too', async () => {
  const { ctx, calls, settings, home } = makeContext();
  apply(ctx);
  await settings.update('permission', { defaultPreset: 'auto' }, 7);
  assert.equal(calls.filter(([kind]) => kind === 'update').length, 0);
  assert.equal(JSON.parse(readFileSync(join(home, 'permission-auto', 'web.json'), 'utf8')).defaultPreset, 'auto');
});

test('switching back to a normal preset clears the stored choice and delegates the write', async () => {
  const { ctx, calls, settings, home } = makeContext();
  apply(ctx);
  await settings.mutate('permission', [{ op: 'set', path: ['defaultPreset'], value: 'auto' }], 7);
  await settings.mutate('permission', [{ op: 'set', path: ['defaultPreset'], value: 'read-only' }], 8);
  const delegated = calls.filter(([kind]) => kind === 'mutate');
  assert.equal(delegated.length, 1);
  assert.equal(delegated[0][2][0].value, 'read-only');
  assert.equal(JSON.parse(readFileSync(join(home, 'permission-auto', 'web.json'), 'utf8')).defaultPreset, '');
  assert.equal(settings.describe()[0].value.defaultPreset, 'workspace-write');
});

test('unsetting the default is treated as a normal-preset choice', async () => {
  const { ctx, calls, settings } = makeContext();
  apply(ctx);
  await settings.mutate('permission', [{ op: 'set', path: ['defaultPreset'], value: 'auto' }], 7);
  await settings.mutate('permission', [{ op: 'unset', path: ['defaultPreset'] }], 8);
  assert.equal(calls.filter(([kind]) => kind === 'mutate').length, 1);
});

test('writes to other namespaces and fields are untouched', async () => {
  const { ctx, calls, settings } = makeContext();
  apply(ctx);
  await settings.mutate('ui-theme', [{ op: 'set', path: ['preference'], value: 'dark' }], 1);
  await settings.mutate('permission', [{ op: 'set', path: ['presets', 'workspace-write'], value: {} }], 2);
  assert.equal(calls.filter(([kind]) => kind === 'mutate').length, 2);
});

test('the initial-permission pin is wrapped and adopts Auto for a fresh root session', async () => {
  const { ctx, calls, presets, settings, state } = makeContext();
  apply(ctx);
  await settings.mutate('permission', [{ op: 'set', path: ['defaultPreset'], value: 'auto' }], 7);
  resetFacts(state);
  presets.pinInitialPermission({ header: { origin: 'user', delegationDepth: 0 }, seq: 0 });
  assert.deepEqual(calls.filter(([kind]) => kind === 'set'), [['set', 'auto']]);
  assert.equal(state.preset, 'auto');
});

test('the fallback session/created listener adopts Auto when the pin is not wrapped', async () => {
  const { ctx, calls, settings, listeners, state } = makeContext();
  apply(ctx);
  await settings.mutate('permission', [{ op: 'set', path: ['defaultPreset'], value: 'auto' }], 7);
  const created = listeners.find((listener) => listener.event === 'session/created');
  assert.equal(created.options?.prepend, true, 'must run before the permission service pins its own default');
  resetFacts(state);
  created.handler({ header: { origin: 'user', delegationDepth: 0 }, seq: 0 });
  assert.deepEqual(calls.filter(([kind]) => kind === 'set'), [['set', 'auto']]);
});

test('both adoption paths are idempotent for the same session', async () => {
  const { ctx, calls, presets, settings, state } = makeContext();
  apply(ctx);
  await settings.mutate('permission', [{ op: 'set', path: ['defaultPreset'], value: 'auto' }], 7);
  resetFacts(state);
  const session = { header: { origin: 'user', delegationDepth: 0 }, seq: 0 };
  presets.pinInitialPermission(session);
  assert.deepEqual(calls.filter(([kind]) => kind === 'set'), [['set', 'auto']]);
});

test('delegated subagent sessions are left alone', async () => {
  const { ctx, calls, presets, settings, listeners, state } = makeContext();
  apply(ctx);
  await settings.mutate('permission', [{ op: 'set', path: ['defaultPreset'], value: 'auto' }], 7);
  const created = listeners.find((listener) => listener.event === 'session/created');
  resetFacts(state);
  const session = { header: { origin: 'subagent', delegationDepth: 1 }, seq: 0 };
  presets.pinInitialPermission(session);
  created.handler(session);
  assert.equal(calls.filter(([kind]) => kind === 'set').length, 0);
});

test('seeded sessions keep the preset they were left in', async () => {
  const { ctx, calls, presets, settings, listeners, state } = makeContext();
  apply(ctx);
  await settings.mutate('permission', [{ op: 'set', path: ['defaultPreset'], value: 'auto' }], 7);
  const created = listeners.find((listener) => listener.event === 'session/created');
  resetFacts(state);
  state.seeded = true;
  state.preset = 'read-only';
  state.sandbox = 'read-only';
  state.approval = 'ask';
  const session = { header: { origin: 'user', delegationDepth: 0 }, seq: 12 };
  presets.pinInitialPermission(session);
  created.handler(session);
  assert.equal(calls.filter(([kind]) => kind === 'set').length, 0);
});

test('nothing is offered while the Auto review integration is absent', () => {
  const { ctx, presets, settings } = makeContext({ autoAdmit: false });
  apply(ctx);
  assert.deepEqual(presets.catalog().defaultOptions.map((option) => option.value), ['read-only', 'workspace-write', 'danger-full-access']);
  assert.equal(settings.describe()[0].value.defaultPreset, 'workspace-write');
});

test('a stored Auto choice degrades to the real default when the integration disappears', async () => {
  const { ctx, presets, settings, home } = makeContext();
  apply(ctx);
  await settings.mutate('permission', [{ op: 'set', path: ['defaultPreset'], value: 'auto' }], 7);
  presets.autoAdmit = false;
  assert.equal(settings.describe()[0].value.defaultPreset, 'workspace-write');
  assert.equal(presets.catalog().defaultPreset, 'workspace-write');
  assert.equal(JSON.parse(readFileSync(join(home, 'permission-auto', 'web.json'), 'utf8')).defaultPreset, 'auto', 'the choice is remembered, not erased');
});

test('an unreadable state file falls back to stock behavior', async () => {
  const home = mkdtempSync(join(tmpdir(), 'dsh-permission-auto-'));
  const { mkdirSync } = await import('node:fs');
  mkdirSync(join(home, 'permission-auto'), { recursive: true });
  writeFileSync(join(home, 'permission-auto', 'web.json'), '{not json');
  const { ctx, presets } = makeContext({ home });
  apply(ctx);
  assert.equal(presets.catalog().defaultPreset, 'workspace-write');
  rmSync(home, { recursive: true, force: true });
});

test('a session listener failure is swallowed', async () => {
  const { ctx, presets, settings, listeners, state } = makeContext();
  apply(ctx);
  await settings.mutate('permission', [{ op: 'set', path: ['defaultPreset'], value: 'auto' }], 7);
  const created = listeners.find((listener) => listener.event === 'session/created');
  resetFacts(state);
  const broken = { header: { origin: 'user', delegationDepth: 0 }, get seq() { throw new Error('boom'); } };
  presets.pinInitialPermission(broken);
  assert.doesNotThrow(() => created.handler(broken));
});

test('disposal restores the wrapped services', () => {
  const { ctx, presets, settings } = makeContext();
  const pristineCatalog = presets.catalog;
  const pristineDescribe = settings.describe;
  const pristinePin = presets.pinInitialPermission;
  apply(ctx);
  assert.notEqual(presets.catalog, pristineCatalog);
  for (const dispose of ctx.disposers) dispose?.();
  assert.equal(presets.catalog, pristineCatalog);
  assert.equal(settings.describe, pristineDescribe);
  assert.equal(presets.pinInitialPermission, pristinePin);
});

test('an absent settings service leaves the catalog feature alive', () => {
  const home = mkdtempSync(join(tmpdir(), 'dsh-permission-auto-'));
  const presets = {
    names: ['workspace-write', 'auto'],
    catalog: () => ({ options: [], defaultOptions: [], defaultPreset: 'workspace-write' }),
  };
  const ctx = {
    permissionPresets: presets,
    get: (key) => (key === 'profileContext' ? { home, name: 'web' } : undefined),
    on() {},
    effect(fn) {
      fn();
    },
    logger: { info() {}, warn() {} },
  };
  assert.doesNotThrow(() => apply(ctx));
  assert.deepEqual(presets.catalog().defaultOptions.map((option) => option.value), ['auto']);
  rmSync(home, { recursive: true, force: true });
});

test('state is scoped per profile', async () => {
  const home = mkdtempSync(join(tmpdir(), 'dsh-permission-auto-'));
  const web = makeContext({ home });
  apply(web.ctx);
  await web.settings.mutate('permission', [{ op: 'set', path: ['defaultPreset'], value: 'auto' }], 7);
  assert.ok(existsSync(join(home, 'permission-auto', 'web.json')));

  const desktop = makeContext({ home });
  desktop.ctx.get = (key) => (key === 'settings' ? desktop.settings : key === 'profileContext' ? { home, name: 'desktop' } : undefined);
  apply(desktop.ctx);
  assert.equal(desktop.presets.catalog().defaultPreset, 'workspace-write', 'a different profile must not inherit the choice');
  rmSync(home, { recursive: true, force: true });
});

test('a choice saved under the pre-rename state directory is still honoured', async () => {
  const home = mkdtempSync(join(tmpdir(), 'dsh-permission-auto-'));
  const { mkdirSync } = await import('node:fs');
  mkdirSync(join(home, 'permission-auto-default'), { recursive: true });
  writeFileSync(join(home, 'permission-auto-default', 'web.json'), JSON.stringify({ defaultPreset: 'auto' }));
  const { ctx, presets, settings, state } = makeContext({ home });
  apply(ctx);
  assert.equal(presets.catalog().defaultPreset, 'auto');
  assert.equal(settings.describe()[0].value.defaultPreset, 'auto');
  resetFacts(state);
  presets.pinInitialPermission({ header: { origin: 'user', delegationDepth: 0 }, seq: 0 });
  assert.equal(state.preset, 'auto');
  rmSync(home, { recursive: true, force: true });
});

test('the current state directory wins over the legacy one', async () => {
  const home = mkdtempSync(join(tmpdir(), 'dsh-permission-auto-'));
  const { mkdirSync } = await import('node:fs');
  mkdirSync(join(home, 'permission-auto-default'), { recursive: true });
  mkdirSync(join(home, 'permission-auto'), { recursive: true });
  writeFileSync(join(home, 'permission-auto-default', 'web.json'), JSON.stringify({ defaultPreset: 'auto' }));
  writeFileSync(join(home, 'permission-auto', 'web.json'), JSON.stringify({ defaultPreset: '' }));
  const { ctx, presets } = makeContext({ home });
  apply(ctx);
  assert.equal(presets.catalog().defaultPreset, 'workspace-write');
  rmSync(home, { recursive: true, force: true });
});

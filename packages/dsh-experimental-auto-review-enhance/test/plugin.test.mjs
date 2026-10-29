import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { apply, CONFIG_PATH, inject, name } from '../src/index.js';

/**
 * Build a fake Host context around the two services this plugin wraps.
 *
 * @param {{ home?: string, autoAdmit?: boolean, defaultPreset?: string }} [options]
 * @returns the fake context plus the recorded call log and the preset service.
 */
function makeContext(options = {}) {
  const calls = [];
  const home = options.home ?? mkdtempSync(join(tmpdir(), 'dsh-experimental-auto-review-enhance-'));
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
  const llm = {
    calls: [],
    stream(options) {
      this.calls.push(options);
      return (async function* empty() {})();
    },
  };
  const listeners = [];
  const routes = [];
  const ctx = {
    permissionPresets: presets,
    llm,
    inject(_services, callback) {
      callback({
        webServer: {
          register(route) {
            routes.push(route);
            return () => {};
          },
        },
        effect(fn) {
          return fn();
        },
      });
    },
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
  return { ctx, calls, presets, settings, listeners, home, state, llm, routes };
}

/** Reset one fake session's permission facts to "genuinely fresh". */
function resetFacts(state) {
  state.preset = null;
  state.sandbox = null;
  state.approval = null;
  state.seeded = false;
}

test('registers under the expected Cordis name and waits for its services', () => {
  assert.equal(name, 'experimental-auto-review-enhance');
  assert.deepEqual(inject, ['permissionPresets', 'llm']);
});

test('the component page enables the Auto default without touching Settings', async () => {
  const { ctx, routes, home } = makeContext();
  apply(ctx);
  const initial = await callRoute(routes[0], 'GET');
  assert.deepEqual(initial, {
    status: 200,
    body: { defaultPreset: '', reviewLanguage: 'en', reviewReasonToModel: false, autoAvailable: true },
  });
  const accepted = await callRoute(routes[0], 'POST', { defaultPreset: 'auto' });
  assert.deepEqual(accepted, {
    status: 200,
    body: { defaultPreset: 'auto', reviewLanguage: 'en', reviewReasonToModel: false, autoAvailable: true },
  });
  assert.equal(JSON.parse(readFileSync(join(home, 'experimental-auto-review-enhance', 'web.json'), 'utf8')).defaultPreset, 'auto');
  rmSync(home, { recursive: true, force: true });
});

test('the config endpoint validates every field and merges partial writes', async () => {
  const { ctx, routes, home } = makeContext();
  apply(ctx);
  const invalidDefault = await callRoute(routes[0], 'POST', { defaultPreset: 'read-only' });
  assert.equal(invalidDefault.status, 400);
  const invalidLanguage = await callRoute(routes[0], 'POST', { reviewLanguage: 'fr' });
  assert.equal(invalidLanguage.status, 400);
  const invalidReasonToModel = await callRoute(routes[0], 'POST', { reviewReasonToModel: 'yes' });
  assert.equal(invalidReasonToModel.status, 400);
  const malformed = await callRoute(routes[0], 'POST');
  assert.equal(malformed.status, 400);

  await callRoute(routes[0], 'POST', { defaultPreset: 'auto' });
  const languageOnly = await callRoute(routes[0], 'POST', { reviewLanguage: 'zh' });
  assert.deepEqual(languageOnly, {
    status: 200,
    body: { defaultPreset: 'auto', reviewLanguage: 'zh', reviewReasonToModel: false, autoAvailable: true },
  });
  const reasonToModel = await callRoute(routes[0], 'POST', { reviewReasonToModel: true });
  assert.deepEqual(reasonToModel, {
    status: 200,
    body: { defaultPreset: 'auto', reviewLanguage: 'zh', reviewReasonToModel: true, autoAvailable: true },
  });
  const cleared = await callRoute(routes[0], 'POST', { defaultPreset: '' });
  assert.deepEqual(cleared, {
    status: 200,
    body: { defaultPreset: '', reviewLanguage: 'zh', reviewReasonToModel: true, autoAvailable: true },
  });
  assert.deepEqual(JSON.parse(readFileSync(join(home, 'experimental-auto-review-enhance', 'web.json'), 'utf8')), {
    defaultPreset: '',
    reviewLanguage: 'zh',
    reviewReasonToModel: true,
  });
  rmSync(home, { recursive: true, force: true });
});

test('the config endpoint refuses Auto while the integration is absent', async () => {
  const { ctx, routes, presets } = makeContext({ autoAdmit: false });
  apply(ctx);
  const initial = await callRoute(routes[0], 'GET');
  assert.deepEqual(initial, {
    status: 200,
    body: { defaultPreset: '', reviewLanguage: 'en', reviewReasonToModel: false, autoAvailable: false },
  });
  const rejected = await callRoute(routes[0], 'POST', { defaultPreset: 'auto' });
  assert.equal(rejected.status, 400);
  assert.equal(presets.catalog().defaultOptions.includes('auto'), false);
});

test('a stored Auto choice degrades to the real default when the integration disappears', async () => {
  const { ctx, routes, presets, home } = makeContext();
  apply(ctx);
  await callRoute(routes[0], 'POST', { defaultPreset: 'auto' });
  presets.autoAdmit = false;
  const snapshot = await callRoute(routes[0], 'GET');
  assert.deepEqual(snapshot.body, { defaultPreset: 'auto', reviewLanguage: 'en', reviewReasonToModel: false, autoAvailable: false });
  assert.equal(JSON.parse(readFileSync(join(home, 'experimental-auto-review-enhance', 'web.json'), 'utf8')).defaultPreset, 'auto', 'the choice is remembered, not erased');
  rmSync(home, { recursive: true, force: true });
});

test('the initial-permission pin is wrapped and adopts Auto for a fresh root session', async () => {
  const { ctx, calls, presets, routes, state } = makeContext();
  apply(ctx);
  await callRoute(routes[0], 'POST', { defaultPreset: 'auto' });
  resetFacts(state);
  presets.pinInitialPermission({ header: { origin: 'user', delegationDepth: 0 }, seq: 0 });
  assert.deepEqual(calls.filter(([kind]) => kind === 'set'), [['set', 'auto']]);
  assert.equal(state.preset, 'auto');
});

test('the fallback session/created listener adopts Auto when the pin is not wrapped', async () => {
  const { ctx, calls, routes, listeners, state } = makeContext();
  apply(ctx);
  await callRoute(routes[0], 'POST', { defaultPreset: 'auto' });
  const created = listeners.find((listener) => listener.event === 'session/created');
  assert.equal(created.options?.prepend, true, 'must run before the permission service pins its own default');
  resetFacts(state);
  created.handler({ header: { origin: 'user', delegationDepth: 0 }, seq: 0 });
  assert.deepEqual(calls.filter(([kind]) => kind === 'set'), [['set', 'auto']]);
});

test('both adoption paths are idempotent for the same session', async () => {
  const { ctx, calls, presets, routes, state } = makeContext();
  apply(ctx);
  await callRoute(routes[0], 'POST', { defaultPreset: 'auto' });
  resetFacts(state);
  const session = { header: { origin: 'user', delegationDepth: 0 }, seq: 0 };
  presets.pinInitialPermission(session);
  assert.deepEqual(calls.filter(([kind]) => kind === 'set'), [['set', 'auto']]);
});

test('delegated subagent sessions are left alone', async () => {
  const { ctx, calls, presets, routes, listeners, state } = makeContext();
  apply(ctx);
  await callRoute(routes[0], 'POST', { defaultPreset: 'auto' });
  const created = listeners.find((listener) => listener.event === 'session/created');
  resetFacts(state);
  const session = { header: { origin: 'subagent', delegationDepth: 1 }, seq: 0 };
  presets.pinInitialPermission(session);
  created.handler(session);
  assert.equal(calls.filter(([kind]) => kind === 'set').length, 0);
});

test('seeded sessions keep the preset they were left in', async () => {
  const { ctx, calls, presets, routes, listeners, state } = makeContext();
  apply(ctx);
  await callRoute(routes[0], 'POST', { defaultPreset: 'auto' });
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


test('an unreadable state file falls back to stock behavior', async () => {
  const home = mkdtempSync(join(tmpdir(), 'dsh-experimental-auto-review-enhance-'));
  const { mkdirSync } = await import('node:fs');
  mkdirSync(join(home, 'experimental-auto-review-enhance'), { recursive: true });
  writeFileSync(join(home, 'experimental-auto-review-enhance', 'web.json'), '{not json');
  const { ctx, routes } = makeContext({ home });
  apply(ctx);
  const snapshot = await callRoute(routes[0], 'GET');
  assert.deepEqual(snapshot.body, { defaultPreset: '', reviewLanguage: 'en', reviewReasonToModel: false, autoAvailable: true });
  rmSync(home, { recursive: true, force: true });
});

test('a session listener failure is swallowed', async () => {
  const { ctx, presets, routes, listeners, state } = makeContext();
  apply(ctx);
  await callRoute(routes[0], 'POST', { defaultPreset: 'auto' });
  const created = listeners.find((listener) => listener.event === 'session/created');
  resetFacts(state);
  const broken = { header: { origin: 'user', delegationDepth: 0 }, get seq() { throw new Error('boom'); } };
  presets.pinInitialPermission(broken);
  assert.doesNotThrow(() => created.handler(broken));
});

test('disposal restores the wrapped preset method', () => {
  const { ctx, presets } = makeContext();
  const pristinePin = presets.pinInitialPermission;
  apply(ctx);
  assert.notEqual(presets.pinInitialPermission, pristinePin);
  for (const dispose of ctx.disposers) dispose?.();
  assert.equal(presets.pinInitialPermission, pristinePin);
});

test('an absent web server leaves the session feature alive', () => {
  const home = mkdtempSync(join(tmpdir(), 'dsh-experimental-auto-review-enhance-'));
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
  rmSync(home, { recursive: true, force: true });
});

test('state is scoped per profile', async () => {
  const home = mkdtempSync(join(tmpdir(), 'dsh-experimental-auto-review-enhance-'));
  const web = makeContext({ home });
  apply(web.ctx);
  await callRoute(web.routes[0], 'POST', { defaultPreset: 'auto' });
  assert.ok(existsSync(join(home, 'experimental-auto-review-enhance', 'web.json')));

  const desktop = makeContext({ home });
  desktop.ctx.get = (key) => (key === 'profileContext' ? { home, name: 'desktop' } : undefined);
  apply(desktop.ctx);
  const snapshot = await callRoute(desktop.routes[0], 'GET');
  assert.equal(snapshot.body.defaultPreset, '', 'a different profile must not inherit the choice');
  rmSync(home, { recursive: true, force: true });
});

test('a choice saved under the pre-rename state directory is still honoured', async () => {
  const home = mkdtempSync(join(tmpdir(), 'dsh-experimental-auto-review-enhance-'));
  const { mkdirSync } = await import('node:fs');
  mkdirSync(join(home, 'permission-auto'), { recursive: true });
  writeFileSync(join(home, 'permission-auto', 'web.json'), JSON.stringify({ defaultPreset: 'auto' }));
  const { ctx, presets, routes, state } = makeContext({ home });
  apply(ctx);
  const snapshot = await callRoute(routes[0], 'GET');
  assert.equal(snapshot.body.defaultPreset, 'auto');
  resetFacts(state);
  presets.pinInitialPermission({ header: { origin: 'user', delegationDepth: 0 }, seq: 0 });
  assert.equal(state.preset, 'auto');
  rmSync(home, { recursive: true, force: true });
});

test('the current state directory wins over the legacy one', async () => {
  const home = mkdtempSync(join(tmpdir(), 'dsh-experimental-auto-review-enhance-'));
  const { mkdirSync } = await import('node:fs');
  mkdirSync(join(home, 'permission-auto'), { recursive: true });
  mkdirSync(join(home, 'experimental-auto-review-enhance'), { recursive: true });
  writeFileSync(join(home, 'permission-auto', 'web.json'), JSON.stringify({ defaultPreset: 'auto' }));
  writeFileSync(join(home, 'experimental-auto-review-enhance', 'web.json'), JSON.stringify({ defaultPreset: '' }));
  const { ctx, routes } = makeContext({ home });
  apply(ctx);
  const snapshot = await callRoute(routes[0], 'GET');
  assert.deepEqual(snapshot.body, { defaultPreset: '', reviewLanguage: 'en', reviewReasonToModel: false, autoAvailable: true });
  rmSync(home, { recursive: true, force: true });
});


/** Invoke one registered route with a small fake request and response. */
async function callRoute(route, method, body) {
  const request = {
    method,
    url: CONFIG_PATH,
    async *[Symbol.asyncIterator]() {
      if (body !== undefined) yield JSON.stringify(body);
    },
  };
  const response = {
    status: 0,
    headers: {},
    payload: '',
    writeHead(status, headers = {}) {
      this.status = status;
      this.headers = headers;
    },
    end(text = '') {
      this.payload = text;
    },
  };
  await route.handler(request, response);
  return { status: response.status, body: response.payload === '' ? undefined : JSON.parse(response.payload) };
}

/** Prompt text that the shipped Auto review classifier sends. */
const AUTO_SYSTEM = 'REVIEW_POLICY\nYou are the final authorization reviewer.\n\nFor any allow, end with exactly two members.';

test('registers the configuration endpoint at its own same-origin path', () => {
  const { ctx, routes } = makeContext();
  apply(ctx);
  assert.equal(routes.length, 1);
  assert.equal(routes[0].kind, 'exact');
  assert.equal(routes[0].path, CONFIG_PATH);
});

test('Chinese reviewer language appends a reason-only instruction to Auto review requests', async () => {
  const { ctx, llm, routes } = makeContext();
  apply(ctx);
  await callRoute(routes[0], 'POST', { reviewLanguage: 'zh' });
  const autoRequest = { provider: 'p', model: 'm', system: AUTO_SYSTEM, messages: [] };
  llm.stream(autoRequest);
  assert.match(llm.calls[0].system, /^REVIEW_POLICY\n/);
  assert.match(llm.calls[0].system, /Simplified Chinese/);
  assert.match(llm.calls[0].system, /"reason" member/);
  assert.match(llm.calls[0].system, /do not translate the protocol/);
  assert.ok(llm.calls[0].system.indexOf('Simplified Chinese') < llm.calls[0].system.indexOf('For any allow'), 'the language directive must precede the final output rule');
  assert.equal(autoRequest.system, AUTO_SYSTEM, 'the caller request must not be mutated');
});

test('the Chinese reviewer instruction never leaks into unrelated LLM calls', async () => {
  const { ctx, llm, routes } = makeContext();
  apply(ctx);
  await callRoute(routes[0], 'POST', { reviewLanguage: 'zh' });
  const unrelated = { provider: 'p', model: 'm', system: 'You are a helpful assistant.', messages: [] };
  llm.stream(unrelated);
  assert.equal(llm.calls[0], unrelated);
});

test('English reviewer language leaves the Auto review policy byte-for-byte intact', () => {
  const { ctx, llm } = makeContext();
  apply(ctx);
  const autoRequest = { provider: 'p', model: 'm', system: AUTO_SYSTEM, messages: [] };
  llm.stream(autoRequest);
  assert.equal(llm.calls[0], autoRequest);
});

test('changing the language preserves the stored Auto default', async () => {
  const { ctx, routes, home } = makeContext();
  apply(ctx);
  await callRoute(routes[0], 'POST', { defaultPreset: 'auto' });
  await callRoute(routes[0], 'POST', { reviewLanguage: 'zh' });
  assert.deepEqual(JSON.parse(readFileSync(join(home, 'experimental-auto-review-enhance', 'web.json'), 'utf8')), {
    defaultPreset: 'auto',
    reviewLanguage: 'zh',
  });
  rmSync(home, { recursive: true, force: true });
});

test('changing the Auto default preserves the stored reviewer language', async () => {
  const { ctx, routes, home } = makeContext();
  apply(ctx);
  await callRoute(routes[0], 'POST', { reviewLanguage: 'zh' });
  await callRoute(routes[0], 'POST', { defaultPreset: 'auto' });
  assert.deepEqual(JSON.parse(readFileSync(join(home, 'experimental-auto-review-enhance', 'web.json'), 'utf8')), {
    defaultPreset: 'auto',
    reviewLanguage: 'zh',
  });
  rmSync(home, { recursive: true, force: true });
});

test('disposal restores the LLM stream method', () => {
  const { ctx, llm } = makeContext();
  const pristine = llm.stream;
  apply(ctx);
  assert.notEqual(llm.stream, pristine);
  for (const dispose of ctx.disposers) dispose?.();
  assert.equal(llm.stream, pristine);
});

/** Invoke the single listener the plugin registered for one event. */
function listenerFor(listeners, event) {
  const matching = listeners.filter((listener) => listener.event === event);
  assert.equal(matching.length, 1, `expected exactly one ${event} listener`);
  return matching[0].handler;
}

/** One final reviewer denial as the tool pipeline materializes it. */
function autoReviewDenialResult(reason) {
  const message = 'Auto review rejected tool "bash"; its body was not executed';
  return {
    isError: true,
    content: [{ type: 'text', text: `Error: ${message}` }],
    error: {
      message,
      info: {
        name: 'AutoReviewDeniedError',
        code: 'AUTO_REVIEW_DENIED',
        ...reason === undefined ? {} : { reason },
      },
    },
  };
}

/** One user rejection of the approval prompt Auto review raised. */
function userRejectedResult() {
  const message = 'the user rejected tool "bash"';
  return { isError: true, content: [{ type: 'text', text: `Error: ${message}` }], error: { message } };
}

/** Accept every downstream post-execute decision. */
const acceptEverything = async () => ({ kind: 'accept' });

test('the reviewer-reason observers prepend so a claiming answerer cannot hide the event', () => {
  const { ctx, listeners } = makeContext();
  apply(ctx);
  for (const event of ['approval/request', 'tools/post-execute']) {
    const matching = listeners.filter((listener) => listener.event === event);
    assert.equal(matching.length, 1, `expected exactly one ${event} listener`);
    assert.equal(matching[0].options?.prepend, true, `${event} must run before shipped chain participants`);
  }
});

test('an opted-in final reviewer denial carries its reason into the model-facing error', async () => {
  const { ctx, listeners, routes } = makeContext();
  apply(ctx);
  await callRoute(routes[0], 'POST', { reviewReasonToModel: true });
  const postExecute = listenerFor(listeners, 'tools/post-execute');
  const result = autoReviewDenialResult('Deletes production data');
  const decision = await postExecute({ name: 'bash', callId: 'call-1' }, result, acceptEverything);
  assert.equal(decision.kind, 'accept');
  assert.equal(decision.content.length, 1);
  assert.equal(
    decision.content[0].text,
    'Error: Auto review rejected tool "bash"; its body was not executed\nAuto review\'s reason: Deletes production data',
  );
  assert.equal(result.content[0].text.includes('Deletes production data'), false, 'the input result must not be mutated');
});

test('the reason stays out of model-facing content while the option is off', async () => {
  const { ctx, listeners } = makeContext();
  apply(ctx);
  const postExecute = listenerFor(listeners, 'tools/post-execute');
  const decision = await postExecute({ name: 'bash', callId: 'call-1' }, autoReviewDenialResult('Deletes production data'), acceptEverything);
  assert.deepEqual(decision, { kind: 'accept' });
});

test('unrelated tool failures and other post-execute decisions are untouched', async () => {
  const { ctx, listeners, routes } = makeContext();
  apply(ctx);
  await callRoute(routes[0], 'POST', { reviewReasonToModel: true });
  const postExecute = listenerFor(listeners, 'tools/post-execute');
  const syntax = {
    isError: true,
    content: [{ type: 'text', text: 'Error: unexpected end of file' }],
    error: { message: 'unexpected end of file' },
  };
  assert.deepEqual(await postExecute({ name: 'bash', callId: 'call-1' }, syntax, acceptEverything), { kind: 'accept' });
  const blocked = async () => ({ kind: 'block', feedback: [{ type: 'text', text: 'blocked' }] });
  const denial = autoReviewDenialResult('Deletes production data');
  assert.deepEqual(await postExecute({ name: 'bash', callId: 'call-2' }, denial, blocked), { kind: 'block', feedback: [{ type: 'text', text: 'blocked' }] });
});

test('a rejected reviewer prompt returns the reviewer reason to the model', async () => {
  const { ctx, listeners, routes } = makeContext();
  apply(ctx);
  await callRoute(routes[0], 'POST', { reviewReasonToModel: true });
  const approval = listenerFor(listeners, 'approval/request');
  const postExecute = listenerFor(listeners, 'tools/post-execute');
  const outcome = await approval({
    agent: {},
    toolName: 'bash',
    callId: 'call-2',
    reason: 'Auto review denied tool "bash": Writes to /etc/passwd',
  }, async () => 'rejected');
  assert.equal(outcome, 'rejected', 'the plugin must not change the approval outcome');
  const decision = await postExecute({ name: 'bash', callId: 'call-2' }, userRejectedResult(), acceptEverything);
  assert.equal(
    decision.content[0].text,
    'Error: the user rejected tool "bash"\nAuto review\'s reason: Writes to /etc/passwd',
  );
});

test('approval prompts from other askers and reason-less reviewer denials are ignored', async () => {
  const { ctx, listeners, routes } = makeContext();
  apply(ctx);
  await callRoute(routes[0], 'POST', { reviewReasonToModel: true });
  const approval = listenerFor(listeners, 'approval/request');
  const postExecute = listenerFor(listeners, 'tools/post-execute');
  await approval({ agent: {}, toolName: 'bash', callId: 'call-3', reason: 'sandbox requires approval' }, async () => 'rejected');
  assert.deepEqual(await postExecute({ name: 'bash', callId: 'call-3' }, userRejectedResult(), acceptEverything), { kind: 'accept' });
  await approval({ agent: {}, toolName: 'bash', callId: 'call-4', reason: 'Auto review denied tool "bash"' }, async () => 'rejected');
  assert.deepEqual(await postExecute({ name: 'bash', callId: 'call-4' }, userRejectedResult(), acceptEverything), { kind: 'accept' });
});

test('a remembered prompt is consumed once and never leaks to another call', async () => {
  const { ctx, listeners, routes } = makeContext();
  apply(ctx);
  await callRoute(routes[0], 'POST', { reviewReasonToModel: true });
  const approval = listenerFor(listeners, 'approval/request');
  const postExecute = listenerFor(listeners, 'tools/post-execute');
  await approval({ agent: {}, toolName: 'bash', callId: 'call-5', reason: 'Auto review denied tool "bash": Writes to /etc/passwd' }, async () => 'rejected');
  assert.deepEqual(await postExecute({ name: 'bash', callId: 'call-6' }, userRejectedResult(), acceptEverything), { kind: 'accept' });
  const first = await postExecute({ name: 'bash', callId: 'call-5' }, userRejectedResult(), acceptEverything);
  assert.match(first.content[0].text, /Writes to \/etc\/passwd/);
  assert.deepEqual(await postExecute({ name: 'bash', callId: 'call-5' }, userRejectedResult(), acceptEverything), { kind: 'accept' });
});

test('cancelled calls never receive a reviewer reason', async () => {
  const { ctx, listeners, routes } = makeContext();
  apply(ctx);
  await callRoute(routes[0], 'POST', { reviewReasonToModel: true });
  const approval = listenerFor(listeners, 'approval/request');
  const postExecute = listenerFor(listeners, 'tools/post-execute');
  await approval({ agent: {}, toolName: 'bash', callId: 'call-7', reason: 'Auto review denied tool "bash": Writes to /etc/passwd' }, async () => 'cancelled');
  const aborted = {
    isError: true,
    content: [{ type: 'text', text: 'Error: tool call was cancelled' }],
    error: { message: 'tool call was cancelled', code: 'ABORTED_BEFORE_DISPATCH' },
  };
  assert.deepEqual(await postExecute({ name: 'bash', callId: 'call-7' }, aborted, acceptEverything), { kind: 'accept' });
});

test('a call the user allows at the reviewer prompt is not annotated', async () => {
  const { ctx, listeners, routes } = makeContext();
  apply(ctx);
  await callRoute(routes[0], 'POST', { reviewReasonToModel: true });
  const approval = listenerFor(listeners, 'approval/request');
  const postExecute = listenerFor(listeners, 'tools/post-execute');
  await approval({ agent: {}, toolName: 'bash', callId: 'call-8', reason: 'Auto review denied tool "bash": Writes to /tmp/x' }, async () => 'allowed-once');
  const success = { isError: false, content: [{ type: 'text', text: 'wrote 12 bytes' }], value: { ok: true } };
  assert.deepEqual(await postExecute({ name: 'bash', callId: 'call-8' }, success, acceptEverything), { kind: 'accept' });
});

test('a denial without a reviewer sentence keeps the stock model-facing error', async () => {
  const { ctx, listeners, routes } = makeContext();
  apply(ctx);
  await callRoute(routes[0], 'POST', { reviewReasonToModel: true });
  const postExecute = listenerFor(listeners, 'tools/post-execute');
  assert.deepEqual(await postExecute({ name: 'bash', callId: 'call-9' }, autoReviewDenialResult(), acceptEverything), { kind: 'accept' });
});

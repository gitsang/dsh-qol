/**
 * dsh-experimental-auto-review-enhance
 *
 * Make the experimental `auto` permission preset (Auto review) the default for
 * genuinely new root sessions, and optionally choose the language of its
 * user-visible denial reasons.
 *
 * All settings live on this component's own configuration page under
 * Plugins → @gitsang/dsh-qol. Nothing is injected into the shipped Settings
 * pages.
 *
 * Why a plugin is needed
 * ----------------------
 * `@deepseek-ai/dsh-permission-presets` deliberately keeps `auto` out of the
 * `permission` settings schema and out of `catalog().defaultOptions`:
 *
 *   - `defaultSettings()` rejects any default that is not a configured table
 *     entry, and storing `defaultPreset: auto` in the profile patch makes the
 *     whole `permission` row fail to activate at boot;
 *   - `auto` only exists while the Auto review integration is live.
 *
 * So this plugin does four narrow things, all reversible:
 *
 *  1. On `session/created` (prepended, so it runs before the permission
 *     service pins its own default) it switches genuinely fresh root sessions
 *     to `auto`. It also wraps `pinInitialPermission` for determinism.
 *  2. Exposes one same-origin config endpoint for the component page: the
 *     Auto-review new-session default, the reviewer reason language, and
 *     whether the reviewer's reason may also reach the session AI.
 *  3. Appends a language directive to the Auto review classifier's system
 *     prompt when Chinese is requested. The JSON approval protocol itself
 *     stays in English.
 *  4. When the user opts in, extends the model-facing error of a call the
 *     reviewer denied with the reviewer's own sentence. The shipped
 *     integration deliberately keeps that sentence out of model context, so
 *     the plugin re-adds it through two public seams: `approval/request`
 *     remembers the reason of a pending reviewer prompt, and
 *     `tools/post-execute` appends it to that call's error content. The
 *     structured denial identity the UI reads is left untouched.
 *
 * The Auto/not-Auto choice, the optional reviewer language and the AI
 * visibility choice live in a small per-profile JSON file under
 * `$DSH_HOME/experimental-auto-review-enhance/<profile>.json`. The official
 * `permission.defaultPreset` is never touched, so the composition always
 * boots and there is no second source of truth.
 *
 * Scope rules
 * -----------
 *  - Delegated subagent sessions are skipped: the Auto integration pins them to
 *    `never` on purpose.
 *  - Restored / seeded sessions keep the preset they were last left in; only
 *    genuinely new sessions adopt the configured default.
 *  - When the Auto integration is not live, the page disables the Auto default
 *    control and new sessions keep the stock permission default. A stored Auto
 *    choice is remembered for when the integration returns.
 *
 * Only public service methods plus the existing instance-level wrapping pattern
 * are used. Every failure is logged and swallowed: this plugin must never be
 * able to veto a session or a boot.
 *
 * @module @gitsang/dsh-experimental-auto-review-enhance
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Cordis plugin name used by loader diagnostics. */
export const name = 'experimental-auto-review-enhance';

/** The permission preset and LLM services must exist before anything can be offered. */
export const inject = ['permissionPresets', 'llm'];

/** Same-origin endpoint owned by this package for its component configuration. */
export const CONFIG_PATH = '/experimental-auto-review-enhance/config';

/** Canonical identity of the experimental per-call review preset. */
const AUTO_PRESET = 'auto';

/** Prefix that uniquely identifies the shipped Auto review system prompt. */
const AUTO_REVIEW_POLICY_PREFIX = 'REVIEW_POLICY\n';

/** Appended to the reviewer prompt when user-facing reasons should be Chinese. */
const ZH_REASON_INSTRUCTION = `

USER_VISIBLE_LANGUAGE
When the JSON object includes a "reason" member, write that reason in Simplified Chinese (简体中文). The reason is shown directly to the user in an approval prompt or a denied tool card. Keep every JSON member name, risk value and decision value exactly as specified above; do not translate the protocol, and do not add any member the protocol does not allow.`;

/** Structured error identity the shipped reviewer stamps on a final denial. */
const AUTO_REVIEW_DENIED = { name: 'AutoReviewDeniedError', code: 'AUTO_REVIEW_DENIED' };

/** How the shipped reviewer opens the approval prompt it raises for a denial. */
const AUTO_REVIEW_ASK_PREFIX = 'Auto review denied tool "';

/** Longest reviewer sentence appended to a model-facing error. */
const MAX_REVIEW_REASON_LENGTH = 400;

/** Most pending reviewer prompts remembered at once. */
const MAX_PENDING_REVIEW_REASONS = 32;

/** Marks a service instance this plugin already wrapped. */
const WRAPPED = Symbol.for('dsh-experimental-auto-review-enhance/wrapped');

/** Render one unknown thrown value as text. */
function describeError(error) {
  return error instanceof Error ? error.message : String(error);
}

/** Log one line; logging must never be able to veto anything. */
function log(ctx, level, message) {
  try {
    ctx.logger?.[level]?.(`experimental-auto-review-enhance: ${message}`);
  } catch {
    /* a logger failure is never a reason to fail a session */
  }
}

/** Whether one LLM request is the shipped Auto review classification call. */
function isAutoReviewRequest(options) {
  return typeof options?.system === 'string' && options.system.startsWith(AUTO_REVIEW_POLICY_PREFIX);
}

/**
 * Append the user-visible language instruction to an Auto review request.
 * Every other LLM request is returned untouched.
 *
 * @param options - the caller's generate options.
 * @param language - the configured reviewer reason language.
 * @returns the original options or a shallow copy with the language directive.
 */
function withReviewLanguage(options, language) {
  if (language !== 'zh' || !isAutoReviewRequest(options)) return options;
  const marker = '\n\nFor any allow, end with exactly';
  const system = options.system.includes(marker)
    ? options.system.replace(marker, `${ZH_REASON_INSTRUCTION}${marker}`)
    : `${options.system}${ZH_REASON_INSTRUCTION}`;
  return { ...options, system };
}

/**
 * Normalize one reviewer sentence for a model-facing error line: flatten any
 * line breaks, trim, and cap the length. A blank value becomes `undefined` so
 * callers simply omit it.
 *
 * @param value - the reviewer's free-form `reason`.
 * @returns the flattened sentence, or `undefined` when nothing usable remains.
 */
function normalizeReviewReason(value) {
  if (typeof value !== 'string') return undefined;
  const text = value.replace(/\s+/g, ' ').trim();
  if (text === '') return undefined;
  return text.length <= MAX_REVIEW_REASON_LENGTH
    ? text
    : `${text.slice(0, MAX_REVIEW_REASON_LENGTH - 1)}…`;
}

/**
 * The reviewer sentence carried by a final Auto review denial result.
 *
 * The shipped integration exposes it only as `error.info.reason` — durable and
 * user-visible, never model-facing — so append its reader to the model-facing
 * content is the one thing the AI-visibility option changes.
 *
 * @param result - one settled tool result.
 * @returns the reviewer sentence, or `undefined` for every other failure.
 */
function reviewReasonOfDenial(result) {
  const info = result?.error?.info;
  if (info?.name !== AUTO_REVIEW_DENIED.name || info?.code !== AUTO_REVIEW_DENIED.code) return undefined;
  return normalizeReviewReason(info.reason);
}

/**
 * The reviewer sentence carried by the approval prompt Auto review raises when
 * a reviewer denial falls back to human approval (the `ask` policy).
 *
 * @param reason - the approval request's audited reason.
 * @param toolName - the tool the approval request is about.
 * @returns the reviewer sentence, or `undefined` for every other asker.
 */
function reviewReasonOfAsk(reason, toolName) {
  if (typeof reason !== 'string' || typeof toolName !== 'string') return undefined;
  const prefix = `${AUTO_REVIEW_ASK_PREFIX}${toolName}"`;
  if (!reason.startsWith(prefix)) return undefined;
  const rest = reason.slice(prefix.length);
  if (!rest.startsWith(': ')) return undefined;
  return normalizeReviewReason(rest.slice(2));
}

/**
 * Append one reviewer sentence to the model-facing content of a failed call,
 * keeping every existing block and adding no other field.
 *
 * @param content - the content blocks the AI would otherwise see.
 * @param reason - the normalized reviewer sentence.
 * @returns a new content array with the sentence on its last text block.
 */
function withReviewerReason(content, reason) {
  const note = `\nAuto review's reason: ${reason}`;
  const blocks = Array.isArray(content) ? [...content] : [];
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const block = blocks[index];
    if (block?.type === 'text' && typeof block.text === 'string') {
      blocks[index] = { ...block, text: `${block.text}${note}` };
      return blocks;
    }
  }
  blocks.push({ type: 'text', text: note.slice(1) });
  return blocks;
}

/** Current state directory; a renamed package must not silently drop a saved choice. */
const STATE_DIR = 'experimental-auto-review-enhance';

/** State directories from earlier names, read only when the current one has no file. */
const LEGACY_STATE_DIRS = ['permission-auto', 'permission-auto-default'];

/** Resolve the Harness home and profile name, or `null` when unavailable. */
function stateHomeOf(ctx) {
  try {
    const profile = typeof ctx.get === 'function' ? ctx.get('profileContext') : undefined;
    const home = profile?.home
      ?? process.env.DSH_HOME
      ?? (process.env.HOME === undefined ? undefined : join(process.env.HOME, '.dsh'));
    if (home === undefined) return null;
    return { home, profile: profile?.name ?? 'default' };
  } catch {
    return null;
  }
}

/** Per-profile state path, or `null` when the profile layout is unavailable. */
function statePathOf(ctx) {
  const resolved = stateHomeOf(ctx);
  return resolved === null ? null : join(resolved.home, STATE_DIR, `${resolved.profile}.json`);
}

/** Pre-rename state paths, in newest-to-oldest order. */
function legacyStatePathsOf(ctx) {
  const resolved = stateHomeOf(ctx);
  return resolved === null
    ? []
    : LEGACY_STATE_DIRS.map((directory) => join(resolved.home, directory, `${resolved.profile}.json`));
}

/** Read the complete stored state; any unreadable state is an empty record. */
function readStateRecord(ctx) {
  try {
    const current = statePathOf(ctx);
    const path = current !== null && existsSync(current)
      ? current
      : legacyStatePathsOf(ctx).find((candidate) => existsSync(candidate));
    if (path === undefined) return {};
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    log(ctx, 'warn', `could not read the saved choice (${describeError(error)}); keeping the configured default`);
    return {};
  }
}

/** Whether the stored choice is Auto. */
function readState(ctx) {
  return readStateRecord(ctx).defaultPreset === AUTO_PRESET;
}

/** The configured reviewer language; English is the safe default. */
function readReviewLanguage(ctx) {
  return readStateRecord(ctx).reviewLanguage === 'zh' ? 'zh' : 'en';
}

/** Whether the reviewer's sentence should also reach the session AI. */
function readReviewReasonToModel(ctx) {
  return readStateRecord(ctx).reviewReasonToModel === true;
}

/** Persist one state record atomically; failures are logged only. */
function writeStateRecord(ctx, record) {
  try {
    const path = statePathOf(ctx);
    if (path === null) {
      log(ctx, 'warn', 'no profile state path is available; the choice was not saved');
      return false;
    }
    mkdirSync(dirname(path), { recursive: true });
    const temporary = `${path}.${process.pid}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
    renameSync(temporary, path);
    return true;
  } catch (error) {
    log(ctx, 'warn', `could not save the choice (${describeError(error)})`);
    return false;
  }
}

/** Whether the Auto review integration currently contributes its preset. */
function autoAvailable(presets) {
  try {
    return Array.isArray(presets.names) && presets.names.includes(AUTO_PRESET);
  } catch {
    return false;
  }
}

/** Whether this session is a delegated subagent child rather than a root. */
function isDelegatedChild(session) {
  try {
    const header = session?.header;
    if (header === null || header === undefined) return true;
    if (header.origin === 'subagent') return true;
    return (header.delegationDepth ?? 0) > 0;
  } catch {
    return true;
  }
}

/** A session is fresh when DSH has not recorded any permission fact yet. */
function isFreshPermissionState(state) {
  return state !== null
    && state !== undefined
    && state.preset === null
    && state.sandbox === null
    && state.approval === null
    && state.seeded !== true;
}

/** Read one JSON object request body. */
async function readJson(request) {
  const decoder = new TextDecoder();
  let text = '';
  for await (const chunk of request) text += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
  text += decoder.decode();
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new TypeError('request body must be valid JSON');
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('request body must be a JSON object');
  }
  return value;
}

/** Write one JSON response. */
function respondJson(response, status, value) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(value));
}

/**
 * The complete configuration the component page edits.
 * @param ctx - owning plugin context, used to locate the state file.
 * @param presets - live permission preset service.
 * @returns the stored choice plus whether the Auto integration is available.
 */
function configSnapshot(ctx, presets) {
  return {
    defaultPreset: readState(ctx) ? AUTO_PRESET : '',
    reviewLanguage: readReviewLanguage(ctx),
    reviewReasonToModel: readReviewReasonToModel(ctx),
    autoAvailable: autoAvailable(presets),
  };
}

/** Install the component configuration endpoint plus the new-session default. */
export function apply(ctx) {
  const presets = ctx.permissionPresets;
  if (presets === undefined || presets === null) {
    log(ctx, 'warn', 'permissionPresets is unavailable; the plugin stays inactive');
    return;
  }

  const llm = ctx.llm ?? (typeof ctx.get === 'function' ? ctx.get('llm') : undefined);

  /** Replace one method on a live service instance, returning its disposer. */
  const patchMethod = (target, method, factory) => {
    if (target === undefined || target === null) return () => {};
    const original = Reflect.get(target, method);
    if (typeof original !== 'function') return () => {};
    const hadOwn = Object.hasOwn(target, method);
    const replacement = factory(original);
    try {
      target[method] = replacement;
    } catch (error) {
      log(ctx, 'warn', `could not wrap ${method} (${describeError(error)})`);
      return () => {};
    }
    return () => {
      try {
        if (Reflect.get(target, method) !== replacement) return;
        if (hadOwn) target[method] = original;
        else delete target[method];
      } catch {
        /* disposal is best-effort */
      }
    };
  };

  // 0) Let the configured language steer the user-visible reviewer reason.
  //
  // Auto review owns its fixed policy and does not expose the classification
  // request. The one public seam it uses is `ctx.llm.stream`, so wrap that
  // method and recognize the shipped policy by its unique banner. Only the
  // free-form `reason` instruction changes; the JSON protocol stays intact.
  const llmDisposer = patchMethod(llm, 'stream', (original) => function stream(options) {
    let adjusted = options;
    try {
      adjusted = withReviewLanguage(options, readReviewLanguage(ctx));
    } catch (error) {
      log(ctx, 'warn', `could not apply the reviewer language (${describeError(error)})`);
    }
    return original.apply(this === undefined ? llm : this, [adjusted]);
  });
  if (llm === undefined || llm === null) {
    log(ctx, 'warn', 'the llm service is absent; the reviewer language option has no effect');
  }

  // The component's choices are its own state, not permission Config fields.
  // A row nested inside the QOL bundle has no Settings namespace of its own, so
  // its Configure page talks to this same-origin endpoint instead.
  const registerConfigRoute = (webCtx) => {
    webCtx.effect(() => webCtx.webServer.register({
      kind: 'exact',
      path: CONFIG_PATH,
      handler: async (request, response) => {
        try {
          if (request.method === 'GET') {
            respondJson(response, 200, configSnapshot(ctx, presets));
            return;
          }
          if (request.method === 'POST') {
            const body = await readJson(request);
            const record = readStateRecord(ctx);
            if (Object.hasOwn(body, 'defaultPreset')) {
              if (body.defaultPreset !== '' && body.defaultPreset !== AUTO_PRESET) {
                throw new TypeError('defaultPreset must be "auto" or an empty string');
              }
              if (body.defaultPreset === AUTO_PRESET && !autoAvailable(presets)) {
                throw new TypeError('Auto review is not available');
              }
              record.defaultPreset = body.defaultPreset;
            }
            if (Object.hasOwn(body, 'reviewLanguage')) {
              if (body.reviewLanguage !== 'en' && body.reviewLanguage !== 'zh') {
                throw new TypeError('reviewLanguage must be "en" or "zh"');
              }
              record.reviewLanguage = body.reviewLanguage;
            }
            if (Object.hasOwn(body, 'reviewReasonToModel')) {
              if (typeof body.reviewReasonToModel !== 'boolean') {
                throw new TypeError('reviewReasonToModel must be a boolean');
              }
              record.reviewReasonToModel = body.reviewReasonToModel;
            }
            if (!writeStateRecord(ctx, record)) throw new Error('could not save the component configuration');
            respondJson(response, 200, configSnapshot(ctx, presets));
            return;
          }
          response.writeHead(405);
          response.end();
        } catch (error) {
          const status = error instanceof TypeError ? 400 : 500;
          respondJson(response, status, { error: describeError(error) });
        }
      },
    }), 'experimental-auto-review-enhance: configuration route');
  };
  if (typeof ctx.inject === 'function') {
    ctx.inject(['webServer'], registerConfigRoute);
  } else if (ctx.webServer !== undefined) {
    registerConfigRoute(ctx);
  }

  // 1) New root sessions start in Auto review while that is the saved default.
  //
  // Two paths, one intent. `pinInitialPermission` is the single place that
  // decides a session's initial preset, so wrapping it works no matter how the
  // Host orders its `session/created` listeners. The prepended listener is kept
  // as a fallback for Hosts where that method is absent or renamed: it reaches
  // the session before the official pin and only acts on still-empty facts.
  const adopt = (session, fresh) => {
    try {
      if (!fresh) return;
      if (isDelegatedChild(session)) return;
      if (!readState(ctx)) return;
      if (!autoAvailable(presets)) return;
      if (presets.current(session) === AUTO_PRESET) return;
      presets.set(session, AUTO_PRESET);
      log(ctx, 'info', `session ${String(session?.id)} starts in preset "${AUTO_PRESET}"`);
    } catch (error) {
      log(ctx, 'warn', `could not start a session in "${AUTO_PRESET}" (${describeError(error)})`);
    }
  };

  /** Whether this session has not recorded any event yet. */
  const isFreshSession = (session) => {
    try {
      return session?.seq === 0;
    } catch {
      return false;
    }
  };

  const pinDisposer = patchMethod(presets, 'pinInitialPermission', (original) => function pinInitialPermission(session, ...rest) {
    // Freshness must be read before the official pin appends its own events.
    const fresh = isFreshSession(session);
    const result = original.call(this === undefined ? presets : this, session, ...rest);
    adopt(session, fresh);
    return result;
  });
  const integrationDisposers = [pinDisposer];

  ctx.on('session/created', (session) => {
    let fresh = false;
    try {
      fresh = isFreshPermissionState(presets.permissionState(session));
    } catch (error) {
      log(ctx, 'warn', `could not read fresh permission facts (${describeError(error)})`);
      return;
    }
    adopt(session, fresh);
  }, { prepend: true });

  // 2) Optionally return the reviewer's own sentence to the session AI.
  //
  // The shipped integration keeps that sentence out of model-facing content on
  // purpose: a final denial exposes it only as `error.info.reason`, and a
  // reviewer denial under the `ask` policy becomes an approval prompt whose
  // reason is never copied into the rejection the AI sees. Two public events
  // are enough to add it back when the user opts in:
  //
  //   - `approval/request` remembers the reviewer sentence of a pending
  //     prompt, keyed by the tool call it is about;
  //   - `tools/post-execute` appends the remembered sentence — or the one the
  //     final denial carries — to that call's model-facing error content.
  //
  // Both listeners prepend for one reason: they only observe and pass the
  // chain through, while the shipped answerers and post-policy listeners may
  // claim the event without calling `next()`. The web client answers approvals
  // through the forwarded `approval/request` listener that claims its request,
  // so an inner listener would never see it.
  //
  // Only content is extended. `error.info` keeps the structured denial
  // identity the UI localizes, and no other call is touched.
  const pendingReviewReasons = new Map();

  ctx.on('approval/request', (request, next) => {
    try {
      const reason = reviewReasonOfAsk(request?.reason, request?.toolName);
      const callId = request?.callId;
      if (reason !== undefined && typeof callId === 'string') {
        if (pendingReviewReasons.size >= MAX_PENDING_REVIEW_REASONS) {
          const oldest = pendingReviewReasons.keys().next();
          if (!oldest.done) pendingReviewReasons.delete(oldest.value);
        }
        pendingReviewReasons.set(callId, reason);
      }
    } catch (error) {
      log(ctx, 'warn', `could not remember the reviewer reason (${describeError(error)})`);
    }
    return next();
  }, { prepend: true });

  ctx.on('tools/post-execute', async (exec, result, next) => {
    const decision = await next();
    try {
      const callId = exec?.callId;
      const pending = typeof callId === 'string' ? pendingReviewReasons.get(callId) : undefined;
      if (typeof callId === 'string') pendingReviewReasons.delete(callId);
      const reason = reviewReasonOfDenial(result) ?? pending;
      if (reason === undefined) return decision;
      if (!readReviewReasonToModel(ctx)) return decision;
      if (decision?.kind !== 'accept') return decision;
      if (result?.isError !== true) return decision;
      if (typeof result?.error?.code === 'string' && result.error.code.startsWith('ABORTED')) return decision;
      const content = Array.isArray(decision.content) ? decision.content : result.content;
      return { ...decision, content: withReviewerReason(content, reason) };
    } catch (error) {
      log(ctx, 'warn', `could not append the reviewer reason (${describeError(error)})`);
      return decision;
    }
  }, { prepend: true });

  ctx.effect(() => {
    try {
      Object.defineProperty(presets, WRAPPED, { value: true, configurable: true });
    } catch {
      /* marker only */
    }
    return () => {
      llmDisposer();
      for (const dispose of integrationDisposers) dispose();
      try {
        Reflect.deleteProperty(presets, WRAPPED);
      } catch {
        /* marker only */
      }
    };
  }, 'experimental-auto-review-enhance: configuration and session integration');
}

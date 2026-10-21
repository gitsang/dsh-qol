/**
 * dsh-experimental-auto-review-enhance
 *
 * Make the experimental `auto` permission preset (Auto review) selectable in
 * the shipped Settings > Permission "default for new sessions" row, without
 * hard-wiring Auto review as the only default.
 *
 * Why a plugin is needed
 * ----------------------
 * `@deepseek-ai/dsh-permission-presets` deliberately keeps `auto` out of the
 * `permission` settings schema and out of `catalog().defaultOptions`:
 *
 *   - `defaultSettings()` rejects any default that is not a configured table
 *     entry, and storing `defaultPreset: auto` in the profile patch makes the
 *     whole `permission` row fail to activate at boot;
 *   - the shipped Settings row renders exactly `catalog().defaultOptions`.
 *
 * So this plugin does three narrow things, all reversible:
 *
 *  1. It wraps `permissionPresets.catalog()` and appends an `auto` option to
 *     `defaultOptions` while the Auto review integration is live.
 *  2. It wraps the live `settings` service: `describe()` reports `auto` as the
 *     current default of the `permission` namespace when this plugin's own
 *     state says so, and `mutate()`/`update()` intercept a
 *     `defaultPreset: "auto"` write so it never reaches the permission schema.
 *     The real `permission.defaultPreset` keeps naming a normal preset, so the
 *     composition always boots.
 *  3. On `session/created` (prepended, so it runs before the permission
 *     service pins its own default) it switches genuinely fresh root sessions
 *     to `auto`.
 *
 * The Auto/not-Auto choice lives in a small per-profile JSON file under
 * `$DSH_HOME/experimental-auto-review-enhance/<profile>.json`. That keeps this plugin
 * out of the permission Config entirely: no duplicate source of truth, no
 * unsupported enum value, and switching back to Read Only just deletes the
 * file and writes the normal preset through the official service.
 *
 * Scope rules
 * -----------
 *  - Delegated subagent sessions are skipped: the Auto integration pins them to
 *    `never` on purpose.
 *  - Restored / seeded sessions keep the preset they were last left in; only
 *    genuinely new sessions adopt the configured default.
 *  - When the Auto integration is not live, everything degrades to stock
 *    behavior: the option is not offered, the row falls back to the real
 *    configured default, and new sessions keep the stock default.
 *
 * Only public service methods plus the same instance-level wrapping pattern the
 * shipped settings code itself relies on are used. Every failure is logged and
 * swallowed: this plugin must never be able to veto a session or a boot.
 *
 * @module @gitsang/dsh-experimental-auto-review-enhance
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Cordis plugin name used by loader diagnostics. */
export const name = 'experimental-auto-review-enhance';

/** The permission preset service must exist before anything can be offered. */
export const inject = ['permissionPresets'];

/** Canonical identity of the experimental per-call review preset. */
const AUTO_PRESET = 'auto';

/** Option appended to the Settings dropdown while Auto review is live. */
const AUTO_OPTION = {
  value: AUTO_PRESET,
  name: 'Auto review',
  description:
    'Run without a sandbox after an experimental same-model review of every tool call. '
    + 'Denied calls ask you for approval.',
};

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

/** Read the stored choice; any unreadable state means "not Auto". */
function readState(ctx) {
  try {
    const current = statePathOf(ctx);
    const path = current !== null && existsSync(current)
      ? current
      : legacyStatePathsOf(ctx).find((candidate) => existsSync(candidate));
    if (path === undefined) return false;
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    return parsed?.defaultPreset === AUTO_PRESET;
  } catch (error) {
    log(ctx, 'warn', `could not read the saved choice (${describeError(error)}); keeping the configured default`);
    return false;
  }
}

/** Persist (or clear) the Auto choice atomically; failures are logged only. */
function writeState(ctx, auto) {
  try {
    const path = statePathOf(ctx);
    if (path === null) {
      log(ctx, 'warn', 'no profile state path is available; the Auto default was not saved');
      return;
    }
    mkdirSync(dirname(path), { recursive: true });
    const temporary = `${path}.${process.pid}.tmp`;
    writeFileSync(temporary, `${JSON.stringify({ defaultPreset: auto ? AUTO_PRESET : '' }, null, 2)}\n`, 'utf8');
    renameSync(temporary, path);
  } catch (error) {
    log(ctx, 'warn', `could not save the choice (${describeError(error)})`);
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

/** Compare one settings path with the single field this plugin intercepts. */
function isDefaultPresetPath(path) {
  return Array.isArray(path) && path.length === 1 && path[0] === 'defaultPreset';
}

/**
 * Replace the current-session count of one catalog answer with the Settings
 * answer: append `auto` to the presets eligible as a future-session default.
 *
 * @param catalog - the permission service's own catalog snapshot.
 * @param auto - whether the stored choice is Auto.
 * @param live - whether the Auto integration is currently registered.
 * @returns the catalog the Settings row reads.
 */
function withAutoDefault(catalog, auto, live) {
  const defaultOptions = Array.isArray(catalog?.defaultOptions) ? catalog.defaultOptions : [];
  if (!live) return catalog;
  const already = defaultOptions.some((option) => option?.value === AUTO_PRESET);
  return {
    ...catalog,
    defaultOptions: already ? defaultOptions : [...defaultOptions, { ...AUTO_OPTION }],
    defaultPreset: auto ? AUTO_PRESET : catalog?.defaultPreset,
  };
}

/**
 * Decorate one `settings.describe()` permission descriptor so the shipped row
 * shows (and keeps) the Auto choice it cannot represent by itself.
 *
 * @param descriptor - one settings descriptor.
 * @param auto - whether the stored choice is Auto.
 * @param live - whether the Auto integration is currently registered.
 * @returns the descriptor, possibly with `value.defaultPreset` rewritten.
 */
function withAutoDescriptor(descriptor, auto, live) {
  if (!auto || !live) return descriptor;
  const value = descriptor?.value;
  if (value === null || typeof value !== 'object') return descriptor;
  return { ...descriptor, value: { ...value, defaultPreset: AUTO_PRESET } };
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

/** Install the catalog/settings view plus the new-session default. */
export function apply(ctx) {
  const presets = ctx.permissionPresets;
  if (presets === undefined || presets === null) {
    log(ctx, 'warn', 'permissionPresets is unavailable; the plugin stays inactive');
    return;
  }

  const settings = typeof ctx.get === 'function' ? ctx.get('settings') : undefined;

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

  // 1) Advertise Auto review as a future-session default while it is live.
  const catalogDisposer = patchMethod(presets, 'catalog', (original) => function catalog(...args) {
    const result = original.apply(this === undefined ? presets : this, args);
    try {
      return withAutoDefault(result, readState(ctx), autoAvailable(presets));
    } catch (error) {
      log(ctx, 'warn', `could not decorate the preset catalog (${describeError(error)})`);
      return result;
    }
  });

  // 2) Let the shipped Settings row read and write that choice.
  const settingsDisposers = [];
  if (settings !== undefined && settings !== null) {
    settingsDisposers.push(patchMethod(settings, 'describe', (original) => function describe(...args) {
      const rows = original.apply(this === undefined ? settings : this, args);
      try {
        if (!Array.isArray(rows)) return rows;
        const auto = readState(ctx);
        const live = autoAvailable(presets);
        return rows.map((row) => (row?.ns === 'permission' ? withAutoDescriptor(row, auto, live) : row));
      } catch (error) {
        log(ctx, 'warn', `could not decorate the settings descriptor (${describeError(error)})`);
        return rows;
      }
    }));

    /**
     * Recognize one `defaultPreset` write in either supported shape: the
     * path-addressed `mutate` ops array, or the merge-style `update` object.
     *
     * @param ns - settings namespace the write addresses.
     * @param input - ops array (`mutate`) or field patch (`update`).
     * @returns `auto`, `other`, or `null` when the write does not touch the field.
     */
    const defaultPresetWrite = (ns, input) => {
      if (ns !== 'permission') return null;
      if (Array.isArray(input)) {
        let touched = null;
        for (const op of input) {
          if (op === null || typeof op !== 'object') continue;
          if (!isDefaultPresetPath(op.path)) continue;
          if (op.op === 'set') touched = op.value === AUTO_PRESET ? AUTO_PRESET : 'other';
          else touched = 'other';
        }
        return touched;
      }
      if (input !== null && typeof input === 'object' && Object.hasOwn(input, 'defaultPreset')) {
        return input.defaultPreset === AUTO_PRESET ? AUTO_PRESET : 'other';
      }
      return null;
    };

    const intercept = (original) => async function writeDefaultPreset(ns, input, expectedRevision) {
      let touched;
      try {
        touched = defaultPresetWrite(ns, input);
      } catch (error) {
        log(ctx, 'warn', `could not inspect the settings write (${describeError(error)})`);
        return original.apply(this === undefined ? settings : this, [ns, input, expectedRevision]);
      }
      if (touched === AUTO_PRESET) {
        // Never let this reach the permission schema: `auto` is not a table
        // entry and would make the whole row fail to activate at next boot.
        writeState(ctx, true);
        return undefined;
      }
      const result = await original.apply(this === undefined ? settings : this, [ns, input, expectedRevision]);
      if (touched === 'other') writeState(ctx, false);
      return result;
    };

    settingsDisposers.push(patchMethod(settings, 'mutate', intercept));
    settingsDisposers.push(patchMethod(settings, 'update', intercept));
  } else {
    log(ctx, 'warn', 'the settings service is absent; Auto review will not be selectable in Settings');
  }

  // 3) New root sessions start in Auto review while that is the saved default.
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
  settingsDisposers.push(pinDisposer);

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

  ctx.effect(() => {
    try {
      Object.defineProperty(presets, WRAPPED, { value: true, configurable: true });
    } catch {
      /* marker only */
    }
    // The catalog answer changed the moment the option became available, so
    // tell already-open Settings surfaces to re-read it instead of waiting for
    // the next mount.
    try {
      presets.emitCatalogChanged?.();
    } catch (error) {
      log(ctx, 'warn', `could not publish the catalog change (${describeError(error)})`);
    }
    return () => {
      catalogDisposer();
      for (const dispose of settingsDisposers) dispose();
      try {
        Reflect.deleteProperty(presets, WRAPPED);
      } catch {
        /* marker only */
      }
    };
  }, 'experimental-auto-review-enhance: Settings integration');
}

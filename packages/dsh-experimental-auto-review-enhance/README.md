# dsh-experimental-auto-review-enhance

Offer the experimental **Auto review** permission preset as a new-session
default in **Settings → Permission**, without hard-wiring Auto review as the
only default. Picking **Read Only**, **Workspace Write**, or **Full access**
keeps stock behaviour.

Works with [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
`0.2.0-rc.2` and requires the `@deepseek-ai/dsh-experimental-auto-review`
bundle to be enabled in the profile.

## Why a plugin is needed

`@deepseek-ai/dsh-permission-presets` deliberately keeps `auto` out of the
future-session default:

- `defaultSettings()` only accepts entries from the configured preset table, so
  storing `defaultPreset: auto` makes the whole `permission` row fail to
  activate at boot with `permission: unknown preset "auto"`;
- the shipped Settings row renders exactly `catalog().defaultOptions`, and that
  list is `Object.keys(presets)` — configured entries only.

That is a deliberate product decision (Auto lives only while its integration
effect lives), so the only way to surface it in the Settings dropdown is a
plugin that adds it on the live Host.

## What it does

1. Wraps `permissionPresets.catalog()` and appends an `auto` option
   (`Auto review`, with a description) to `defaultOptions` while the Auto review
   integration is registered. It also publishes
   `permission-presets/catalog-changed`, so an already-open Settings panel
   re-reads the list.
2. Wraps the live `settings` service:
   - `describe()` reports `defaultPreset: "auto"` for the `permission`
     namespace when Auto is the stored choice;
   - `mutate()` / `update()` intercept a `defaultPreset: "auto"` write and store
     it in this plugin's own state file. The real `permission.defaultPreset`
     always keeps naming a normal preset, so the composition always boots.
3. Switches **genuinely new root sessions** to the `auto` preset. It wraps
   `permissionPresets.pinInitialPermission` — the single place that decides a
   session's initial preset — and keeps a prepended `session/created` listener
   as a fallback for Hosts where that method is absent or renamed. Both paths
   share one idempotent `adopt()` that only acts on genuinely new sessions.

The Auto / not-Auto choice lives in a small per-profile JSON file:

```text
$DSH_HOME/experimental-auto-review-enhance/<profile>.json
```

Nothing is written into the `permission` Config, so there is no second source
of truth and no unsupported enum value. Switching back to a normal preset
clears the file and delegates the write to the official service.

## Install

This component ships with `@gitsang/dsh-qol`; it is not installed as a standalone bundle.

```bash
# Local checkout
dsh plugin --profile web add ~/src/github.com/gitsang/dsh-qol

# Once published
dsh plugin --profile web add @gitsang/dsh-qol
```

Enable `@gitsang/dsh-qol`, then switch this component on or off from its Plugins detail page.

## Uninstall

Switch this component off on the `@gitsang/dsh-qol` Plugins page. To remove the stored choice as well:

```bash
rm -rf ~/.dsh/experimental-auto-review-enhance
```

## Scope and limits

- Only affects **newly created top-level sessions**. Restored, resumed, forked
  and seeded sessions keep the preset they were last left in.
- A session's preset is pinned **at creation**, before its first message. The
  composer's **New session** button creates and pins a session immediately, so
  changing the Settings default affects only sessions created *after* that
  change. Change an already-open session with the composer's permission
  control or `/permission <preset>`.
- Delegated subagent sessions are skipped: the Auto integration pins in-process
  children to `never` by design.
- When the Auto integration is not registered, everything degrades to stock
  behaviour: the option is not offered, the row falls back to the real default,
  and new sessions keep the configured default.
- Selecting Auto review in Settings does **not** show the experimental risk
  confirmation (the shipped UI only gates Full access and the current-session
  Auto pick). Use `/permission auto` if you want that gate.
- The plugin wraps live service instance methods and the `session/created`
  timing rather than a public extension point. A future DSH rename of
  `catalog` / `settings.describe` / `pinInitialPermission` would make it
  silently inert (it logs a warning) rather than break boot. If new sessions
  stop adopting Auto after a DSH upgrade, check the host log for
  `experimental-auto-review-enhance:` warnings first.

## Troubleshooting

- **Settings shows Auto review but new sessions still start on the old preset.**
  The Host loaded an older build of this plugin. Update and restart:
  `cd ~/.dsh/profiles/web && pnpm update @gitsang/dsh-experimental-auto-review-enhance`, then
  restart `dsh web`.
- **State file location.** The choice is stored per profile under
  `$DSH_HOME/experimental-auto-review-enhance/<profile>.json`. A choice saved
  by the old `permission-auto` package is still read; the next write uses the
  new directory.

## Verification

On a real Host (`0.2.0-rc.2`, temporary headless profile with the Auto review
integration):

| Check | Result |
| --- | --- |
| `catalog().defaultOptions` gains `auto` (`Auto review`) | pass |
| `settings.mutate('permission', [{op:'set',path:['defaultPreset'],value:'auto'}])` reports `auto` back through `describe()` | pass |
| Profile patch never receives an unsupported `defaultPreset: auto` | pass |
| Switching back to a normal preset clears the state and delegates the write | pass |
| A real `agents.create()` in a web composition records `permission/preset: auto` as event 0 | pass |
| Delegated subagent sessions are not touched | pass |
| Auto integration absent ⇒ stock behaviour | pass |

`npm test` runs 18 unit tests over a fake Host context.

## License

MIT

# dsh-experimental-auto-review-enhance

Configure the experimental **Auto review** integration from this component's own
page under **Plugins → @gitsang/dsh-qol → @gitsang/dsh-experimental-auto-review-enhance**:
use Auto review as the default for newly created root sessions, and optionally
make the reviewer's denial reason appear in Chinese. Nothing is injected into
the shipped Settings pages.

Works with [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
`0.2.0-rc.2` and requires the `@deepseek-ai/dsh-experimental-auto-review`
bundle to be enabled in the profile.

## Why a plugin is needed

`@deepseek-ai/dsh-permission-presets` deliberately keeps `auto` out of the
future-session default:

- `defaultSettings()` only accepts entries from the configured preset table, so
  storing `defaultPreset: auto` makes the whole `permission` row fail to
  activate at boot with `permission: unknown preset "auto"`;
- `auto` only exists while the Auto review integration effect is live.

The plugin therefore keeps its own per-profile state and adopts Auto at session
creation instead of writing an unsupported value into the permission Config.

## What it does

1. Exposes one same-origin configuration endpoint for this component's page:
   the Auto-review new-session default and the reviewer reason language. The
   page stages both choices and writes them only on **Save**.
2. Switches **genuinely new root sessions** to the `auto` preset. It wraps
   `permissionPresets.pinInitialPermission` — the single place that decides a
   session's initial preset — and keeps a prepended `session/created` listener
   as a fallback for Hosts where that method is absent or renamed. Both paths
   share one idempotent `adopt()` that only acts on genuinely new sessions.
3. Optionally directs the Auto review classifier to write its free-form denial
   `reason` in Simplified Chinese.

Both choices live in a small per-profile JSON file:

```text
$DSH_HOME/experimental-auto-review-enhance/<profile>.json
```

Nothing is written into the `permission` Config. The official
`permission.defaultPreset` keeps its normal value, so the composition always
boots.

## Configure the component

1. Open **Plugins → @gitsang/dsh-qol** and make sure
   `@gitsang/dsh-experimental-auto-review-enhance` is enabled.
2. Open this row's **Configure** page.
3. Turn on **Use Auto review by default for new sessions** if new root sessions
   should start in Auto review.
4. Pick the **Denial reason language**: **English** keeps stock behaviour;
   **Chinese** asks the classifier for a Simplified Chinese `reason`.
5. Select **Save**.

The Auto review classifier always returns the same English JSON protocol
(`risk`, `decision`, and an optional `reason`). The `reason` is the free-form
sentence shown to you in the approval prompt or on a denied tool card. The
translation is intentionally limited to that text. Risk values, decision
values, JSON member names, tool-call auditing, and the fixed model-facing denial
message stay in English so the approval protocol remains stable. The language
option only steers the classifier; it does not follow the DSH interface
language automatically.

Unchecking the Auto default and saving clears this plugin's override; new
sessions then follow the normal permission default again. The language choice
is preserved.

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
  changing the component page affects only sessions created *after* that
  change. Change an already-open session with the composer's permission
  control or `/permission <preset>`.
- Delegated subagent sessions are skipped: the Auto integration pins in-process
  children to `never` by design.
- When the Auto integration is not registered, the page disables the Auto
  default control and new sessions keep the normal permission default. A stored
  Auto choice is remembered for when the integration returns, not erased.
- Enabling the Auto default from this component page does **not** show the
  shipped experimental risk confirmation (the shipped UI only gates Full access
  and the current-session Auto pick). Use `/permission auto` if you want that
  gate.
- The plugin wraps live service instance methods and the `session/created`
  timing rather than a public extension point. A future DSH rename of
  `pinInitialPermission` would make it silently inert (it logs a warning)
  rather than break boot. The language option additionally recognizes the
  shipped Auto review system prompt by its `REVIEW_POLICY` banner; if that
  banner changes, the option stops applying but the stock English reviewer
  keeps working. If new sessions stop adopting Auto after a DSH upgrade, check
  the host log for `experimental-auto-review-enhance:` warnings first.

## Troubleshooting

- **The Auto default checkbox is disabled.** The Auto review integration is not
  live in this profile. Enable `@deepseek-ai/dsh-experimental-auto-review` and
  restart the Host.
- **Auto is enabled but new sessions still start on the old preset.** The
  setting applies only to sessions created after **Save**. Update and restart:
  `cd ~/.dsh/profiles/web && pnpm update @gitsang/dsh-experimental-auto-review-enhance`,
  then restart `dsh web`.
- **State file location.** The choice is stored per profile under
  `$DSH_HOME/experimental-auto-review-enhance/<profile>.json`. A choice saved
  by the old `permission-auto` package is still read; the next write uses the
  new directory.

## Verification

On a real Host (`0.2.0-rc.2`, temporary headless profile with the Auto review
integration):

| Check | Result |
| --- | --- |
| The component configuration page reads and writes the Auto default | pass |
| The Auto default is not injected into Settings → Permission | pass |
| Profile patch never receives an unsupported `defaultPreset: auto` | pass |
| A real `agents.create()` in a web composition records `permission/preset: auto` as event 0 | pass |
| Delegated subagent sessions are not touched | pass |
| Auto integration absent ⇒ the control is disabled and stock behaviour applies | pass |
| Chinese language appends a reason-only directive to Auto review requests and leaves other LLM calls untouched | pass |
| The reason directive is never applied when the option is English | pass |

`npm test` runs unit tests over a fake Host context, the configuration endpoint,
and the browser row page registration.

## License

MIT

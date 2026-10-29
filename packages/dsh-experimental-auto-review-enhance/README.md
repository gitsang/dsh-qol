# dsh-experimental-auto-review-enhance

Configure the experimental **Auto review** integration from this component's own
page under **Plugins → @gitsang/dsh-qol → @gitsang/dsh-experimental-auto-review-enhance**:
use Auto review as the default for newly created root sessions, optionally
make the reviewer's denial reason appear in Chinese, and optionally let that
reason reach the session AI. Nothing is injected into the shipped Settings
pages.

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
   the Auto-review new-session default, the reviewer reason language, and
   whether the reason may also reach the session AI. The page stages all
   choices and writes them only on **Save**.
2. Switches **genuinely new root sessions** to the `auto` preset. It wraps
   `permissionPresets.pinInitialPermission` — the single place that decides a
   session's initial preset — and keeps a prepended `session/created` listener
   as a fallback for Hosts where that method is absent or renamed. Both paths
   share one idempotent `adopt()` that only acts on genuinely new sessions.
3. Optionally directs the Auto review classifier to write its free-form denial
   `reason` in Simplified Chinese.
4. Optionally returns the reviewer's own sentence to the session AI. The
   shipped integration keeps that sentence out of model-facing content: a final
   denial carries it only as durable `error.info.reason` (which the UI
   localizes), and a denial that falls back to human approval carries it only
   in the approval prompt. When enabled, the plugin remembers the prompt's
   reason from the `approval/request` event and appends it to that call's
   model-facing error content in `tools/post-execute`; the structured denial
   identity stays untouched, so the UI keeps its localized denial card.

All three choices live in a small per-profile JSON file:

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
5. Turn on **Return the denial reason to the session AI** if the AI should see
   the reviewer's sentence too (off by default).
6. Select **Save**.

The Auto review classifier always returns the same English JSON protocol
(`risk`, `decision`, and an optional `reason`). The `reason` is the free-form
sentence shown to you in the approval prompt or on a denied tool card. The
translation is intentionally limited to that text. Risk values, decision
values, JSON member names, tool-call auditing, and the fixed model-facing denial
message stay in English so the approval protocol remains stable; only the
optional appended reviewer sentence follows the reviewer's language. The
language option only steers the classifier; it does not follow the DSH interface
language automatically.

**Return the denial reason to the session AI** is off by default and needs no
Auto default. When on, a reviewer denial appends one extra line to the error the
AI sees:

```text
Error: Auto review rejected tool "bash"; its body was not executed
Auto review's reason: Writes to /etc/passwd
```

Under the `ask` approval policy the reviewer first asks you; if you reject that
prompt, the same line is appended to the rejection the AI sees. Only a reviewed
denial with an actual `reason` is extended: allow decisions, cancellations,
other tools and other approval askers are untouched, the appended text is
flattened to one line and capped at 400 characters, and the structured
`AutoReviewDeniedError` identity keeps driving the localized UI card.

Unchecking the Auto default and saving clears this plugin's override; new
sessions then follow the normal permission default again. The language and
AI-visibility choices are preserved.

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
  keeps working. The AI-visibility option recognizes the shipped denial by its
  `AutoReviewDeniedError` / `AUTO_REVIEW_DENIED` identity and the reviewer
  prompt by its `Auto review denied tool "<name>":` prefix; if an upstream
  release changes either, the extra reason line silently stops appearing while
  the user-visible reason keeps working. If new sessions stop adopting Auto
  after a DSH upgrade, check the host log for
  `experimental-auto-review-enhance:` warnings first.

## Troubleshooting

- **The Auto default checkbox is disabled.** The Auto review integration is not
  live in this profile. Enable `@deepseek-ai/dsh-experimental-auto-review` and
  restart the Host.
- **Auto is enabled but new sessions still start on the old preset.** The
  setting applies only to sessions created after **Save**. Update and restart:
  `cd ~/.dsh/profiles/web && pnpm update @gitsang/dsh-experimental-auto-review-enhance`,
  then restart `dsh web`.
- **The AI still sees the stock denial message.** The AI-visibility option is
  off, the reviewer denied without a `reason` (a reason-less `deny` is legal),
  the call was cancelled, or another plugin blocked the result first. Turn the
  option on and save; the reviewer always returns a reason for a reviewer
  `deny` unless its policy text leaves it optional.
- **State file location.** The choice is stored per profile under
  `$DSH_HOME/experimental-auto-review-enhance/<profile>.json`. A choice saved
  by the old `permission-auto` package is still read; the next write uses the
  new directory.

## Verification

On a real Host (`0.2.0-rc.2`, temporary headless profile with the Auto review
integration), and in the unit suite plus a real-Cordis listener harness:

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
| An opted-in final reviewer denial appends its reason to the model-facing error, and only then | pass (unit + real-Cordis harness) |
| Rejecting a reviewer prompt returns the reviewer reason to the AI | pass (unit + real-Cordis harness) |
| A prepended observer still sees an approval the web answerer claims | pass (real-Cordis harness) |
| Other tools, other askers, reason-less denials and cancelled calls are untouched | pass (unit) |

`npm test` runs unit tests over a fake Host context, the configuration endpoint,
and the browser row page registration.

## License

MIT

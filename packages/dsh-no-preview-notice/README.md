# @gitsang/dsh-no-preview-notice

Skips the dsh 0.2 **preview notice** ("预览版说明" / "Preview Notice") that
otherwise blocks the new-session page, **without disabling the Models
settings page**.

## Why not just disable `ui-settings-models`?

That row owns both the welcome notice and the whole Models page. Disabling it
removes the notice but also removes provider editing, API-key management and
the `settings.models.*` slots. This package shadows only the notice.

## How it works

`ui-settings-models` registers the notice as an entry of the
`settings.onboarding` list slot with `id: 'welcome-notice'`. A list slot keeps
the first entry per id in ascending `priority` order, so registering the same
id at `priority: -1` shadows that entry. The replacement renders nothing and
calls `complete()` on mount, so the onboarding ledger moves straight to the API
key step.

Nothing else is touched: `ui-settings-models` stays mounted, the Models page,
credential onboarding and every other settings section keep working.

## Install

This component ships with `@gitsang/dsh-qol`; it is not installed as a standalone bundle.

```bash
# Local checkout
dsh plugin --profile web add ~/src/github.com/gitsang/dsh-qol

# Once published
dsh plugin --profile web add @gitsang/dsh-qol
```

Enable `@gitsang/dsh-qol`, then switch this component on or off from its Plugins detail page.

## Verification

- New session page: no preview notice, the API-key step still appears.
- Settings → Models: provider list loads normally.
- The acknowledgement field `welcomeNoticeVersion` is no longer written.

## Compatibility

Couples to two dsh internals: the `settings.onboarding` slot type and the
`welcome-notice` id. If a future dsh release renames either, this entry simply
stops shadowing anything — it becomes one extra onboarding step that completes
itself, so the failure mode is a harmless no-op rather than a broken page.

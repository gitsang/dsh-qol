# @gitsang/dsh-qol

A quality-of-life bundle for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). One plugin, five independently switchable components.

`QOL` stands for **quality of life**: small improvements to everyday interactions rather than new core product features.

## Components

| Component | Package | What it does |
| --- | --- | --- |
| Enter key swap | `@gitsang/dsh-enter-swap` | Enter inserts a newline; Ctrl/Cmd+Enter sends. |
| Skip preview notice | `@gitsang/dsh-no-preview-notice` | Skips the versioned preview welcome notice on the new-session page. |
| Auto review default | `@gitsang/dsh-permission-auto` | Offers the experimental Auto review preset as a new-session default. |
| Reset shell | `@gitsang/dsh-reset-terminals` | `/reset-terminals` plus a composer button that closes persistent PTY sessions before a permission change. |
| Statusline | `@gitsang/dsh-statusline` | Keeps the shipped statistics pills and splits model time into first-token wait and decode. |

Only `@gitsang/dsh-qol` is installed as a bundle. The five component packages are dependencies; they deliberately do **not** declare their own `dsh.bundle`. The bundle patch inserts one Loader row per component, so **Plugins → @gitsang/dsh-qol → Components** lists five independent switches.

## Install

### From a local checkout

```bash
git clone git@github.com:gitsang/dsh-qol.git ~/src/github.com/gitsang/dsh-qol
cd ~/src/github.com/gitsang/dsh-qol
pnpm install
dsh plugin --profile web add ~/src/github.com/gitsang/dsh-qol
```

Then enable `@gitsang/dsh-qol` in `~/.dsh/profiles/web/package.json` under `dsh.profile.bundles`, or switch it on in the Plugins page.

### From npm

Once the packages are published:

```bash
dsh plugin --profile web add @gitsang/dsh-qol
```

## Enable or disable individual components

Open **Plugins → @gitsang/dsh-qol**. The detail page lists the bundle's Loader rows. Each row can be switched on or off without affecting the others; the bundle-level switch turns all five off at once.

Prerequisites:

- `@gitsang/dsh-permission-auto` additionally needs the `@deepseek-ai/dsh-experimental-auto-review` bundle enabled.
- `@gitsang/dsh-statusline` reads only existing session projections; no Host half is required.

## Development

```bash
pnpm install
pnpm -r --if-present test
```

Component packages keep their original names, versions, tests, and READMEs. The previous standalone repositories are archived; their git history remains available under the `gitsang/dsh-*` repositories.

## License

MIT

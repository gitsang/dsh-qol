# @gitsang/dsh-qol

A quality-of-life bundle for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). One plugin, seven independently switchable components.

`QOL` stands for **quality of life**: small improvements to everyday interactions rather than new core product features.

## Components

| Component | Package | What it does |
| --- | --- | --- |
| Enter key swap | `@gitsang/dsh-enter-swap` | Enter inserts a newline; Ctrl/Cmd+Enter sends. |
| Skip preview notice | `@gitsang/dsh-no-preview-notice` | Skips the versioned preview welcome notice on the new-session page. |
| Auto review default | `@gitsang/dsh-experimental-auto-review-enhance` | Sets the experimental Auto review preset as the new-session default from its own Plugins page, with an optional Chinese denial-reason language. |
| Reset shell | `@gitsang/dsh-reset-terminals` | `/reset-terminals` plus a composer button that closes persistent PTY sessions before a permission change. |
| Terminal | `@gitsang/dsh-sidebar-terminal-enhance` | Sets the sidebar terminal's font family, size and line height, and its light/dark/follow-appearance palette. |
| Statusline | `@gitsang/dsh-statusline` | Keeps the shipped statistics pills and splits model time into first-token wait and decode. |
| Session tree | `@gitsang/dsh-session-tree` | Draws branch lineage inline in the native Trajectory ledger, forks from any durable event, and branches before a Turn when a sent message is edited. |

Only `@gitsang/dsh-qol` is installed as a bundle. The seven component packages are dependencies; they deliberately do **not** declare their own `dsh.bundle`. The bundle patch inserts one Loader row per component, so **Plugins → @gitsang/dsh-qol → Components** lists seven independent switches.

## How components are presented

Every component row in **Plugins → @gitsang/dsh-qol** renders identically:

- the title is the full package name (`@gitsang/dsh-statusline`, never a friendly alias);
- the description is that package's own `package.json` description;
- the row id (`statusline`) is shown as code;
- the icon comes from DSH's default plugin artwork. No component package declares
  an `icon`, so all seven rows and the bundle card share the same two-tile fallback.

Adding a package-level `icon` (or a `meta.title` in `locale/*.json`) would make
that one row look different again; leave both out to keep the list uniform.

Components that carry settings provide a **Configure** action on their own row
page under **Plugins → @gitsang/dsh-qol**. Enter-key behavior, terminal font and palette, the Auto review new-session
default, and its reason language are edited and saved there; they are not injected as rows into **Settings → General** or other Settings
pages. Edits stay staged until **Save**, and the form is discarded when you
leave the page.

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

Open **Plugins → @gitsang/dsh-qol**. The detail page lists the bundle's Loader rows. Each row can be switched on or off without affecting the others; the bundle-level switch turns all seven off at once.

Prerequisites:

- `@gitsang/dsh-experimental-auto-review-enhance` additionally needs the `@deepseek-ai/dsh-experimental-auto-review` bundle enabled.
- `@gitsang/dsh-statusline` reads only existing session projections; no Host half is required.
- `@gitsang/dsh-session-tree` uses the Host Session Controller, Session Query, and Workspace services.
- `@gitsang/dsh-sidebar-terminal-enhance` needs no Host logic; it reaches the live
  xterm emulator in the browser and stores the font and palette choices in
  `localStorage`. The chosen font must be installed on the machine running the browser.

## Development

```bash
pnpm install
pnpm -r --if-present test
```

Component packages keep their own versions, tests, and READMEs. The previous standalone repositories are archived; their git history remains available under the `gitsang/dsh-*` repositories.

## License

MIT

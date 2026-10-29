# @gitsang/dsh-qol

A quality-of-life toolkit for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

## Install

```bash
dsh plugin --profile web add @gitsang/dsh-qol
```

## Components

Each component can be toggled on or off individually from its plugin configuration detail page; some components open their own detail page for further configuration.

| Package                                         | What it does                                                                                                                               | Screenshot                                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `@gitsang/dsh-enter-swap`                       | Swaps the bindings so Enter inserts a newline and Ctrl/Cmd+Enter sends.                                                                    |                                                                                                  |
| `@gitsang/dsh-no-preview-notice`                | Skips the versioned preview notice on the new-session page.                                                                                |                                                                                                  |
| `@gitsang/dsh-experimental-auto-review-enhance` | Sets Auto review as the new-session default, with a choice of denial-reason language and whether the reason is returned to the session AI. |                                                                                                  |
| `@gitsang/dsh-reset-terminals`                  | Provides `/reset-terminals` and a composer button that close persistent PTY sessions before a permission change.                           |                                                                                                  |
| `@gitsang/dsh-sidebar-terminal-enhance`         | Sets the sidebar terminal's font family, size and line height, and its light/dark/follow-appearance palette.                               |                                                                                                  |
| `@gitsang/dsh-statusline`                       | Shows more detailed session statistics in the status line.                                                                                 |                                                                                                  |
| `@gitsang/dsh-session-tree`                     | Adds a Trajectory Tree tab, forks from any durable event, and branches before that step after an old message is edited.                    | ![Trajectory Tree with git-style branch lanes](docs/dsh-session-tree-trajectory-branch-tree.png) |

Component notes:

- `@gitsang/dsh-experimental-auto-review-enhance` also needs `@deepseek-ai/dsh-experimental-auto-review` enabled.

## Development

```bash
pnpm install
pnpm -r --if-present test
```

## License

MIT

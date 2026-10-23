---
description: "Choose a light, dark, or follow-appearance palette for the right-sidebar terminal independently of the DSH theme."
---

# @gitsang/dsh-terminal-color

English | [中文](README.zh.md)

## Summary

Adds a **Terminal colors** configuration page under
**Plugins → @gitsang/dsh-qol → @gitsang/dsh-terminal-color** with the same three
choice cubes as Appearance:

- **Light** — keep the terminal on the light palette even when DSH is dark.
- **Dark** — keep the terminal on the dark palette even when DSH is light.
- **Follow appearance** — use the same light/dark palette as the rest of DSH.

The choice is stored in the browser and survives reloads. The terminal's ANSI
palette, application-emitted OSC colors, cursor, and selection behavior remain
owned by the shipped terminal plugin. The selected surface and default text
colors feed the same computed-color path the terminal uses for its xterm theme,
so the cursor accent and default cell colors stay readable.

## Usage

1. Enable `@gitsang/dsh-terminal-color` under **Plugins → @gitsang/dsh-qol**.
2. Open the row's **Configure** page.
3. Pick **Light**, **Dark**, or **Follow appearance**, then select **Save**.

## Scope

Only the sidebar terminal's screen is affected. Other terminal-like surfaces,
other plugins' configuration pages, and the global DSH theme are untouched.

## Development

```bash
pnpm install
pnpm --filter @gitsang/dsh-terminal-color test
```

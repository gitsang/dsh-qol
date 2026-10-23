---
description: "Set the right Sidebar terminal's font family, size and line height from the component's Plugins configuration page, without patching the shipped terminal bundle."
---

# @gitsang/dsh-sidebar-terminal-enhance

English | [中文](README.zh.md)

## Summary

The shipped sidebar terminal builds its xterm emulator with a hard-coded font
stack and offers no configuration:

```js
new Terminal({
  fontSize: 13,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
})
```

That leaves Nerd Font users with tofu glyphs and no supported way to change it.
This package adds a **Terminal font** configuration page under
**Plugins → @gitsang/dsh-qol → @gitsang/dsh-sidebar-terminal-enhance** with
three fields:

| Field | Meaning |
|---|---|
| Font family | Any installed CSS font-family list, e.g. `JetBrainsMono Nerd Font Mono` |
| Size | Integer 8–32 px |
| Line height | Multiplier 0.9–2, useful for icon-only glyph rows |

Saving applies the changes to terminals that are already open, without
reloading them, and persists them in the browser (`localStorage`) so they
survive a page reload. **Reset to defaults** stages the shipped defaults; save
to apply them.

## Why not plain CSS?

xterm measures its cell grid from `options.fontFamily` and `options.fontSize`.
Overriding `.xterm-rows` with CSS would leave that grid on the old metrics, so
columns drift from glyph advances and the cursor lands in the wrong cell. This
package writes the public options instead:

```js
terminal.options.fontFamily = 'JetBrainsMono Nerd Font Mono'
terminal.options.fontSize = 15
terminal.options.lineHeight = 1.2
```

then re-runs the FitAddon and reports the new grid to the Host PTY, which is
the same sequence the shipped body uses after a viewport resize.

## Usage

This package is a component of `@gitsang/dsh-qol`; it declares no `dsh.bundle`
of its own. Install the bundle once and switch this row on:

```bash
dsh plugin --profile web add @gitsang/dsh-qol
```

Then:

1. Open **Plugins → @gitsang/dsh-qol** and make sure
   `@gitsang/dsh-sidebar-terminal-enhance` is enabled.
2. Make sure the font is installed on the machine running the browser.
3. Open the row's **Configure** page and enter the family name — for example
   `JetBrainsMono Nerd Font Mono, Sarasa Term SC Nerd Font, monospace`.
   The family name is not the file name; check it with
   `fc-list : family | grep -i nerd` on Linux or Font Book on macOS.
4. Use the preview line to confirm the icon glyphs render, then select **Save**.

## Scope and behaviour

- Only the right Sidebar's terminal screen is affected; the rest of the DSH
  interface and the conversation code blocks keep their own fonts.
- Blank fields keep the shipped defaults; the reset button clears every
  override at once.
- Font options are applied to each emulator once, when it mounts, through a
  `MutationObserver`. Terminals opened later pick up the current settings.
- Changing the font re-fits the terminal and resizes the Host PTY, so full-screen
  programs see the correct dimensions.
- The browser only resolves fonts installed on the client machine. A font
  installed on the dsh Host does nothing for a remote browser.

## Known limitations

- xterm publishes no DOM handle for its emulator. The component therefore
  reaches the live instance through the React fiber attached to the screen node
  the shipped `TerminalScreen` renders. Every step is shape-checked and guarded,
  so a future React or xterm change degrades to "no font override" instead of
  breaking the terminal — but it can silently stop applying.
- Browser security does not let a page enumerate installed fonts. A typo in the
  family name simply falls back to the next entry in the list.
- A page that already loaded the terminal before this plugin first ran still
  gets adopted by the observer, but its scrollback is not re-wrapped, so old
  lines keep the old column count until a program redraws them.

## Development

```bash
node --test test/*.test.mjs
```

The test suite exercises the option writer, the fiber walk, the settings
normalisation and the persistence path against stand-in emulators; the browser
integration is verified end-to-end in a running `dsh web`.

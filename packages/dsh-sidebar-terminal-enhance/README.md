---
description: "Customize the right Sidebar terminal from its Plugins configuration page: font family, size, line height, and palette, without patching the shipped terminal bundle."
---

# @gitsang/dsh-sidebar-terminal-enhance

English | [中文](README.zh.md)

## Summary

The shipped sidebar terminal builds its xterm emulator with a hard-coded font
stack and follows the global DSH light/dark theme. It offers no configuration
surface. This package adds one **Terminal** configuration page under
**Plugins → @gitsang/dsh-qol → @gitsang/dsh-sidebar-terminal-enhance** with two
groups:

| Group | Field | Meaning |
|---|---|---|
| Font | Font family | Any installed CSS font-family list, e.g. `JetBrainsMono Nerd Font Mono` |
| Font | Size | Integer 8–32 px |
| Font | Line height | Multiplier 0.9–2, useful for icon-only glyph rows |
| Palette | Mode | **Light**, **Dark**, or **Follow appearance** |

Font changes apply to terminals that are already open, without reloading them,
and both groups persist in the browser (`localStorage`) so they survive a page
reload. Clearing every font field restores exactly what the shipped terminal
used. Saving **Follow appearance** removes the palette override and lets the
active DSH theme drive the terminal again.

The page uses the same `SettingsForm`, field, switch and segmented-control
primitives as the official plugin configuration pages. Edits stay staged until
**Save**; leaving the page discards them.

## Why the terminal needs more than plain CSS

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

For color, the shipped terminal derives its xterm palette from the computed
background and text color of its screen element. This package layers two scoped
CSS variables over `[data-sidebar-terminal]` through the public theme override
layer, so the cursor accent, selection and default cell colors stay consistent.

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
4. Choose a palette, use the preview line to confirm the icon glyphs render,
   then select **Save**.

## Scope and behaviour

- Only the right Sidebar's terminal screen is affected; the rest of the DSH
  interface and the conversation code blocks keep their own fonts and theme.
- Blank font fields keep the shipped defaults; **Reset to default** on each
  field clears that override.
- Font options are applied to each emulator once, when it mounts, through a
  `MutationObserver`. Terminals opened later pick up the current settings.
- Changing the font re-fits the terminal and resizes the Host PTY, so full-screen
  programs see the correct dimensions.
- The palette choice is stored under the historical
  `@gitsang/dsh-terminal-color/preference` key, so a choice made before the two
  terminal components were merged survives the upgrade.
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

The test suite exercises the option writer, the fiber walk, font settings
normalisation, palette tokens, both persistence paths against stand-in
emulators, and the configuration-page registration.

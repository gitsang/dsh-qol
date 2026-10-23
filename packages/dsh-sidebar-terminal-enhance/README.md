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
| Font | Font family | Searchable combobox over the Host's installed families, or any typed CSS font-family list |
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

### The font list

The font-family field reads a real catalog from the Host, so family names no
longer have to be guessed:

- typing filters the list — substring hits first, then fuzzy subsequence matches;
- `↑` / `↓` move, `Enter` picks, `Esc` closes;
- the button on the right opens the list on demand;
- **Monospace only** keeps just the faces the Host reports as monospaced;
- the chosen family replaces the last comma-separated segment, so a fallback
  stack such as `JetBrainsMono Nerd Font Mono, Sarasa Term SC Nerd Font, monospace`
  can still be assembled by hand;
- **Refresh list** re-enumerates the Host.

The Host half owns one same-origin route:

```text
GET /sidebar-terminal-enhance/fonts[?refresh=1]
→ { ok: true, source: "fc-list", cached: false,
    fonts: [{ family: "DejaVu Sans Mono", monospace: true }, …] }
```

It shells out with the platform's own tool — `fc-list` (fontconfig) on Linux and
macOS when present, `system_profiler SPFontsDataType -json` as the macOS
fallback, and the .NET `InstalledFontCollection` through PowerShell on Windows —
merges faces into families, marks monospaced ones, and caches the result for ten
minutes. `?refresh=1` bypasses the cache.

The catalog is a **suggestion source, not a validator**. When the browser runs on
a different machine than the Host, the listed families belong to the Host; the
field therefore keeps accepting any typed value, and an unknown family simply
falls through to the browser's own fallback chain.

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
4. The preview shows `0-9a-zA-Z` plus the Nerd Font glyphs
   `U+E627 U+E73C U+F323 U+E620 U+E738 U+ED0D`; confirm they render before
   choosing a palette,
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

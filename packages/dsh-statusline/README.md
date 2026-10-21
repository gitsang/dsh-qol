# @gitsang/dsh-statusline

A DSH statusline that keeps the shipped composer statistics **exactly as they
look** and adds the one thing the stock dialog cannot show: a split of model
time into first-token time and output time.

The composer keeps the original two pills:

```
21 turns 279 steps · 59 tok/s      53.6M tok · Cache hit 99%
```

Clicking the gauge pill opens the same anchored dialog style as before, with
three extra rows:

```
Session statistics
  LLM time               7h18m
  First-token time       6h13m
  Output time            1h00m
  Tool time              28m59s
  Avg time to first token (TTFT)   1m23s
  Tokens per second (TPS)          60 tok/s
```

The token-usage pill keeps its original dialog and wording unchanged.

## Why?

`sessionStats` already records enough to split the **observed** model time:

| Field | Span |
|---|---|
| `llmMs` | `step/start` → `assistant/message` |
| `ttftMs` | `step/start` → first non-empty streamed delta |
| `decodeMs` | first delta → `assistant/message`, on steps that report output tokens (shown as **output time**) |

The dialog shows the total, the first-token span, the output span, tool time,
the average first-token latency, and throughput.

`ttftMs` is a **client-observed wall time**. It includes request dispatch,
networking, server queueing, prefill, and generation of the first token. A
provider that reports true prefill time would need its adapter to record it;
the UI does not relabel a client clock as "prefill" before that exists.

## Visual parity

This package replaces the shipped `stats` cell of `conversation.composer.dock`
(registering the same id at `priority: -1`). It deliberately reuses:

- the shipped `IconGaugeOutlineRegular` and `IconDatabaseOutlineRegular` icons;
- the shipped `useAnchoredPosition` and `useDismissOnOutsidePointer` primitives;
- field-for-field CSS values from `StatsPills.module.css` and
  `stat-dialog.module.css` (pill padding/gap/radius/colors, 12px/20px strip
  type, 300–440px panel, 16px panel padding, elevation, hover and focus states);
- the same `data-composer-stats` hook, so `dsh-mobile`'s existing compact rules
  continue to apply.

Pill boxes and computed styles were compared in a real page against the stock
component: desktop and 390px mobile produce the same 22px row, the same pill
sizes, and the same colors. The only intended visual difference is the taller
time dialog caused by the three added rows.

## Data sources

No Host half, log replay, or provider request is added. The browser half reads
existing Host-computed projections:

| Projection | Used for |
|---|---|
| `sessionStats` | turns, steps, model time, first-token time, output time/tokens, tool time |
| `tokenUsage` | cumulative uncached/cache/output token buckets |

The projections fold the complete durable log, so paging and compaction do not
change the figures. Missing projections hide the affected pill.

## Install

This component ships with `@gitsang/dsh-qol`; it is not installed as a standalone bundle.

```bash
# Local checkout
dsh plugin --profile web add ~/src/github.com/gitsang/dsh-qol

# Once published
dsh plugin --profile web add @gitsang/dsh-qol
```

Enable `@gitsang/dsh-qol`, then switch this component on or off from its Plugins detail page.

## Development

The browser half is plain JavaScript with no build step. It registers through
`window.__ModuleLoader__` and takes React, React DOM, and UI primitives from the
client module table.

```bash
node --check src/client.js
node --test
```

The tests load the real browser half through a fake module-loader registration
and cover the pure folds: time splitting, the unattributed remainder, token
buckets, the shipped cache-hit formatting, and the slot registration.

## Compatibility

- Web profile only; no TUI rendering.
- Timing requires `@deepseek-ai/dsh-session-stats` (`sessionStats`); token
  accounting requires `@deepseek-ai/dsh-token-meter` (`tokenUsage`). Both ship
  with the Web profile.
- The replacement couples to the shipped slot id `stats` in
  `conversation.composer.dock`. If a future release renames it, this package
  becomes an additional pill instead of a replacement; the dialogs still work.
- The shipped **compact / detailed** performance preference is not read by this
  replacement, so the two detailed pills are always rendered when data exists.
- All visible copy is registered in the `statusline` locale namespace
  (`zh` and `en`).

## License

MIT

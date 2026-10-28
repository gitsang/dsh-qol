# @gitsang/dsh-session-tree

A DSH Web component that adds a dedicated **Trajectory Tree** conversation View, drawing Session branch lineage as a git-style graph, and lets you branch a Session from any durable event.

## What it does

- **Dedicated Trajectory Tree tab** — its own Conversation View beside Chat and Trajectory. It does not inject into or restyle the native Trajectory ledger.
- **Git-style lanes** — the Session path you are viewing is re-rooted as lane 0 (the main trunk). Every ancestor Session's other forks and its own later events become side lanes, each labelled by the title of the Session that owns it. Any branch can be opened and becomes lane 0, so no lane is singled out as a global mainline. There are no merge edges.
- **DSH-native visual language** — the same 30px ledger rows, kind pills, borders, and muted colors as Trajectory. The `Turn N` label has its own narrow first column, so it never overlaps the tree lanes or the kind pill.
- **Trajectory-identical content column** — each row's content is shaped like the native Trajectory ledger cell: a tool call splits the tool name from its argument payload (monospace, primary/secondary tone) and carries its result as a `→ output` tail, a failed call shows its recorded error code, and every text row is a bounded one-line preview produced by the renderer's own Markdown-to-text projection. Markdown source (`**bold**`, backticks, link syntax) never leaks into the row.
- **Expand / collapse** — a `−/+` node at each side fork folds the whole descendant subtree and reports how many rows are hidden.
- **Full family** — every Session in the connected family is projected, not only the selected Session's descendants.
- **Fork from any durable event** — every ledger row carries a branch icon; it forks the row's own Session immediately after that row's last durable event, so you can branch from a tool exchange, an injected context message, a compaction, or a mid-Turn assistant step, not just from a user message.
- **Edit a sent message** — the pencil sits beside the Host's own Copy button on every user message. The Host forks from the event immediately before that Turn, then sends the edited prompt into the new Session.
- **No Chat renderer replacement** — the component adds two sibling buttons to the native action row and leaves Copy and every other host control intact.

The source Session is never rewritten. Every branch is an ordinary native DSH Session created with `session.fork`.

## Install

From the bundle (recommended):

```bash
dsh plugin --profile web add ~/src/github.com/gitsang/dsh-qol
```

Then enable `@gitsang/dsh-qol` in **Plugins**. This component is listed as `@gitsang/dsh-session-tree` and can be switched independently.

Standalone:

```bash
dsh plugin --profile web add @gitsang/dsh-session-tree
```

Restart the profile after installing; refresh the browser after UI-only changes.

## Use

1. Open a conversation and switch to **Trajectory Tree**.
2. The Session you opened is shown as the main trunk, even if it was originally created as a fork. Ancestor siblings and the ancestor's own later events are side lanes.
3. To branch from any step: every ledger row carries a branch icon on its right edge. Click it to fork **that row's own Session** immediately after **that row's last durable event**, then open the new Session. This works for tool calls (after their result), injected context, compaction, retries, and mid-Turn assistant steps — not only user messages.
4. To edit a past message: use the pencil beside the native Copy button on a user message. Saving forks the conversation from before that Turn and sends the edited text.

## Semantics

| Action | Fork boundary | Then |
| --- | --- | --- |
| branch icon on a tree row | that row's last event seq in that row's Session (inclusive); for a folded tool row that is its result | new Session opens, no prompt |
| branch action on a user message in Chat | that user message's exact event (inclusive) | new Session opens, no prompt |
| edit user message | event immediately before the Turn's `turn/start` | forks, restores the source route, sends the edited text |

Rows are interleaved across the whole family, so a row on a side lane belongs to an ancestor Session. The row action always forks the Session that owns the row, never the Session currently open.

A tool result is folded into the row of the call that produced it, like in Trajectory, so it is never dropped. The only standalone result rows are results whose call is not among that Session's own visible events (an inherited prefix). Because one row then spans the whole exchange, its branch boundary is the result: cutting between a call and its result would copy a call the Host has to pad with a synthetic outcome, and the new branch would open with a tool that never ran.

The tree only offers a boundary that names a stored event: the synthetic placeholder row for a branch with no own events yet is disabled. Cutting inside an open Turn is legal — the Host closes the copied prefix with synthetic tool results and `forked` step/turn closers.

The component also cancels the source Session's active Turn before branching by default, so an answer you are replacing stops spending tokens.

## Performance

- The Host route reads complete Session logs; the browser caches the latest family projection per Session, so reopening a Session paints the tree immediately while a background refresh runs.
- The tree is a normal React View rendered from one projection; it does not observe or mutate the native Trajectory DOM.
- Each row's plain-text preview is memoized from its stored text, so re-renders (expand/collapse, forking) never re-parse the same Markdown.
- Each rendered row is one ledger entry, so expanding a very large family can still be expensive; collapse branches to keep the DOM small.

## Limitations

- Editing preserves **text** only. Images and files attached to the original user message are not re-uploaded into the new branch.
- Conversation branching does not roll back workspace files, commands, Git state, processes, or other tool side effects.
- The tree route reads complete Session logs; very large families are capped at 100 Sessions in one response.
- `dsh` is pre-release software. This package targets the public Session Controller, Session Query, and Workspace services exposed by DSH `0.2.x`.

## Development

```bash
node --test test/*.test.mjs
```

Host-side projection rules live in `src/tree-data.js` and stay free of Cordis so they can be unit tested directly.

## License

MIT

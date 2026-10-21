# @gitsang/dsh-session-tree

A DSH Web component that adds **Tree View** to the conversation header and lets you branch a Session from any durable event.

## What it does

- **Tree View tab** — appears beside Chat and Trajectory in the conversation header.
- **Branch lineage** — draws the connected Session family (root, forks, and their descendants) and highlights the path to the Session you are viewing.
- **Fork from any event** — every visible event row has a `Fork after` action; the inspector also accepts an exact event sequence.
- **Edit a sent message** — the pencil sits beside the Host's own Copy button on every user message. The Host forks from the event immediately before that Turn, then sends the edited prompt into the new Session.
- **No Chat renderer replacement** — the component adds two sibling buttons to the native action row and leaves Copy and every other host control intact.
- **Open any branch** — click a card once to inspect it, double-click or press `Open` to switch to it. Archived branches are unarchived first.

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

1. Open a conversation.
2. Click **Tree View** in the header.
3. Pick a branch on the left. The right pane lists that branch's own events (the inherited fork prefix is not repeated).
4. To fork:
   - press `Fork after` on an event, or
   - type an exact event sequence under the timeline, or
   - press `Fork at latest event`.
5. To edit a past message: use the pencil beside the native Copy button on a user message. Saving forks the conversation from before that Turn and sends the edited text.

## Semantics

| Action | Fork boundary | Then |
| --- | --- | --- |
| `Fork after` event | that exact event (inclusive) | new Session opens, no prompt |
| exact sequence | that exact event (inclusive) | new Session opens, no prompt |
| edit user message | event immediately before the Turn's `turn/start` | forks, restores the source route, sends the edited text |
| latest event | last durable event | new Session opens, no prompt |

The component also cancels the source Session's active Turn before branching by default, so an answer you are replacing stops spending tokens.

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

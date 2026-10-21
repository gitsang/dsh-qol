# dsh-reset-terminals

Close a session's persistent PTY sessions so dsh can accept a sandbox-mode
change, from either:

- the `/reset-terminals` slash command, or
- a **Reset shell** button in the composer.

`dsh-terminal-bash` rejects a `sandbox/mode` change while the owning Agent
still has an open PTY or an unpublished spawn. The typical symptom is:

```text
cannot change sandbox mode from "workspace-write" to "danger-full-access"
while persistent terminal sessions are open or being created
```

This plugin closes those Agent-owned PTY sessions and waits for cleanup to
settle. It does not close user terminals opened in the right sidebar; those
run through `remote.terminal` and are independent of the Agent sandbox.

## Install

This component ships with `@gitsang/dsh-qol`; it is not installed as a standalone bundle.

```bash
# Local checkout
dsh plugin --profile web add ~/src/github.com/gitsang/dsh-qol

# Once published
dsh plugin --profile web add @gitsang/dsh-qol
```

Enable `@gitsang/dsh-qol`, then switch this component on or off from its Plugins detail page.

## Use

Type:

```text
/reset-terminals
```

Or click **Reset shell** next to the composer's model/permission controls. It
invokes the same command and reports the result as the button tooltip.

Then retry the permission switch:

```text
/permission danger-full-access
```

The next `bash` tool call starts a fresh shell. The old shell's working
directory, exported environment, functions, and background jobs are not
preserved.

## How it resolves the terminal service

The Web profile isolates `ctx.terminals` inside the agent-preset group. The
host half therefore asks the `agentPresets` registry for the terminal service
in the receiving Agent's realm, with direct-context fallbacks for other
compositions.

## Development

```bash
node --test test/
```

The tests drive the command handler with an in-memory terminal double and
cover cleanup, unpublished spawns, cleanup failures, and the isolated preset
realm lookup.

## Limitations

- Closes all Agent-owned PTY sessions, not only the persistent `bash` shell.
- An unpublished spawn cannot be cancelled through the public terminal API;
  wait for creation to finish and run the command again if cleanup reports
  that it is still settling.
- The browser button dispatches the command through `remote.commands`, so each
  click is recorded as a normal slash-command lifecycle in the session log.

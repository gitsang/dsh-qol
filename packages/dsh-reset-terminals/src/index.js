/**
 * Host half of dsh-reset-terminals.
 *
 * Registers /reset-terminals. The command closes every persistent PTY session
 * owned by the receiving Agent, then waits until the terminal registry reports
 * no more owner activity. This is the precondition enforced by
 * dsh-terminal-bash before it accepts a sandbox-mode change.
 */

export const name = 'reset-terminals'
export const inject = ['commands']

const CLOSE_REASON = 'requested by /reset-terminals'
const SETTLE_TIMEOUT_MS = 5000
const SETTLE_POLL_MS = 50

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Resolve the terminal service in the Agent's isolated preset realm.
 *
 * The Web profile isolates `terminals` inside the agent-preset group, so a
 * host plugin cannot reach it through its own context. `agentPresets` knows
 * how to resolve that realm; the two context fallbacks keep the plugin useful
 * in compositions that mount `terminals` globally or directly on the Agent.
 */
function terminalServiceFor(ctx, agent) {
  const presets = ctx.get('agentPresets')
  return (
    presets?.serviceFor(agent, 'terminals') ??
    agent.ctx.get('terminals') ??
    ctx.get('terminals')
  )
}

function errorText(error) {
  return error instanceof Error ? error.message : String(error)
}

export function apply(ctx) {
  ctx.commands.register({
    name: 'reset-terminals',
    description:
      'Close persistent PTY sessions so the current session can change sandbox mode',
    handler: async ({ agent }) => {
      const terminals = terminalServiceFor(ctx, agent)

      if (terminals === undefined) {
        return {
          kind: 'error',
          text: 'The terminal service is not available in this session composition.'
        }
      }

      const sessions = terminals.list(agent)

      if (sessions.length === 0) {
        if (terminals.hasOwnerActivity(agent)) {
          return {
            kind: 'error',
            text: 'A persistent terminal is still being created. Wait a moment and run /reset-terminals again.'
          }
        }
        return {
          kind: 'success',
          text: 'No persistent PTY sessions are open in this session.'
        }
      }

      const failures = []
      for (const session of sessions) {
        try {
          await terminals.kill(agent, session.sessionId, CLOSE_REASON)
        } catch (error) {
          failures.push(`${session.sessionId}: ${errorText(error)}`)
        }
      }

      if (failures.length > 0) {
        return {
          kind: 'error',
          text: `Some persistent PTY sessions could not be closed:\n${failures.join('\n')}`
        }
      }

      const deadline = Date.now() + SETTLE_TIMEOUT_MS
      while (terminals.hasOwnerActivity(agent) && Date.now() < deadline) {
        await sleep(SETTLE_POLL_MS)
      }

      if (terminals.hasOwnerActivity(agent)) {
        return {
          kind: 'error',
          text: 'PTY cleanup is still settling. Wait a moment and run /reset-terminals again.'
        }
      }

      return {
        kind: 'success',
        text:
          `Closed ${sessions.length} persistent PTY session${sessions.length === 1 ? '' : 's'}. ` +
          'You can retry the permission switch now.'
      }
    }
  })
}

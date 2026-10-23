/**
 * Host half of dsh-terminal-color.
 *
 * The component is entirely browser-side: it scopes a pair of CSS variables to
 * the sidebar terminal and persists the chosen colors in localStorage. The
 * Loader row still needs a Host module so the component remains an independent,
 * switchable package in the Plugins page.
 */
export const name = 'terminal-color'

export function apply() {}

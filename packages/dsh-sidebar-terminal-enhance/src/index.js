/**
 * Host half of dsh-sidebar-terminal-enhance.
 *
 * The component is entirely browser-side. It adopts live xterm emulators in
 * the right Sidebar, writes the preferred font options onto them, and re-fits
 * the PTY. The Loader row still needs a Host module so the row stays an
 * independent, switchable component on the bundle's Plugins page.
 */
export const name = 'sidebar-terminal-enhance'

export function apply() {}

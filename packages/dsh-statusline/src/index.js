/**
 * Host half of dsh-statusline.
 *
 * The package owns no Host-side behaviour: every number is read from existing
 * session projections (`sessionStats`, `tokenUsage`, `contextPressure`, and
 * `modelSelection`) by the browser half. The row still has to exist so the
 * client loader mounts that half on the same loader entry.
 */
export const name = 'statusline'

export function apply() {}

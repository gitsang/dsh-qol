/**
 * Host half of dsh-enter-swap.
 *
 * The package carries no Host-side behaviour: the browser half
 * (src/client.js) intercepts composer keydowns and re-dispatches them in the
 * swapped order. The row still has to exist so the client loader mounts that
 * half on the same loader entry.
 */
export const name = 'dsh-enter-swap'

export function apply() {}

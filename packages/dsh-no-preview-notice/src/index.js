/**
 * Host half of dsh-no-preview-notice.
 *
 * The package carries no Host-side behaviour: the browser half registers into
 * the `settings.onboarding` slot. The row still has to exist so the client
 * loader mounts that half on the same loader entry.
 */
export const name = 'dsh-no-preview-notice'

export function apply() {}

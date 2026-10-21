/**
 * Host half of @gitsang/dsh-qol.
 *
 * The bundle owns no Host-side behaviour itself. Its cordis.patch.yml inserts
 * one Loader row per browser component, each backed by its own npm package so
 * the Plugins page can switch them independently.
 */
export const name = 'dsh-qol'

export function apply() {}

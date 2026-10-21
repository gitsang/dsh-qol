/**
 * Browser half of dsh-no-preview-notice.
 *
 * dsh shows the versioned "preview notice" (WelcomeNotice) as the first step
 * of the `settings.onboarding` ledger whenever a blank session is open. The
 * step is registered by ui-settings-models with id `welcome-notice`. A list
 * slot keeps the first entry per id in priority order, so registering the same
 * id at a lower priority shadows the shipped step without touching the Models
 * settings page.
 *
 * The replacement renders nothing and completes the step immediately, so the
 * onboarding ledger moves straight on to the API-key step.
 */
window.__ModuleLoader__.load({
  id: '@gitsang/dsh-no-preview-notice',
  factory: (require) => {
    const React = require('react')
    const module = { exports: {} }
    const exports = module.exports

    /** @param {{ complete: () => void }} props - onboarding step owner props. */
    function SkipWelcomeNotice({ complete }) {
      React.useEffect(() => {
        complete()
      }, [complete])
      return null
    }

    const inject = ['slots']

    function apply(ctx) {
      ctx.slots.inject('settings.onboarding', () =>
        ctx.slots.register(
          {
            name: 'settings.onboarding',
            id: 'welcome-notice',
            order: -100,
            // Same id as the shipped step; a lower priority wins the cell.
            priority: -1,
          },
          SkipWelcomeNotice,
        ),
      )
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})

window.__ModuleLoader__.load({
  id: '@gitsang/dsh-reset-terminals',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const React = require('react')

    const NS = 'resetTerminals'
    const zh = {
      label: '重置终端',
      busy: '关闭中…',
      tooltip: '关闭本会话的持久终端，之后即可切换权限模式',
      closed: '持久终端已关闭，可以重新切换权限。',
      none: '本会话没有打开的持久终端。',
      pending: '持久终端仍在创建中，请稍后再试。',
      failed: '关闭持久终端失败',
      unmatched: 'Host 未提供 /reset-terminals 命令',
      requestFailed: '调用 /reset-terminals 失败'
    }
    const en = {
      label: 'Reset shell',
      busy: 'Closing…',
      tooltip: 'Close this session\u2019s persistent terminals before changing permission mode',
      closed: 'Persistent terminals closed. You can retry the permission switch.',
      none: 'No persistent terminals are open in this session.',
      pending: 'A persistent terminal is still being created. Try again in a moment.',
      failed: 'Could not close persistent terminals',
      unmatched: 'The host does not offer the /reset-terminals command',
      requestFailed: 'Calling /reset-terminals failed'
    }

    const CSS_ID = '@gitsang/dsh-reset-terminals/ResetTerminalsButton.css'
    const CSS = [
      '.dshResetTerminalsButton{border:none;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:var(--dsw-radius-sm);align-items:center;gap:4px;height:28px;padding:0 6px;font:inherit;font-size:13px;font-weight:500;line-height:20px;display:inline-flex;min-width:0}',
      '.dshResetTerminalsButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}',
      '.dshResetTerminalsButton:focus-visible{box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary))}',
      '.dshResetTerminalsButton:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}',
      '.dshResetTerminalsButtonIcon{flex:none;display:inline-flex}',
      '.dshResetTerminalsButtonLabel{white-space:nowrap;text-overflow:ellipsis;overflow:hidden}',
      '@container (width<=460px){.dshResetTerminalsButtonLabel{display:none}}'
    ].join('')
    if (
      typeof document !== 'undefined' &&
      document.querySelector('style[data-plugin-css=' + JSON.stringify(CSS_ID) + ']') === null
    ) {
      const tag = document.createElement('style')
      tag.dataset.plugin = '@gitsang/dsh-reset-terminals'
      tag.dataset.pluginCss = CSS_ID
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    function ResetTerminalsButton({ reset, t }) {
      const [busy, setBusy] = React.useState(false)
      const [notice, setNotice] = React.useState(null)
      const [failed, setFailed] = React.useState(false)

      React.useEffect(() => {
        if (notice === null) return
        const timer = setTimeout(() => {
          setNotice(null)
          setFailed(false)
        }, 6000)
        return () => clearTimeout(timer)
      }, [notice])

      const onClick = async () => {
        setBusy(true)
        setNotice(null)
        setFailed(false)
        try {
          const execution = await reset()
          const result = execution?.result
          if (result?.kind === 'error') {
            setFailed(true)
            setNotice(result.text ?? t('failed'))
          } else {
            setNotice(result?.text ?? t('closed'))
          }
        } catch (error) {
          setFailed(true)
          setNotice(error instanceof Error ? error.message : String(error))
        } finally {
          setBusy(false)
        }
      }

      const label = busy ? t('busy') : t('label')
      return React.createElement(
        'button',
        {
          type: 'button',
          className: 'dshResetTerminalsButton',
          disabled: busy,
          title: notice ?? t('tooltip'),
          'aria-label': notice === null ? t('tooltip') : `${t('tooltip')}: ${notice}`,
          'data-failed': failed ? 'true' : undefined,
          onClick
        },
        React.createElement(
          'span',
          {
            className: 'dshResetTerminalsButtonIcon',
            'aria-hidden': true,
            style: failed ? { color: 'var(--dsw-alias-state-error-primary,#d00)' } : undefined
          },
          '\u27f3'
        ),
        React.createElement(
          'span',
          { className: 'dshResetTerminalsButtonLabel' },
          label
        )
      )
    }

    const inject = ['slots', 'remote', 'remote.commands', 'locale']

    function apply(ctx) {
      ctx.effect(
        () => ctx.locale.register(NS, { zh, en }),
        'reset-terminals: dictionaries'
      )
      const t = ctx.locale.bind(NS)

      ctx.slots.inject('conversation.input.right', () =>
        ctx.slots.register(
          {
            name: 'conversation.input.right',
            id: 'reset-terminals',
            locale: NS,
            inject: (sessionId) => ({
              reset: async () => {
                const result = await ctx.remote.commands.execute(
                  sessionId,
                  '/reset-terminals',
                  []
                )
                if (!result.ok) {
                  throw new Error(
                    `${t('requestFailed')}: ${result.error.code}: ${result.error.message}`
                  )
                }
                if (result.value === undefined) throw new Error(t('unmatched'))
                return result.value
              }
            })
          },
          ResetTerminalsButton
        )
      )
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  }
})

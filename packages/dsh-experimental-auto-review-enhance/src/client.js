/**
 * Browser half of dsh-experimental-auto-review-enhance.
 *
 * The Host state file owns both choices this component exposes: whether newly
 * created root sessions start in Auto review, and the language of the
 * reviewer's user-visible denial reason. This page is their editor on the
 * component's Plugins row. A row nested inside the @gitsang/dsh-qol bundle has
 * no Settings namespace of its own, so the page reads and writes the Host's
 * same-origin endpoint instead of a generated Config form.
 *
 * The page stages choices and writes them only on Save, matching every other
 * plugin configuration page in DSH.
 */
window.__ModuleLoader__.load({
  id: '@gitsang/dsh-experimental-auto-review-enhance',
  factory: (require) => {
    const React = require('react')
    const primitives = require('@deepseek-ai/dsh-client-ui-primitives')
    const { SegmentedControl, SettingsForm, Switch } = primitives
    const module = { exports: {} }
    const exports = module.exports

    /** Dictionary namespace owned by this plugin. */
    const NS = 'autoReviewEnhance'

    /** Configuration endpoint owned by the Host half. */
    const CONFIG_PATH = '/experimental-auto-review-enhance/config'

    /**
     * Key the QOL bundle's Plugins page looks up. The key names the bundle
     * whose page hosts the row (`@gitsang/dsh-qol`) plus the row id declared in
     * that bundle's patch.
     */
    const ROW_KEY = '@gitsang/dsh-qol#experimental-auto-review-enhance'

    const zh = {
      title: 'Auto review 设置',
      autoTitle: '新会话默认使用 Auto review',
      autoHint: '开启后，新建的顶层会话会使用 Auto review 权限；恢复、续接和分叉的会话保持原权限。',
      autoUnavailable: 'Auto review 集成当前不可用，无法开启这个默认值。',
      language: '拒绝理由语言',
      languageHint: '仅影响 Auto review 拒绝时展示给用户的理由；审批协议本身始终保持英文。',
      english: '英文',
      chinese: '中文',
      summary: '配置 Auto review 新会话默认值与拒绝理由语言',
      save: '保存',
      saving: '正在保存…',
      saveFailed: '保存失败，请重试。',
      readOnly: '当前部署的设置为只读。',
      unavailable: '该组件当前不可配置。',
      loadFailed: '读取设置失败。',
      retry: '重试',
      loading: '加载中…',
    }

    const en = {
      title: 'Auto review settings',
      autoTitle: 'Use Auto review by default for new sessions',
      autoHint: 'When on, newly created root sessions start in Auto review. Restored, resumed, and forked sessions keep their existing permission.',
      autoUnavailable: 'The Auto review integration is unavailable, so this default cannot be enabled.',
      language: 'Denial reason language',
      languageHint: 'Only changes the reason shown to you when Auto review denies a call; the approval protocol itself stays in English.',
      english: 'English',
      chinese: 'Chinese',
      summary: 'Configure the Auto review new-session default and denial-reason language',
      save: 'Save',
      saving: 'Saving…',
      saveFailed: 'Could not save. Try again.',
      readOnly: 'This deployment stores settings read-only.',
      unavailable: 'This component cannot be configured right now.',
      loadFailed: 'Could not read the settings.',
      retry: 'Retry',
      loading: 'Loading…',
    }

    /** Normalize one stored language; English is the fallback. */
    function normalizeLanguage(value) {
      return value === 'zh' ? 'zh' : 'en'
    }

    /**
     * Normalize one configuration response.
     * @param {unknown} value - parsed Host response.
     * @returns {{defaultPreset:'auto'|'', reviewLanguage:'en'|'zh', autoAvailable:boolean}} config.
     */
    function normalizeConfig(value) {
      const source = value !== null && typeof value === 'object' ? value : {}
      return {
        defaultPreset: source.defaultPreset === 'auto' ? 'auto' : '',
        reviewLanguage: normalizeLanguage(source.reviewLanguage),
        autoAvailable: source.autoAvailable !== false,
      }
    }

    /** Request the current configuration from the Host. */
    async function readConfig() {
      const response = await fetch(CONFIG_PATH, { credentials: 'same-origin' })
      if (!response.ok) throw new Error(`config read failed: ${String(response.status)}`)
      return normalizeConfig(await response.json())
    }

    /** Persist the component configuration on the Host. */
    async function writeConfig(config) {
      const normalized = normalizeConfig(config)
      const response = await fetch(CONFIG_PATH, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          defaultPreset: normalized.defaultPreset,
          reviewLanguage: normalized.reviewLanguage,
        }),
      })
      if (!response.ok) throw new Error(`config write failed: ${String(response.status)}`)
      return normalizeConfig(await response.json())
    }

    /** The shared styles for the page's custom field wrappers. */
    const styles = {
      field: { display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px 0' },
      fieldDivider: { display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px 0', borderTop: '0.5px solid var(--dsw-alias-border-l2)' },
      label: { fontSize: '13px', fontWeight: 500, lineHeight: '1.5', color: 'var(--dsw-alias-label-primary)' },
      toggleRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' },
      hint: { margin: 0, fontSize: '12px', lineHeight: '1.5', color: 'var(--dsw-alias-label-tertiary)' },
      warning: { margin: 0, fontSize: '12px', lineHeight: '1.5', color: 'var(--dsw-alias-state-error-primary)' },
      error: { margin: 0, color: 'var(--dsw-alias-label-error)' },
      footer: { display: 'flex', justifyContent: 'flex-end' },
      save: (active) => ({
        minHeight: '32px',
        padding: '0 14px',
        border: 'none',
        borderRadius: 'var(--dsw-radius-md)',
        background: active ? 'var(--dsw-alias-button-primary-fill)' : 'var(--dsw-alias-bg-module-platform)',
        color: active ? 'var(--dsw-alias-label-primary-foreground)' : 'var(--dsw-alias-label-tertiary)',
        font: 'inherit',
        cursor: active ? 'pointer' : 'default',
      }),
    }

    /**
     * Render the component's row configuration page.
     *
     * @param {{ view?: string, t: Function }} props - owner props: `summary`
     *   is the list one-liner, `page` asks for the editor.
     * @returns {unknown} the page or the one-liner.
     */
    function AutoReviewConfig({ view, t }) {
      const [current, setCurrent] = React.useState(() => normalizeConfig(undefined))
      const [draft, setDraft] = React.useState(() => normalizeConfig(undefined))
      const [status, setStatus] = React.useState('loading')
      const [failed, setFailed] = React.useState(false)

      const load = React.useCallback(async () => {
        setStatus('loading')
        setFailed(false)
        try {
          const config = await readConfig()
          setCurrent(config)
          setDraft(config)
          setStatus('ready')
        } catch {
          setStatus('error')
        }
      }, [])

      React.useEffect(() => {
        if (view !== 'summary') void load()
      }, [load, view])

      if (view === 'summary') return t('summary')

      const saving = status === 'saving'
      const dirty = draft.defaultPreset !== current.defaultPreset || draft.reviewLanguage !== current.reviewLanguage
      const autoBlocked = !current.autoAvailable
      const shell = {
        available: status !== 'error',
        writable: true,
        dirty,
        invalid: false,
        saving,
        failed,
      }
      const save = async () => {
        if (!dirty || saving) return
        setStatus('saving')
        setFailed(false)
        try {
          const accepted = await writeConfig(draft)
          setCurrent(accepted)
          setDraft(accepted)
          setStatus('ready')
        } catch {
          setFailed(true)
          setStatus('ready')
        }
      }

      if (status === 'loading') {
        return React.createElement('p', { role: 'status', style: styles.hint }, t('loading'))
      }

      if (status === 'error') {
        return React.createElement(
          'div',
          { style: styles.field },
          React.createElement('p', { role: 'alert', style: styles.error }, t('loadFailed')),
          React.createElement(
            'button',
            { type: 'button', onClick: () => { void load() }, style: styles.save(true) },
            t('retry'),
          ),
        )
      }

      return React.createElement(
        SettingsForm,
        {
          labels: {
            unavailable: t('unavailable'),
            readOnly: t('readOnly'),
            saveFailed: t('saveFailed'),
            save: t('save'),
            saving: t('saving'),
          },
          state: shell,
          onSave: () => { void save() },
          onDiscard: () => { setDraft(current); setFailed(false) },
        },
        React.createElement(
          'div',
          { style: styles.field },
          React.createElement(
            'div',
            { style: styles.toggleRow },
            React.createElement('span', { style: styles.label }, t('autoTitle')),
            React.createElement(Switch, {
              checked: draft.defaultPreset === 'auto',
              disabled: saving || autoBlocked,
              label: t('autoTitle'),
              onChange: (checked) => {
                setDraft((previous) => ({ ...previous, defaultPreset: checked ? 'auto' : '' }))
              },
            }),
          ),
          React.createElement('p', { style: styles.hint }, t('autoHint')),
          autoBlocked ? React.createElement('p', { style: styles.warning }, t('autoUnavailable')) : null,
        ),
        React.createElement(
          'div',
          { style: styles.fieldDivider },
          React.createElement('span', { style: styles.label }, t('language')),
          React.createElement(SegmentedControl, {
            id: 'auto-review-enhance-language',
            value: draft.reviewLanguage,
            options: [
              { value: 'en', label: t('english') },
              { value: 'zh', label: t('chinese') },
            ],
            onChange: (reviewLanguage) => {
              setDraft((previous) => ({ ...previous, reviewLanguage: normalizeLanguage(reviewLanguage) }))
            },
            label: t('language'),
            disabled: saving,
          }),
          React.createElement('p', { style: styles.hint }, t('languageHint')),
        ),
      )
    }

    const inject = ['slots', 'locale']

    /**
     * Register the row page and its dictionaries.
     * @param {object} ctx - browser plugin context.
     */
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'auto-review-enhance: dictionaries')
      ctx.slots.inject('plugins.row.config', () => ctx.slots.register({
        name: 'plugins.row.config',
        key: ROW_KEY,
        locale: NS,
      }, AutoReviewConfig))
    }

    exports.apply = apply
    exports.inject = inject
    exports.__test = { normalizeConfig, normalizeLanguage, readConfig, writeConfig, AutoReviewConfig, NS, ROW_KEY, CONFIG_PATH }
    return module.exports
  },
})

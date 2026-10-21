/**
 * Browser half of @gitsang/dsh-session-tree.
 *
 * Adds a `Tree View` Conversation tab and a compact edit affordance on user
 * messages. Tree data and branch mutations travel through the package's
 * same-origin Host route; navigation uses the public Workspace UI service.
 */
window.__ModuleLoader__.load({
  id: '@gitsang/dsh-session-tree',
  factory: (require) => {
    const React = require('react')
    const ReactDOM = require('react-dom')
    const module = { exports: {} }
    const exports = module.exports

    const ROUTE = '/session-tree'
    const NS = 'sessionTree'

    const zh = {
      tab: 'Tree View',
      title: '会话分支树',
      subtitle: '{count} 个分支 · 当前 {current}',
      refresh: '刷新',
      loading: '正在读取会话树…',
      empty: '这个会话还没有可展示的事件。',
      error: '读取会话树失败',
      retry: '重试',
      current: '当前',
      archived: '已归档',
      subagent: '子代理',
      open: '打开',
      branches: '分支',
      selected: '选中的分支',
      timeline: '事件时间线',
      forkAfter: '从此后分叉',
      forkBefore: '从此前分叉',
      editAndFork: '编辑并分叉',
      forkLatest: '从最新事件分叉',
      exactSeq: '指定事件序号',
      exactPlaceholder: '事件 #',
      forkExact: '分叉',
      cancel: '取消',
      send: '发送',
      saving: '处理中…',
      editHint: '编辑后会从这条用户消息所在轮次之前分叉，并发送修改后的内容。',
      forkHint: '分支会从所选的已持久化事件之后开始，原会话不会被修改。',
      noEvents: '没有可显示的事件（只有继承前缀或非展示事件）。',
      emptyDraft: '消息不能为空。',
      eventSeq: '事件 #{seq}',
      turn: '第 {turn} 轮',
      branchFrom: '分叉自 #{seq}',
      ownTurns: '{count} 轮',
      ownEvents: '{count} 个事件',
      userEdit: '编辑消息',
      userFork: '分叉',
      editTitle: '编辑这条消息',
      childCreated: '已创建新分支',
      openFailed: '新分支已创建，但暂时无法打开',
      requestFailed: '请求失败',
      truncated: '只显示了前 {count} 个分支。',
      path: '当前路径',
      running: '生成中',
      'role.user': '用户',
      'role.context': '上下文',
      'role.assistant': '助手',
      'role.tool': '工具',
      'role.tool-result': '工具结果',
      'role.turn-end': '轮次结束',
      'role.retry': '重试',
      'role.compaction': '压缩',
    }

    const en = {
      tab: 'Tree View',
      title: 'Conversation tree',
      subtitle: '{count} branches · current {current}',
      refresh: 'Refresh',
      loading: 'Reading the conversation tree…',
      empty: 'This conversation has no displayable events yet.',
      error: 'Could not read the conversation tree',
      retry: 'Retry',
      current: 'Current',
      archived: 'Archived',
      subagent: 'Subagent',
      open: 'Open',
      branches: 'Branches',
      selected: 'Selected branch',
      timeline: 'Event timeline',
      forkAfter: 'Fork after',
      forkBefore: 'Fork before',
      editAndFork: 'Edit & fork',
      forkLatest: 'Fork at latest event',
      exactSeq: 'Exact event',
      exactPlaceholder: 'Event #',
      forkExact: 'Fork',
      cancel: 'Cancel',
      send: 'Send',
      saving: 'Working…',
      editHint: 'Editing forks before the Turn containing this user message, then sends the edited prompt.',
      forkHint: 'A branch begins after the chosen durable event. The source Session is never rewritten.',
      noEvents: 'No displayable events (inherited prefix or non-presentation events only).',
      emptyDraft: 'The message cannot be empty.',
      eventSeq: 'Event #{seq}',
      turn: 'Turn {turn}',
      branchFrom: 'forked at #{seq}',
      ownTurns: '{count} turns',
      ownEvents: '{count} events',
      userEdit: 'Edit message',
      userFork: 'Branch',
      editTitle: 'Edit this message',
      childCreated: 'New branch created',
      openFailed: 'The branch was created but could not be opened yet',
      requestFailed: 'Request failed',
      truncated: 'Showing the first {count} branches.',
      path: 'Current path',
      running: 'Running',
      'role.user': 'User',
      'role.context': 'Context',
      'role.assistant': 'Assistant',
      'role.tool': 'Tool',
      'role.tool-result': 'Tool result',
      'role.turn-end': 'Turn end',
      'role.retry': 'Retry',
      'role.compaction': 'Compaction',
    }

    let t = (key, params) => {
      let out = en[key] ?? key
      if (params !== undefined) {
        for (const name of Object.keys(params)) out = out.replace(`{${name}}`, String(params[name]))
      }
      return out
    }

    const CSS_ID = '@gitsang/dsh-session-tree/SessionTree.css'
    const CSS = [
      '.dst-root{box-sizing:border-box;height:100%;min-height:0;display:flex;flex-direction:column;background:var(--dsw-alias-bg-primary);color:var(--dsw-alias-label-primary);overflow:hidden}',
      '.dst-toolbar{flex:none;display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:.5px solid var(--dsw-alias-border-l2);min-width:0}',
      '.dst-toolbarMain{min-width:0;flex:1;display:flex;flex-direction:column;gap:2px}',
      '.dst-title{font-size:14px;font-weight:600;line-height:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.dst-subtitle{font-size:11.5px;line-height:16px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.dst-toolbarActions{display:flex;align-items:center;gap:6px;flex:none}',
      '.dst-button{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:4px;flex:none;border:.5px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);border-radius:8px;padding:4px 9px;font:inherit;font-size:12px;line-height:18px;cursor:pointer;white-space:nowrap}',
      '.dst-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.dst-button:disabled{opacity:.45;cursor:default}',
      '.dst-button[data-primary]{background:var(--dsw-alias-state-business-primary,#4b8dff);border-color:transparent;color:#fff}',
      '.dst-button[data-primary]:hover:not(:disabled){background:var(--dsw-alias-state-business-primary,#4b8dff);filter:brightness(1.06);color:#fff}',
      '.dst-body{flex:1;min-height:0;display:grid;grid-template-columns:minmax(240px,.85fr) minmax(300px,1.15fr)}',
      '.dst-pane{min-width:0;min-height:0;overflow:auto;padding:14px 16px}',
      '.dst-pane + .dst-pane{border-left:.5px solid var(--dsw-alias-border-l2)}',
      '.dst-sectionLabel{font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary);margin:0 0 8px}',
      '.dst-tree{display:flex;flex-direction:column;gap:0;min-width:max-content}',
      '.dst-branch{position:relative;min-width:0}',
      '.dst-children{margin-left:16px;padding-left:14px;border-left:1px solid color-mix(in srgb,var(--dsw-alias-label-tertiary,#888) 28%,transparent);display:flex;flex-direction:column;gap:7px;padding-top:7px}',
      '.dst-session{box-sizing:border-box;display:flex;align-items:flex-start;gap:8px;width:100%;min-width:240px;max-width:380px;text-align:left;border:.5px solid color-mix(in srgb,var(--dsw-alias-label-tertiary,#888) 26%,transparent);background:color-mix(in srgb,var(--dsw-alias-label-tertiary,#888) 7%,transparent);color:inherit;border-radius:11px;padding:9px 10px;cursor:pointer;font:inherit}',
      '.dst-session:hover{border-color:color-mix(in srgb,var(--dsw-alias-label-tertiary,#888) 48%,transparent);background:var(--dsw-alias-interactive-bg-hover)}',
      '.dst-session[data-current]{border-color:var(--dsw-alias-state-business-primary,#4b8dff);box-shadow:0 0 0 1px color-mix(in srgb,var(--dsw-alias-state-business-primary,#4b8dff) 45%,transparent)}',
      '.dst-session[data-selected]{background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#4b8dff) 11%,transparent)}',
      '.dst-session[data-on-path]:not([data-current]){border-left:3px solid color-mix(in srgb,var(--dsw-alias-state-business-primary,#4b8dff) 60%,transparent)}',
      '.dst-sessionGlyph{flex:none;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;border-radius:7px;background:color-mix(in srgb,var(--dsw-alias-label-tertiary,#888) 16%,transparent);color:var(--dsw-alias-label-secondary);font-size:12px}',
      '.dst-session[data-current] .dst-sessionGlyph{background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#4b8dff) 18%,transparent);color:var(--dsw-alias-state-business-primary,#4b8dff)}',
      '.dst-sessionMain{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}',
      '.dst-sessionTitle{font-size:12.5px;font-weight:600;line-height:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.dst-sessionMeta{font-size:11px;line-height:15px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.dst-badges{display:flex;gap:4px;flex-wrap:wrap;margin-top:2px}',
      '.dst-badge{font-size:10px;line-height:14px;border-radius:999px;padding:0 6px;background:color-mix(in srgb,var(--dsw-alias-label-tertiary,#888) 16%,transparent);color:var(--dsw-alias-label-secondary)}',
      '.dst-badge[data-accent]{background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#4b8dff) 16%,transparent);color:var(--dsw-alias-state-business-primary,#4b8dff)}',
      '.dst-detailHead{display:flex;align-items:flex-start;gap:10px;padding-bottom:10px;border-bottom:.5px solid var(--dsw-alias-border-l2);margin-bottom:10px}',
      '.dst-detailTitle{font-size:13px;font-weight:600;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}',
      '.dst-detailId{font-size:10.5px;line-height:15px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}',
      '.dst-detailActions{margin-left:auto;display:flex;gap:6px;flex:none}',
      '.dst-hint{font-size:11.5px;line-height:17px;color:var(--dsw-alias-label-tertiary);margin:0 0 12px;padding:8px 10px;border-radius:8px;background:color-mix(in srgb,var(--dsw-alias-label-tertiary,#888) 8%,transparent)}',
      '.dst-turnGroup{display:flex;flex-direction:column;gap:6px;margin-bottom:12px}',
      '.dst-turnLabel{font-size:10.5px;font-weight:600;color:var(--dsw-alias-label-tertiary);letter-spacing:.03em;text-transform:uppercase}',
      '.dst-event{border:.5px solid color-mix(in srgb,var(--dsw-alias-label-tertiary,#888) 20%,transparent);border-radius:9px;padding:8px 9px;background:color-mix(in srgb,var(--dsw-alias-label-tertiary,#888) 4%,transparent)}',
      '.dst-event[data-editable]{border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary,#4b8dff) 32%,transparent)}',
      '.dst-eventHead{display:flex;align-items:center;gap:6px;min-width:0}',
      '.dst-role{font-size:10px;line-height:15px;font-weight:600;border-radius:999px;padding:0 6px;background:color-mix(in srgb,var(--dsw-alias-label-tertiary,#888) 17%,transparent);color:var(--dsw-alias-label-secondary);flex:none}',
      '.dst-role[data-role=user]{background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#4b8dff) 16%,transparent);color:var(--dsw-alias-state-business-primary,#4b8dff)}',
      '.dst-role[data-role=assistant]{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#20a464) 14%,transparent);color:var(--dsw-alias-state-success-primary,#20a464)}',
      '.dst-role[data-role=tool],.dst-role[data-role=tool-result]{background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#c98a00) 14%,transparent);color:var(--dsw-alias-state-warning-primary,#c98a00)}',
      '.dst-seq{font-size:10px;line-height:15px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;flex:none}',
      '.dst-eventText{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);margin-top:4px;white-space:pre-wrap;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}',
      '.dst-eventActions{display:flex;gap:5px;justify-content:flex-end;margin-top:6px;flex-wrap:wrap}',
      '.dst-editor{margin-top:7px;display:flex;flex-direction:column;gap:6px}',
      '.dst-textarea{box-sizing:border-box;width:100%;min-height:70px;resize:vertical;border:.5px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-primary);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:18px;padding:7px 8px;outline:none}',
      '.dst-textarea:focus{border-color:var(--dsw-alias-state-business-primary,#4b8dff)}',
      '.dst-exact{display:flex;align-items:center;gap:6px;padding-top:10px;margin-top:8px;border-top:.5px solid var(--dsw-alias-border-l2);flex-wrap:wrap}',
      '.dst-exactLabel{font-size:11px;color:var(--dsw-alias-label-tertiary)}',
      '.dst-input{width:94px;box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-primary);color:var(--dsw-alias-label-primary);font:inherit;font-size:11.5px;line-height:18px;padding:3px 7px;outline:none}',
      '.dst-input:focus{border-color:var(--dsw-alias-state-business-primary,#4b8dff)}',
      '.dst-empty{margin:auto;padding:28px 20px;text-align:center;font-size:12.5px;line-height:19px;color:var(--dsw-alias-label-tertiary);max-width:420px}',
      '.dst-error{font-size:11.5px;line-height:17px;color:var(--dsw-alias-state-error-primary,#e5484d);padding:7px 9px;border-radius:7px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5484d) 9%,transparent);margin:8px 0}',
      '.dst-loading{display:flex;align-items:center;justify-content:center;height:100%;font-size:12.5px;color:var(--dsw-alias-label-tertiary)}',
      '.dst-hostAction{display:inline-flex;align-items:center;justify-content:center;width:calc(28px + var(--dsh-content-font-delta,0px));height:calc(28px + var(--dsh-content-font-delta,0px));padding:6px;border:none;border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer}',
      '.dst-hostAction:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}',
      '.dst-hostAction:disabled{opacity:.4;cursor:default}',
      '.dst-hostAction svg{width:calc(15px + var(--dsh-content-font-delta,0px));height:calc(15px + var(--dsh-content-font-delta,0px))}',
      '.dst-modalBackdrop{position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.36)}',
      '.dst-modal{box-sizing:border-box;width:min(620px,100%);max-height:min(80vh,640px);display:flex;flex-direction:column;gap:10px;border-radius:14px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-primary));color:var(--dsw-alias-label-primary);box-shadow:var(--dsw-elevation-prominent,0 16px 48px rgba(0,0,0,.28));padding:18px}',
      '.dst-modalHead{display:flex;align-items:flex-start;gap:10px}',
      '.dst-modalTitle{font-size:14px;font-weight:600;line-height:20px;min-width:0;flex:1}',
      '.dst-modalHint{font-size:11.5px;line-height:17px;color:var(--dsw-alias-label-tertiary);margin:0}',
      '.dst-modalTextarea{box-sizing:border-box;width:100%;min-height:150px;max-height:48vh;resize:vertical;border:.5px solid var(--dsw-alias-border-l2);border-radius:9px;background:var(--dsw-alias-bg-primary);color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;line-height:23px;padding:10px 11px;outline:none}',
      '.dst-modalTextarea:focus{border-color:var(--dsw-alias-state-business-primary,#4b8dff)}',
      '.dst-modalActions{display:flex;justify-content:flex-end;gap:7px;flex-wrap:wrap}',
      '.dst-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:1300;max-width:min(620px,calc(100vw - 32px));box-sizing:border-box;border-radius:10px;padding:9px 13px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-primary));box-shadow:var(--dsw-elevation-prominent,0 10px 30px rgba(0,0,0,.24));color:var(--dsw-alias-label-primary);font-size:12px;line-height:18px}',
      '.dst-toast[data-error]{color:var(--dsw-alias-state-error-primary,#e5484d)}',
      '@media (max-width:760px){.dst-body{grid-template-columns:1fr;grid-template-rows:minmax(180px,.8fr) minmax(220px,1.2fr)}.dst-pane + .dst-pane{border-left:0;border-top:.5px solid var(--dsw-alias-border-l2)}.dst-session{max-width:none}}',
    ].join('')

    function realGlobal() {
      try {
        if (typeof window !== 'undefined' && window !== null) return window
      } catch {}
      try {
        if (typeof globalThis !== 'undefined') return globalThis
      } catch {}
      return null
    }

    function installStyles() {
      const g = realGlobal()
      if (g === null || g.document === undefined || g.document.head === undefined) return undefined
      const previous = g.document.querySelector(`style[data-plugin-css=${JSON.stringify(CSS_ID)}]`)
      if (previous !== null) previous.remove()
      const tag = g.document.createElement('style')
      tag.dataset.plugin = '@gitsang/dsh-session-tree'
      tag.dataset.pluginCss = CSS_ID
      tag.textContent = CSS
      g.document.head.appendChild(tag)
      return () => tag.remove()
    }

    /** Text blocks only; tree edits intentionally preserve text and leave files/images to the source message. */
    function textFromContent(content) {
      if (!Array.isArray(content)) return ''
      return content
        .filter((part) => part !== null && typeof part === 'object' && part.type === 'text')
        .map((part) => typeof part.text === 'string' ? part.text : '')
        .join('\n')
    }

    function imageParts(content) {
      if (!Array.isArray(content)) return []
      return content
        .filter((part) => part !== null && typeof part === 'object' && part.type === 'image' && part.attachment !== undefined)
        .map((part) => ({ attachment: part.attachment }))
    }

    function sessionTitle(list, sessionId) {
      const row = list?.byId?.[sessionId]
      return typeof row?.displayTitle === 'string' && row.displayTitle.length > 0 ? row.displayTitle : sessionId
    }

    function countPath(data, currentId) {
      const byId = new Map((data?.sessions ?? []).map((session) => [session.sessionId, session]))
      const path = new Set()
      let cursor = currentId
      for (let guard = 0; guard < 100 && typeof cursor === 'string'; guard += 1) {
        if (path.has(cursor)) break
        path.add(cursor)
        const parent = byId.get(cursor)?.parentSessionId
        if (typeof parent !== 'string') break
        cursor = parent
      }
      return path
    }

    function buildChildren(data) {
      const byId = new Map((data?.sessions ?? []).map((session) => [session.sessionId, session]))
      const children = new Map()
      for (const session of data?.sessions ?? []) {
        const parent = session.parentSessionId
        if (typeof parent !== 'string' || !byId.has(parent)) continue
        const bucket = children.get(parent)
        if (bucket === undefined) children.set(parent, [session.sessionId])
        else bucket.push(session.sessionId)
      }
      for (const bucket of children.values()) {
        bucket.sort((left, right) => {
          const a = byId.get(left)?.createdAt ?? 0
          const b = byId.get(right)?.createdAt ?? 0
          return a - b || left.localeCompare(right)
        })
      }
      return { byId, children }
    }

    function groupByTurn(events) {
      const groups = []
      const index = new Map()
      for (const event of Array.isArray(events) ? events : []) {
        const key = typeof event.turn === 'number' ? event.turn : null
        if (!index.has(key)) {
          const group = { turn: key, events: [] }
          index.set(key, group)
          groups.push(group)
        }
        index.get(key).events.push(event)
      }
      return groups
    }

    function useSessionList(sessions) {
      const [, force] = React.useReducer((value) => value + 1, 0)
      React.useEffect(() => {
        if (sessions?.list === undefined || typeof sessions.list.subscribe !== 'function') return undefined
        return sessions.list.subscribe(force)
      }, [sessions])
      return sessions?.list !== undefined && typeof sessions.list.getSnapshot === 'function'
        ? sessions.list.getSnapshot()
        : { byId: {} }
    }

    function useTree(sessionId) {
      const [state, setState] = React.useState({ loading: true, data: null, error: null })
      const [tick, setTick] = React.useState(0)
      const requestId = React.useRef(0)
      const load = React.useCallback(async () => {
        if (typeof sessionId !== 'string' || sessionId.length === 0) return
        const currentRequest = requestId.current + 1
        requestId.current = currentRequest
        setState((previous) => ({ loading: true, data: previous.data, error: null }))
        try {
          const response = await realGlobal().fetch(`${ROUTE}?sessionId=${encodeURIComponent(sessionId)}`, { cache: 'no-store' })
          const value = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(value.error ?? `HTTP ${response.status}`)
          if (requestId.current === currentRequest) setState({ loading: false, data: value, error: null })
        } catch (error) {
          if (requestId.current === currentRequest) {
            setState((previous) => ({ loading: false, data: previous.data, error: error instanceof Error ? error.message : String(error) }))
          }
        }
      }, [sessionId])
      React.useEffect(() => {
        load()
      }, [load, tick])
      return { ...state, reload: () => setTick((value) => value + 1) }
    }

    async function openWhenListed(sessions, uiWorkspace, sessionId) {
      try { await sessions.refresh() } catch {}
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const snapshot = sessions.list.getSnapshot()
        if (snapshot?.byId?.[sessionId] !== undefined) {
          uiWorkspace.openSession(sessionId)
          return
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      uiWorkspace.openSession(sessionId)
    }

    async function postJson(body) {
      const response = await realGlobal().fetch(ROUTE, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const value = await response.json().catch(() => ({}))
      if (!response.ok) {
        const error = new Error(value.error ?? `HTTP ${response.status}`)
        if (typeof value.childSessionId === 'string') error.childSessionId = value.childSessionId
        throw error
      }
      return value
    }

    function makeMutation(sessions, uiWorkspace) {
      return async (body) => {
        const result = await postJson(body)
        if (typeof result.sessionId === 'string') await openWhenListed(sessions, uiWorkspace, result.sessionId)
        return result
      }
    }

    function roleLabel(role, translate) {
      return translate(`role.${role}`)
    }

    function SessionCard({ session, currentId, selectedId, path, title, row, onSelect, onOpen, translate }) {
      const current = session.sessionId === currentId
      const onPath = path.has(session.sessionId)
      const selected = session.sessionId === selectedId
      const branchMeta = session.forkAtSeq === null || session.forkAtSeq === undefined
        ? `${translate('ownTurns', { count: session.ownTurns ?? 0 })} · ${translate('ownEvents', { count: session.events?.length ?? 0 })}`
        : `${translate('branchFrom', { seq: session.forkAtSeq })} · ${translate('ownTurns', { count: session.ownTurns ?? 0 })}`
      return React.createElement('div', {
        className: 'dst-session',
        role: 'button',
        tabIndex: 0,
        'data-current': current || undefined,
        'data-selected': selected || undefined,
        'data-on-path': onPath || undefined,
        onClick: () => onSelect(session.sessionId),
        onKeyDown: (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onSelect(session.sessionId)
          }
        },
        onDoubleClick: () => onOpen(session),
      },
        React.createElement('span', { className: 'dst-sessionGlyph', 'aria-hidden': true }, current ? '●' : session.parentSessionId === null ? '◆' : '↳'),
        React.createElement('span', { className: 'dst-sessionMain' },
          React.createElement('span', { className: 'dst-sessionTitle' }, title),
          React.createElement('span', { className: 'dst-sessionMeta' }, branchMeta),
          React.createElement('span', { className: 'dst-badges' },
            current ? React.createElement('span', { className: 'dst-badge', 'data-accent': true }, translate('current')) : null,
            row?.running ? React.createElement('span', { className: 'dst-badge' }, '● ' + translate('running')) : null,
            session.archived ? React.createElement('span', { className: 'dst-badge' }, translate('archived')) : null,
            session.origin === 'subagent' ? React.createElement('span', { className: 'dst-badge' }, translate('subagent')) : null,
            session.error ? React.createElement('span', { className: 'dst-badge' }, translate('error')) : null,
          ),
        ),
        React.createElement('button', {
          type: 'button',
          className: 'dst-button',
          onClick: (event) => {
            event.stopPropagation()
            onOpen(session)
          },
        }, translate('open')),
      )
    }

    function Branch({ id, byId, children, currentId, selectedId, path, list, onSelect, onOpen, translate, seen }) {
      const session = byId.get(id)
      if (session === undefined || seen.has(id)) return null
      const nextSeen = new Set(seen)
      nextSeen.add(id)
      const kids = children.get(id) ?? []
      return React.createElement('div', { className: 'dst-branch' },
        React.createElement(SessionCard, {
          session,
          currentId,
          selectedId,
          path,
          title: sessionTitle(list, id),
          row: list?.byId?.[id],
          onSelect,
          onOpen,
          translate,
        }),
        kids.length > 0
          ? React.createElement('div', { className: 'dst-children' },
              kids.map((child) => React.createElement(Branch, {
                key: child,
                id: child,
                byId,
                children,
                currentId,
                selectedId,
                path,
                list,
                onSelect,
                onOpen,
                translate,
                seen: nextSeen,
              })))
          : null,
      )
    }

    function EventRow({ event, selectedSessionId, busy, editingSeq, draft, error, translate, onEdit, onDraft, onCancelEdit, onSubmitEdit, onFork }) {
      const editing = editingSeq === event.seq
      return React.createElement('div', {
        className: 'dst-event',
        'data-editable': event.editable || undefined,
        'data-seq': event.seq,
      },
        React.createElement('div', { className: 'dst-eventHead' },
          React.createElement('span', { className: 'dst-role', 'data-role': event.role }, roleLabel(event.role, translate)),
          React.createElement('span', { className: 'dst-seq' }, translate('eventSeq', { seq: event.seq })),
          typeof event.turn === 'number' ? React.createElement('span', { className: 'dst-seq' }, translate('turn', { turn: event.turn })) : null,
        ),
        event.text !== '' ? React.createElement('div', { className: 'dst-eventText' }, event.text) : null,
        editing
          ? React.createElement('div', { className: 'dst-editor' },
              React.createElement('textarea', {
                className: 'dst-textarea',
                value: draft,
                autoFocus: true,
                onChange: (input) => onDraft(input.target.value),
                onKeyDown: (input) => {
                  if (input.key === 'Escape') onCancelEdit()
                  if (input.key === 'Enter' && (input.metaKey || input.ctrlKey)) onSubmitEdit(event)
                },
              }),
              error !== null ? React.createElement('div', { className: 'dst-error' }, error) : null,
              React.createElement('div', { className: 'dst-eventActions' },
                React.createElement('button', { type: 'button', className: 'dst-button', disabled: busy, onClick: onCancelEdit }, translate('cancel')),
                React.createElement('button', { type: 'button', className: 'dst-button', 'data-primary': true, disabled: busy || draft.trim() === '', onClick: () => onSubmitEdit(event) }, busy ? translate('saving') : translate('send')),
              ),
            )
          : React.createElement('div', { className: 'dst-eventActions' },
              event.editable
                ? React.createElement('button', {
                    type: 'button',
                    className: 'dst-button',
                    'data-primary': true,
                    disabled: busy,
                    onClick: () => onEdit(event),
                  }, translate('editAndFork'))
                : null,
              React.createElement('button', {
                type: 'button',
                className: 'dst-button',
                disabled: busy,
                onClick: () => onFork(selectedSessionId, event.seq),
              }, translate('forkAfter')),
            ),
      )
    }

    function TreeView(props) {
      const sessionId = props.sessionId
      const sessions = props.sessions
      const uiWorkspace = props.uiWorkspace
      const list = useSessionList(sessions)
      const tree = useTree(sessionId)
      const data = tree.data
      const [selectedId, setSelectedId] = React.useState(sessionId)
      const [editingSeq, setEditingSeq] = React.useState(null)
      const [draft, setDraft] = React.useState('')
      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState(null)
      const [exactSeq, setExactSeq] = React.useState('')
      const mutate = React.useMemo(() => makeMutation(sessions, uiWorkspace), [sessions, uiWorkspace])

      React.useEffect(() => {
        setSelectedId(sessionId)
        setEditingSeq(null)
        setError(null)
      }, [sessionId])

      const byId = data?.sessions !== undefined ? new Map(data.sessions.map((session) => [session.sessionId, session])) : new Map()
      const selected = byId.get(selectedId) ?? byId.get(sessionId) ?? null
      const treeShape = React.useMemo(() => buildChildren(data), [data])
      const path = React.useMemo(() => countPath(data, sessionId), [data, sessionId])
      const rootId = data?.rootId
      const totalSessions = data?.totalSessions ?? data?.sessions?.length ?? 0

      const onOpen = React.useCallback(async (session) => {
        setError(null)
        try {
          if (session.archived) await postJson({ action: 'activate', sessionId: session.sessionId })
          await openWhenListed(sessions, uiWorkspace, session.sessionId)
        } catch (openError) {
          setError(openError instanceof Error ? openError.message : String(openError))
        }
      }, [sessions, uiWorkspace])

      const startEdit = React.useCallback((event) => {
        setEditingSeq(event.seq)
        setDraft(event.text)
        setError(null)
      }, [])

      const submitEdit = React.useCallback(async (event) => {
        if (draft.trim() === '') {
          setError(t('emptyDraft'))
          return
        }
        setBusy(true)
        setError(null)
        try {
          await mutate({
            action: 'edit',
            sessionId: selectedId,
            eventSeq: event.seq,
            text: draft,
            stopPrevious: true,
            clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          })
          setEditingSeq(null)
        } catch (editError) {
          if (typeof editError.childSessionId === 'string') {
            try { await openWhenListed(sessions, uiWorkspace, editError.childSessionId) } catch {}
          }
          setError(editError instanceof Error ? editError.message : String(editError))
        } finally {
          setBusy(false)
        }
      }, [draft, mutate, selectedId, sessions, uiWorkspace])

      const forkAfter = React.useCallback(async (sourceId, atSeq) => {
        setBusy(true)
        setError(null)
        try {
          await mutate({ action: 'fork', sessionId: sourceId, atSeq })
        } catch (forkError) {
          setError(forkError instanceof Error ? forkError.message : String(forkError))
        } finally {
          setBusy(false)
        }
      }, [mutate])

      const forkLatest = React.useCallback(async () => {
        if (selected === null) return
        setBusy(true)
        setError(null)
        try {
          await mutate({ action: 'fork-last', sessionId: selected.sessionId })
        } catch (forkError) {
          setError(forkError instanceof Error ? forkError.message : String(forkError))
        } finally {
          setBusy(false)
        }
      }, [mutate, selected])

      const forkExact = React.useCallback(async () => {
        const value = Number(exactSeq)
        if (!Number.isSafeInteger(value) || value < 0) return
        await forkAfter(selectedId, value)
      }, [exactSeq, forkAfter, selectedId])

      if (tree.loading && data === null) {
        return React.createElement('div', { className: 'dst-root' }, React.createElement('div', { className: 'dst-loading' }, t('loading')))
      }

      const toolbar = React.createElement('div', { className: 'dst-toolbar' },
        React.createElement('div', { className: 'dst-toolbarMain' },
          React.createElement('div', { className: 'dst-title' }, t('title')),
          React.createElement('div', { className: 'dst-subtitle' }, t('subtitle', { count: totalSessions, current: sessionTitle(list, sessionId) })),
        ),
        React.createElement('div', { className: 'dst-toolbarActions' },
          React.createElement('button', { type: 'button', className: 'dst-button', disabled: tree.loading, onClick: tree.reload }, tree.loading ? t('saving') : t('refresh')),
        ),
      )

      if (data === null) {
        return React.createElement('div', { className: 'dst-root' }, toolbar,
          React.createElement('div', { className: 'dst-loading' },
            React.createElement('div', null,
              React.createElement('div', null, t('error')),
              tree.error !== null ? React.createElement('div', { className: 'dst-error' }, tree.error) : null,
              React.createElement('button', { type: 'button', className: 'dst-button', onClick: tree.reload }, t('retry')),
            ),
          ),
        )
      }

      const groups = groupByTurn(selected?.events ?? [])
      const inspector = selected === null
        ? React.createElement('div', { className: 'dst-empty' }, t('empty'))
        : React.createElement(React.Fragment, null,
            React.createElement('div', { className: 'dst-detailHead' },
              React.createElement('div', { style: { minWidth: 0 } },
                React.createElement('div', { className: 'dst-detailTitle' }, sessionTitle(list, selected.sessionId)),
                React.createElement('div', { className: 'dst-detailId' }, selected.sessionId),
              ),
              React.createElement('div', { className: 'dst-detailActions' },
                React.createElement('button', {
                  type: 'button',
                  className: 'dst-button',
                  disabled: busy || (selected.lastSeq ?? -1) < 0,
                  onClick: forkLatest,
                }, t('forkLatest')),
                React.createElement('button', {
                  type: 'button',
                  className: 'dst-button',
                  onClick: () => { void onOpen(selected) },
                }, t('open')),
              ),
            ),
            React.createElement('p', { className: 'dst-hint' }, t('forkHint')),
            selected.error ? React.createElement('div', { className: 'dst-error' }, selected.error) : null,
            selected.events.length === 0
              ? React.createElement('div', { className: 'dst-empty' }, t('noEvents'))
              : groups.map((group) => React.createElement('div', { key: group.turn === null ? 'none' : group.turn, className: 'dst-turnGroup' },
                  group.turn !== null ? React.createElement('div', { className: 'dst-turnLabel' }, t('turn', { turn: group.turn })) : null,
                  group.events.map((event) => React.createElement(EventRow, {
                    key: `${event.type}-${event.seq}`,
                    event,
                    selectedSessionId: selected.sessionId,
                    busy,
                    editingSeq,
                    draft,
                    error,
                    translate: t,
                    onEdit: startEdit,
                    onDraft: setDraft,
                    onCancelEdit: () => { setEditingSeq(null); setError(null) },
                    onSubmitEdit: submitEdit,
                    onFork: forkAfter,
                  })),
                )),
            React.createElement('div', { className: 'dst-exact' },
              React.createElement('span', { className: 'dst-exactLabel' }, t('exactSeq')),
              React.createElement('input', {
                className: 'dst-input',
                type: 'number',
                min: 0,
                max: Math.max(0, selected.lastSeq ?? 0),
                placeholder: t('exactPlaceholder'),
                value: exactSeq,
                onChange: (event) => setExactSeq(event.target.value),
              }),
              React.createElement('button', {
                type: 'button',
                className: 'dst-button',
                disabled: busy || exactSeq === '',
                onClick: forkExact,
              }, t('forkExact')),
            ),
          )

      return React.createElement('div', { className: 'dst-root' },
        toolbar,
        data.truncated ? React.createElement('div', { className: 'dst-error', style: { margin: '8px 16px 0' } }, t('truncated', { count: data.sessions.length })) : null,
        React.createElement('div', { className: 'dst-body' },
          React.createElement('div', { className: 'dst-pane' },
            React.createElement('div', { className: 'dst-sectionLabel' }, t('branches')),
            React.createElement('div', { className: 'dst-tree' },
              rootId !== undefined
                ? React.createElement(Branch, {
                    id: rootId,
                    byId: treeShape.byId,
                    children: treeShape.children,
                    currentId: sessionId,
                    selectedId: selected?.sessionId ?? selectedId,
                    path,
                    list,
                    onSelect: setSelectedId,
                    onOpen,
                    translate: t,
                    seen: new Set(),
                  })
                : React.createElement('div', { className: 'dst-empty' }, t('empty')),
            ),
            error !== null ? React.createElement('div', { className: 'dst-error' }, error) : null,
          ),
          React.createElement('div', { className: 'dst-pane' },
            React.createElement('div', { className: 'dst-sectionLabel' }, t('timeline')),
            inspector,
          ),
        ),
      )
    }

    /** Parse the durable seq prefix the Chat seat puts on every flow row. */
    function seqFromNodeKey(key) {
      if (typeof key !== 'string') return null
      const head = key.split(':', 1)[0]
      const value = Number(head)
      return Number.isSafeInteger(value) && value >= 0 ? value : null
    }

    /** Read the exact user text the host rendered, excluding chrome and attachments. */
    function messageTextFromRow(row) {
      const textSlot = row.querySelector('[data-slot="conversation.user.text"]')
      if (textSlot !== null) return textSlot.textContent ?? ''
      const clone = row.cloneNode(true)
      clone.querySelectorAll('[data-clock="start"],[data-dst-action]').forEach((element) => element.remove())
      return clone.textContent ?? ''
    }

    const EDIT_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" stroke-width="1"><path d="M8.85596 2.69971H4.19971C3.37141 2.69971 2.69992 3.37146 2.69971 4.19971V11.8003C2.69992 12.6285 3.37141 13.3003 4.19971 13.3003H11.8003C12.6283 13.2999 13.3001 12.6283 13.3003 11.8003V7.89893H14.3003V11.8003C14.3001 13.1806 13.1806 14.2999 11.8003 14.3003H4.19971C2.81913 14.3003 1.69992 13.1808 1.69971 11.8003V4.19971C1.69992 2.81918 2.81913 1.69971 4.19971 1.69971H8.85596V2.69971Z" fill="currentColor"/><path d="M7.7849 8.23878L13.888 2.13574" stroke="currentColor"/></svg>'
    const BRANCH_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" stroke-width="1"><path d="M1.01503 8.0001L5.6964 8.0001C6.41913 8.0001 6.78049 8.0001 7.12115 7.91951C7.4232 7.84804 7.71233 7.73014 7.97821 7.57C8.27809 7.38939 8.5364 7.13669 9.05303 6.63129L11.3281 4.40564" stroke="currentColor"/><path d="M1.01221 7.9999L5.6964 7.9999C6.41913 7.9999 6.78049 7.9999 7.12115 8.08049C7.4232 8.15196 7.71233 8.26986 7.97821 8.43C8.27809 8.61061 8.5364 8.86331 9.05303 9.36871L11.3281 11.5944" stroke="currentColor"/><circle cx="12.4502" cy="3.3079" r="1.56962" stroke="currentColor"/><circle cx="12.4502" cy="12.6921" r="1.56962" stroke="currentColor"/></svg>'

    /**
     * Add edit / branch controls beside the Host's own Copy button.
     *
     * The Chat package exposes no extension slot inside the user action row, so
     * this component never replaces the host renderer. It observes the rendered
     * rows and inserts two sibling buttons into the native `[data-clock=start]`
     * action strip, leaving Copy and every host behavior untouched.
     */
    function UserActionInjector(props) {
      const sessionId = props.sessionId
      const sessions = props.sessions
      const uiWorkspace = props.uiWorkspace
      const mutate = React.useMemo(() => makeMutation(sessions, uiWorkspace), [sessions, uiWorkspace])
      const [editor, setEditor] = React.useState(null)
      const [draft, setDraft] = React.useState('')
      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState(null)
      const [toast, setToast] = React.useState(null)
      const busyRef = React.useRef(false)

      React.useEffect(() => {
        if (toast === null) return undefined
        const timer = setTimeout(() => setToast(null), 5000)
        return () => clearTimeout(timer)
      }, [toast])

      React.useEffect(() => {
        if (typeof sessionId !== 'string' || sessionId.length === 0) return undefined
        const g = realGlobal()
        if (g === null || g.document === undefined) return undefined
        const doc = g.document
        let frame = 0
        let disposed = false

        const removeInjected = () => {
          doc.querySelectorAll('[data-dst-action]').forEach((element) => element.remove())
        }

        const forkAt = async (seq, button) => {
          if (busyRef.current) return
          busyRef.current = true
          if (button !== undefined) button.disabled = true
          setError(null)
          try {
            await mutate({ action: 'fork', sessionId, atSeq: seq })
            setToast({ text: t('childCreated'), error: false })
          } catch (forkError) {
            setToast({ text: `${t('requestFailed')}: ${forkError instanceof Error ? forkError.message : String(forkError)}`, error: true })
          } finally {
            busyRef.current = false
            if (button !== undefined) button.disabled = false
          }
        }

        const openEditor = (seq, text) => {
          setEditor({ seq })
          setDraft(text)
          setError(null)
        }

        const inject = () => {
          frame = 0
          if (disposed) return
          const rows = doc.querySelectorAll('[data-chat-flow-kind="user"], [data-chat-flow-kind="steering"]')
          rows.forEach((row) => {
            const actions = row.querySelector('[data-clock="start"]')
            if (actions === null) return
            const seq = seqFromNodeKey(row.getAttribute('data-chat-node-key'))
            if (seq === null) return
            let edit = actions.querySelector('[data-dst-action="edit"]')
            let branch = actions.querySelector('[data-dst-action="branch"]')
            if (edit !== null && branch !== null) return

            const text = messageTextFromRow(row)
            if (edit === null) {
              edit = doc.createElement('button')
              edit.type = 'button'
              edit.className = 'dst-hostAction'
              edit.dataset.dstAction = 'edit'
              edit.innerHTML = EDIT_ICON
              edit.setAttribute('aria-label', t('userEdit'))
              edit.title = t('userEdit')
              edit.disabled = text.trim() === ''
              edit.addEventListener('click', () => openEditor(seq, messageTextFromRow(row)))
            }
            if (branch === null) {
              branch = doc.createElement('button')
              branch.type = 'button'
              branch.className = 'dst-hostAction'
              branch.dataset.dstAction = 'branch'
              branch.innerHTML = BRANCH_ICON
              branch.setAttribute('aria-label', t('userFork'))
              branch.title = t('userFork')
              branch.addEventListener('click', () => { void forkAt(seq, branch) })
            }

            const copy = actions.querySelector(':scope > button')
            if (copy !== null) {
              copy.insertAdjacentElement('afterend', branch)
              copy.insertAdjacentElement('afterend', edit)
            } else {
              actions.append(edit, branch)
            }
          })
        }

        const isUserRow = (node) => node !== null
          && node.nodeType === 1
          && (node.matches('[data-chat-flow-kind="user"], [data-chat-flow-kind="steering"]')
            || node.querySelector('[data-chat-flow-kind="user"], [data-chat-flow-kind="steering"]') !== null)

        const schedule = (records) => {
          if (frame !== 0 || disposed) return
          const relevant = records.some((record) => {
            if (record.type !== 'childList') return false
            for (const node of record.addedNodes) {
              if (isUserRow(node)) return true
            }
            for (const node of record.removedNodes) {
              if (node.nodeType === 1 && (node.matches('[data-dst-action]') || node.querySelector?.('[data-dst-action]') !== null)) return true
              if (isUserRow(node)) return true
            }
            return false
          })
          if (!relevant) return
          frame = g.requestAnimationFrame(inject)
        }

        const observer = new g.MutationObserver(schedule)
        observer.observe(doc.body, { childList: true, subtree: true })
        inject()

        return () => {
          disposed = true
          observer.disconnect()
          if (frame !== 0) g.cancelAnimationFrame(frame)
          removeInjected()
        }
      }, [mutate, sessionId])

      const submit = async () => {
        if (editor === null || draft.trim() === '') {
          setError(t('emptyDraft'))
          return
        }
        setBusy(true)
        busyRef.current = true
        setError(null)
        try {
          await mutate({
            action: 'edit',
            sessionId,
            eventSeq: editor.seq,
            text: draft,
            stopPrevious: true,
            clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          })
          setEditor(null)
          setToast({ text: t('childCreated'), error: false })
        } catch (editError) {
          if (typeof editError.childSessionId === 'string') {
            try { await openWhenListed(sessions, uiWorkspace, editError.childSessionId) } catch {}
          }
          setError(editError instanceof Error ? editError.message : String(editError))
        } finally {
          setBusy(false)
          busyRef.current = false
        }
      }

      const portalRoot = realGlobal()?.document?.body ?? null
      const dialog = editor === null || portalRoot === null ? null : ReactDOM.createPortal(
        React.createElement('div', {
          className: 'dst-modalBackdrop',
          role: 'presentation',
          onMouseDown: (event) => {
            if (event.target === event.currentTarget && !busy) setEditor(null)
          },
        },
          React.createElement('div', {
            className: 'dst-modal',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': t('editTitle'),
            onMouseDown: (event) => event.stopPropagation(),
          },
            React.createElement('div', { className: 'dst-modalHead' },
              React.createElement('div', { className: 'dst-modalTitle' }, t('editTitle')),
            ),
            React.createElement('p', { className: 'dst-modalHint' }, t('editHint')),
            React.createElement('textarea', {
              className: 'dst-modalTextarea',
              value: draft,
              autoFocus: true,
              disabled: busy,
              onChange: (event) => setDraft(event.target.value),
              onKeyDown: (event) => {
                if (event.key === 'Escape' && !busy) setEditor(null)
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void submit()
              },
            }),
            error !== null ? React.createElement('div', { className: 'dst-error' }, error) : null,
            React.createElement('div', { className: 'dst-modalActions' },
              React.createElement('button', { type: 'button', className: 'dst-button', disabled: busy, onClick: () => setEditor(null) }, t('cancel')),
              React.createElement('button', { type: 'button', className: 'dst-button', 'data-primary': true, disabled: busy || draft.trim() === '', onClick: submit }, busy ? t('saving') : t('send')),
            ),
          ),
        ),
        portalRoot,
      )

      const notice = toast === null || portalRoot === null ? null : ReactDOM.createPortal(
        React.createElement('div', { className: 'dst-toast', 'data-error': toast.error || undefined, role: 'status' }, toast.text),
        portalRoot,
      )

      return React.createElement(React.Fragment, null, dialog, notice)
    }

    exports.inject = ['slots', 'sessions', 'locale', 'uiWorkspace']

    exports.apply = (ctx) => {
      const slots = ctx.get('slots')
      const sessions = ctx.get('sessions')
      const uiWorkspace = ctx.get('uiWorkspace')
      if (slots === undefined || sessions === undefined || uiWorkspace === undefined) {
        throw new Error('[dsh-session-tree] missing slots, sessions, or uiWorkspace')
      }

      ctx.effect(installStyles, 'session-tree: styles')
      try {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'session-tree: dictionaries')
        t = ctx.locale.bind(NS)
      } catch (error) {
        console.warn('[dsh-session-tree] locale registration failed; using English', error)
      }

      const injectTreeProps = () => ({ sessions, uiWorkspace })

      slots.inject('conversation.view', () => slots.register(
        { name: 'conversation.view', id: 'session-tree', order: 30, label: () => t('tab'), inject: injectTreeProps },
        TreeView,
      ))

      // Null-rendering observer mounted in the session header: it only augments
      // the Host's own user action row and never replaces a Chat renderer.
      try {
        slots.inject('conversation.session.header.actions', () => slots.register(
          { name: 'conversation.session.header.actions', id: 'session-tree-user-actions', order: 900, inject: injectTreeProps },
          UserActionInjector,
        ))
      } catch (error) {
        console.warn('[dsh-session-tree] could not mount the user action injector; tree view is still available', error)
      }
    }

    exports.__test = {
      textFromContent,
      imageParts,
      groupByTurn,
      buildChildren,
      countPath,
      TreeView,
      UserActionInjector,
      seqFromNodeKey,
      messageTextFromRow,
    }
    return module.exports
  },
})

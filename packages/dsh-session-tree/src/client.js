/**
 * Browser half of @gitsang/dsh-session-tree.
 *
 * Draws Session branch lineage inline in the native Trajectory ledger and adds
 * a compact edit affordance on user messages. Tree data and branch mutations
 * travel through the package's same-origin Host route; navigation uses the
 * public Workspace UI service.
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
      cancel: '取消',
      send: '发送',
      saving: '处理中…',
      editHint: '编辑后会从这条用户消息所在轮次之前分叉，并发送修改后的内容。',
      noEvents: '没有可显示的事件（只有继承前缀或非展示事件）。',
      noText: '（无文本）',
      emptyDraft: '消息不能为空。',
      userEdit: '编辑消息',
      userFork: '分叉',
      rowFork: '从此后分叉',
      rowForkUnavailable: '这一行没有可用来分叉的持久事件',
      editTitle: '编辑这条消息',
      childCreated: '已创建新分支',
      requestFailed: '请求失败',
      branchCollapse: '收起分支',
      branchExpand: '展开分支',
      branchMore: '还有 {count} 条',
      tab: '轨迹树',
      treeTitle: '轨迹树',
      treeSubtitle: '{count} 个分支 · 当前 {current}',
      refresh: '刷新',
      loading: '正在读取分支树…',
      empty: '这个会话还没有可展示的事件。',
      retry: '重试',
      readFailed: '读取分支树失败',
      turn: '第 {turn} 轮',
      branchLabel: '{title}',
      forkAt: '分叉自 #{seq}',
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
      cancel: 'Cancel',
      send: 'Send',
      saving: 'Working…',
      editHint: 'Editing forks before the Turn containing this user message, then sends the edited prompt.',
      noEvents: 'No displayable events (inherited prefix or non-presentation events only).',
      noText: '(no text)',
      emptyDraft: 'The message cannot be empty.',
      userEdit: 'Edit message',
      userFork: 'Branch',
      rowFork: 'Fork after this event',
      rowForkUnavailable: 'This row has no durable event to fork from',
      editTitle: 'Edit this message',
      childCreated: 'New branch created',
      requestFailed: 'Request failed',
      branchCollapse: 'Collapse branch',
      branchExpand: 'Expand branch',
      branchMore: '{count} more',
      tab: 'Trajectory Tree',
      treeTitle: 'Trajectory tree',
      treeSubtitle: '{count} branches · current {current}',
      refresh: 'Refresh',
      loading: 'Reading the branch tree…',
      empty: 'This Session has no displayable events yet.',
      retry: 'Retry',
      readFailed: 'Could not read the branch tree',
      turn: 'Turn {turn}',
      branchLabel: '{title}',
      forkAt: 'forked at #{seq}',
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
      '.dst-button{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:4px;flex:none;border:.5px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);border-radius:8px;padding:4px 9px;font:inherit;font-size:12px;line-height:18px;cursor:pointer;white-space:nowrap}',
      '.dst-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.dst-button:disabled{opacity:.45;cursor:default}',
      '.dst-button[data-primary]{background:var(--dsw-alias-state-business-primary,#4b8dff);border-color:transparent;color:#fff}',
      '.dst-button[data-primary]:hover:not(:disabled){background:var(--dsw-alias-state-business-primary,#4b8dff);filter:brightness(1.06);color:#fff}',
      '.dst-error{font-size:11.5px;line-height:17px;color:var(--dsw-alias-state-error-primary,#e5484d);padding:7px 9px;border-radius:7px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5484d) 9%,transparent);margin:8px 0}',
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
      /* Dedicated branch-tree View, styled like the native Trajectory ledger. */
      '.dstt-root{--dstt-turn-col:56px;box-sizing:border-box;height:100%;min-height:0;width:100%;display:flex;flex-direction:column;overflow:hidden;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}',
      '.dstt-toolbar{flex:none;height:38px;display:flex;align-items:center;gap:10px;padding:0 14px;border-bottom:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);min-width:0}',
      '.dstt-toolbarMain{min-width:0;display:flex;align-items:baseline;gap:8px;flex:1}',
      '.dstt-title{font-size:12px;font-weight:600;white-space:nowrap}',
      '.dstt-subtitle{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-size:10.5px}',
      '.dstt-head{flex:none;height:30px;display:grid;grid-template-columns:var(--dstt-turn-col,56px) var(--dstt-event-col,236px) minmax(0,1fr);align-items:center;border-bottom:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-specific-sidebar-fill,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-tertiary);font-size:10px;font-weight:500}',
      '.dstt-head > span{padding:0 8px}',
      '.dstt-head > span:nth-child(2){text-align:left;padding-left:8px}',
      '.dstt-scroll{flex:1;min-height:0;overflow:auto;padding-bottom:calc(var(--dsh-composer-height,152px) + 16px);scrollbar-width:thin;scrollbar-color:var(--dsw-alias-scrollbar-bg-l2) transparent}',
      '.dstt-row{position:relative;display:grid;grid-template-columns:var(--dstt-turn-col,56px) var(--dstt-event-col,236px) minmax(0,1fr);height:30px;border-bottom:.5px solid var(--dsw-alias-border-l1);transition:background-color 120ms var(--ds-ease-in-out)}',
      '.dstt-row:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.dstt-eventCell{position:relative;display:flex;align-items:center;justify-content:flex-start;gap:6px;min-width:0;padding:0 8px 0 8px;overflow:hidden}',
      '.dstt-graph{position:relative;flex:none;height:30px}',
      '.dstt-graph svg{position:absolute;inset:0;overflow:visible;pointer-events:none}',
      '.dstt-lane{fill:none;stroke-width:1.4;stroke-linecap:round;opacity:.55}',
      '.dstt-node{position:absolute;z-index:2;box-sizing:border-box;width:11px;height:11px;margin:-5.5px 0 0 -5.5px;padding:0;border:2px solid var(--dstt-lane-color,var(--dsw-alias-state-business-primary));border-radius:50%;background:var(--dsw-alias-bg-layer-1);cursor:default}',
      '.dstt-node[data-toggle]{width:14px;height:14px;margin:-7px 0 0 -7px;display:grid;place-items:center;border-width:1px;border-radius:4px;color:var(--dsw-alias-label-secondary);font:10px/1 var(--ds-font-family-code);cursor:pointer}',
      '.dstt-node[data-toggle]:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.dstt-node:focus-visible{outline:1px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}',
      '.dstt-kindTag{display:inline-flex;flex:none;align-items:center;justify-content:center;box-sizing:border-box;height:19px;padding:0 5px;border:1px solid transparent;border-radius:var(--dsw-radius-xs);font-size:10px;line-height:16px;font-weight:650;letter-spacing:.035em;white-space:nowrap;user-select:none}',
      '.dstt-kindTag[data-kind=user]{color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-state-business-tertiary)}',
      '.dstt-kindTag[data-kind=assistant]{color:color-mix(in srgb,var(--dsw-alias-brand-primary-new-colorprimary-new-color) 60%,var(--dsw-alias-state-error-secondary));background:color-mix(in srgb,color-mix(in srgb,var(--dsw-alias-brand-primary-new-colorprimary-new-color) 55%,var(--dsw-alias-state-error-secondary)) 15%,var(--dsw-alias-bg-layer-1))}',
      '.dstt-kindTag[data-kind=tool]{color:var(--dsw-alias-state-warn-label);background:var(--dsw-alias-state-warn-tertiary)}',
      '.dstt-kindTag[data-kind=context]{color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 68%,var(--dsw-alias-label-secondary));background:var(--dsw-alias-state-success-tertiary)}',
      '.dstt-kindTag[data-kind=compacted]{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-module-platform)}',
      '.dstt-content{display:flex;align-items:center;gap:6px;min-width:0;padding:0 8px;overflow:hidden;font-size:12px;line-height:18px}',
      '.dstt-text{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary)}',
      '.dstt-branchChip{display:inline-flex;flex:none;align-items:center;gap:4px;height:17px;padding:0 6px;border:1px solid color-mix(in srgb,var(--dstt-lane-color,var(--dsw-alias-state-business-primary)) 32%,transparent);border-radius:999px;background:color-mix(in srgb,var(--dstt-lane-color,var(--dsw-alias-state-business-primary)) 9%,transparent);color:color-mix(in srgb,var(--dstt-lane-color,var(--dsw-alias-state-business-primary)) 80%,var(--dsw-alias-label-primary));font-size:9.5px;line-height:1;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dstt-branchChip::before{content:"";width:4px;height:4px;border-radius:50%;background:var(--dstt-lane-color,var(--dsw-alias-state-business-primary));flex:none}',
      '.dstt-forkNote{flex:none;color:var(--dsw-alias-label-tertiary);font-size:9px;font-variant-numeric:tabular-nums}',
      '.dstt-hiddenNote{flex:none;margin-left:auto;color:var(--dsw-alias-label-tertiary);font-size:9.5px}',
      '.dstt-rowAction{flex:none;display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;padding:2px;border:0;border-radius:4px;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;opacity:.42;transition:opacity 120ms var(--ds-ease-in-out),background-color 120ms var(--ds-ease-in-out)}',
      '.dstt-row:hover .dstt-rowAction,.dstt-row:focus-within .dstt-rowAction,.dstt-rowAction:focus-visible{opacity:1}',
      '.dstt-rowAction:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.dstt-rowAction:disabled{cursor:default;opacity:.14}',
      '.dstt-row:hover .dstt-rowAction:disabled{opacity:.24}',
      '.dstt-rowAction[data-busy]{opacity:.55;cursor:progress}',
      '.dstt-rowAction svg{display:block;width:13px;height:13px}',
      '.dstt-turnCell{display:flex;align-items:flex-start;justify-content:flex-end;min-width:0;padding:2px 6px 0 0;overflow:hidden}',
      '.dstt-turnLabel{display:block;max-width:100%;padding:1px 4px;border-radius:2px;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-tertiary);font:8px/10px var(--ds-font-family-code);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;user-select:none}',
      '.dstt-empty{display:flex;align-items:center;justify-content:center;height:100%;padding:24px;color:var(--dsw-alias-label-tertiary);font-size:12px;text-align:center}',
      '.dstt-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:1300;max-width:min(620px,calc(100vw - 32px));box-sizing:border-box;border-radius:10px;padding:9px 13px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-primary));box-shadow:var(--dsw-elevation-prominent,0 10px 30px rgba(0,0,0,.24));color:var(--dsw-alias-label-primary);font-size:12px;line-height:18px}',
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

    function sessionTitle(list, sessionId) {
      const row = list?.byId?.[sessionId]
      return typeof row?.displayTitle === 'string' && row.displayTitle.length > 0 ? row.displayTitle : sessionId
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

    /** Last known family projection per Session. Re-opening a Session paints immediately. */
    const TREE_CACHE = new Map()
    const TREE_CACHE_LIMIT = 12

    function cacheTree(sessionId, data) {
      TREE_CACHE.delete(sessionId)
      TREE_CACHE.set(sessionId, { data, time: Date.now() })
      while (TREE_CACHE.size > TREE_CACHE_LIMIT) {
        const oldest = TREE_CACHE.keys().next().value
        if (typeof oldest !== 'string') break
        TREE_CACHE.delete(oldest)
      }
    }

    function useTree(sessionId, enabled = true) {
      const cached = typeof sessionId === 'string' ? TREE_CACHE.get(sessionId) : undefined
      const [state, setState] = React.useState(() => cached === undefined
        ? { loading: true, data: null, error: null }
        : { loading: false, data: cached.data, error: null })
      const [tick, setTick] = React.useState(0)
      const requestId = React.useRef(0)

      React.useEffect(() => {
        const entry = typeof sessionId === 'string' ? TREE_CACHE.get(sessionId) : undefined
        setState(entry === undefined
          ? { loading: true, data: null, error: null }
          : { loading: false, data: entry.data, error: null })
      }, [sessionId])

      const load = React.useCallback(async () => {
        if (!enabled || typeof sessionId !== 'string' || sessionId.length === 0) return
        const currentRequest = requestId.current + 1
        requestId.current = currentRequest
        setState((previous) => ({ loading: true, data: previous.data, error: null }))
        try {
          const response = await realGlobal().fetch(`${ROUTE}?sessionId=${encodeURIComponent(sessionId)}&subtree=1`, { cache: 'no-store' })
          const value = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(value.error ?? `HTTP ${response.status}`)
          cacheTree(sessionId, value)
          if (requestId.current === currentRequest) setState({ loading: false, data: value, error: null })
        } catch (error) {
          if (requestId.current === currentRequest) {
            setState((previous) => ({ loading: false, data: previous.data, error: error instanceof Error ? error.message : String(error) }))
          }
        }
      }, [enabled, sessionId])
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

    function familyChildren(data) {
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

    function chainTo(data, sessionId) {
      const { byId } = familyChildren(data)
      const chain = []
      const seen = new Set()
      let cursor = sessionId
      while (typeof cursor === 'string' && byId.has(cursor) && !seen.has(cursor)) {
        seen.add(cursor)
        chain.unshift(byId.get(cursor))
        const parent = byId.get(cursor)?.parentSessionId
        cursor = typeof parent === 'string' ? parent : null
      }
      return chain
    }

    const TREE_LANE_COLORS = ['#4b8dff', '#8f6bff', '#e35d83', '#20a464', '#c98a00', '#2aa8b8', '#d1663a']
    const TREE_ROLE_KIND = {
      user: 'user',
      context: 'context',
      assistant: 'assistant',
      tool: 'tool',
      compaction: 'compacted',
    }

    function treeLaneColor(lane) {
      return TREE_LANE_COLORS[Math.max(0, lane) % TREE_LANE_COLORS.length]
    }

    function treeVisibleEvents(session) {
      return (Array.isArray(session?.events) ? session.events : []).filter((event) =>
        event !== null && typeof event === 'object' && TREE_ROLE_KIND[event.role] !== undefined)
    }

    function treeKindForRole(role) {
      return TREE_ROLE_KIND[role] ?? 'context'
    }

    /**
     * Build the Host fork request for one tree row.
     *
     * The row's own Session is authoritative: ancestor Sessions are interleaved
     * into the trunk and side lanes, so forking the open Session would cut the
     * wrong log. The boundary is that row's durable seq, taken inclusively, so
     * the new branch starts right after the event the user pointed at.
     *
     * @param {object} row - projected tree row.
     * @returns {{action: 'fork', sessionId: string, atSeq: number}|null} null when the row owns no durable event.
     */
    function rowForkRequest(row) {
      const seq = row?.event?.seq
      const sessionId = row?.sessionId
      if (row?.event?.synthetic === true) return null
      if (typeof sessionId !== 'string' || sessionId.length === 0) return null
      if (!Number.isSafeInteger(seq) || seq < 0) return null
      return { action: 'fork', sessionId, atSeq: seq }
    }

    /**
     * Project the current Session and every descendant fork into one ordered
     * ledger. The current Session is lane 0; every descendant gets its own lane
     * (pre-order), so no two branches ever share a column.
     */
    function projectTree(data, currentId, collapsed, list) {
      const { byId, children } = familyChildren(data)
      if (!byId.has(currentId)) {
        return { rows: [], branchCount: 0, maxLane: 0, firstByLane: new Map(), lastByLane: new Map() }
      }

      const path = chainTo(data, currentId)
      const rootId = path[0]?.sessionId ?? currentId
      const pathSet = new Set(path.map((session) => session.sessionId))
      const pathNext = new Map()
      for (let index = 0; index < path.length - 1; index += 1) {
        pathNext.set(path[index].sessionId, path[index + 1].sessionId)
      }

      const eventCache = new Map()
      const eventsFor = (sessionId) => {
        if (!eventCache.has(sessionId)) eventCache.set(sessionId, treeVisibleEvents(byId.get(sessionId)))
        return eventCache.get(sessionId)
      }
      const childrenOf = (sessionId) => children.get(sessionId) ?? []
      const findAnchorIndex = (sessionId, forkAtSeq) => {
        if (!Number.isSafeInteger(forkAtSeq)) return -1
        const events = eventsFor(sessionId)
        for (let index = events.length - 1; index >= 0; index -= 1) {
          if (events[index].seq <= forkAtSeq) return index
        }
        return -1
      }
      const countHiddenFrom = (sessionId, startIndex = 0) => {
        const events = eventsFor(sessionId)
        let total = Math.max(0, events.length - startIndex - 1)
        for (const childId of childrenOf(sessionId)) {
          total += eventsFor(childId).length + countHiddenFrom(childId, 0)
        }
        return total
      }

      let nextLane = 1
      const allocateLane = () => nextLane++

      const makeRow = (sessionId, lane, event, options = {}) => ({
        kind: 'event',
        sessionId,
        lane,
        event,
        branchStart: options.branchStart === true,
        parentLane: Number.isSafeInteger(options.parentLane) ? options.parentLane : null,
        branchId: options.branchId ?? sessionId,
        branchTitle: options.branchTitle ?? sessionTitle(list, sessionId),
        branchForkAt: Number.isSafeInteger(options.branchForkAt) ? options.branchForkAt : null,
        collapsible: options.collapsible === true,
        collapsed: options.collapsed === true,
        hiddenCount: options.hiddenCount ?? 0,
        isMainline: options.isMainline === true,
        isContinuation: options.isContinuation === true,
        ...(options.forkAnchorRow === undefined ? {} : { forkAnchorRow: options.forkAnchorRow }),
      })

      /**
       * Render one side branch, its own events and every descendant fork.
       * `startIndex` is used by the lane that continues an ancestor Session
       * after the fork point, which starts there instead of replaying the
       * whole Session.
       */
      const buildSide = (sessionId, lane, options = {}) => {
        const startIndex = options.startIndex ?? 0
        const events = eventsFor(sessionId)
        const branchId = options.branchId ?? sessionId
        const excluded = options.excludeChildren ?? new Set()
        const shown = events.length === 0
          ? [{ seq: Number.isSafeInteger(byId.get(sessionId)?.forkAtSeq) ? byId.get(sessionId).forkAtSeq : 0, role: 'context', text: '', turn: null, synthetic: true }]
          : events.slice(startIndex)
        if (shown.length === 0) return []
        const childIds = childrenOf(sessionId).filter((childId) => !excluded.has(childId))
        const isCollapsed = options.isMainline !== true && collapsed.has(branchId)
        const collapsible = options.isMainline !== true && (shown.length > 1 || childIds.length > 0)
        const hiddenCount = isCollapsed ? countHiddenFrom(sessionId, startIndex) : 0
        const rows = shown.map((event, index) => makeRow(sessionId, lane, event, {
          branchStart: options.branchStart === true && index === 0,
          parentLane: options.parentLane,
          branchId,
          branchTitle: options.branchTitle,
          branchForkAt: options.branchForkAt,
          collapsible: index === 0 && collapsible,
          collapsed: index === 0 && isCollapsed,
          hiddenCount,
          isMainline: options.isMainline === true,
          isContinuation: options.isContinuation === true,
          forkAnchorRow: index === 0 ? options.forkAnchorRow : undefined,
        }))
        if (isCollapsed) return rows

        const anchors = new Map()
        for (const childId of childIds) {
          const child = byId.get(childId)
          const anchorFull = findAnchorIndex(sessionId, child?.forkAtSeq)
          let localIndex = anchorFull < 0 ? 0 : anchorFull - startIndex
          if (localIndex < 0) continue
          if (localIndex >= rows.length) localIndex = rows.length - 1
          const bucket = anchors.get(localIndex)
          if (bucket === undefined) anchors.set(localIndex, [childId])
          else bucket.push(childId)
        }

        const output = []
        for (let index = 0; index < rows.length; index += 1) {
          const row = rows[index]
          output.push(row)
          for (const childId of anchors.get(index) ?? []) {
            const child = byId.get(childId)
            const childLane = allocateLane()
            const childRows = buildSide(childId, childLane, {
              branchStart: true,
              parentLane: lane,
              forkAnchorRow: row,
              branchForkAt: child?.forkAtSeq,
              branchTitle: sessionTitle(list, childId),
            })
            output.push(...childRows)
          }
        }
        return output
      }

      /**
       * Render the selected Session path as lane 0. When the path leaves a
       * Session at a fork, that Session's later events become the
       * "original mainline" side branch, even though it remains the parent in
       * DSH's persistent Session graph.
       */
      const buildMainline = (sessionId, inheritedAnchorRow = null) => {
        const events = eventsFor(sessionId)
        const pathChildId = pathNext.get(sessionId)
        if (pathChildId === undefined) {
          return buildSide(sessionId, 0, {
            startIndex: 0,
            branchStart: false,
            isMainline: true,
            branchId: sessionId,
            branchTitle: sessionTitle(list, sessionId),
          })
        }

        const pathChild = byId.get(pathChildId)
        const anchorFull = findAnchorIndex(sessionId, pathChild?.forkAtSeq)
        const mainlineEnd = anchorFull
        const mainlineEvents = mainlineEnd >= 0 ? events.slice(0, mainlineEnd + 1) : []
        const mainlineRows = mainlineEvents.map((event, index) => makeRow(sessionId, 0, event, {
          isMainline: true,
          branchId: sessionId,
          branchTitle: sessionTitle(list, sessionId),
          forkAnchorRow: index === 0 ? undefined : undefined,
        }))
        // The fork boundary can sit in an inherited prefix that this Session
        // does not display (a nested fork); then its first visible row is a
        // continuation and the edge must start from the ancestor row already
        // rendered on the trunk.
        const anchorRow = mainlineRows.at(-1) ?? inheritedAnchorRow
        const childrenList = childrenOf(sessionId)
        const sideChildren = childrenList.filter((childId) => childId !== pathChildId)

        const output = []
        const handled = new Set()
        for (let index = 0; index < mainlineRows.length; index += 1) {
          const row = mainlineRows[index]
          output.push(row)
          for (const childId of sideChildren) {
            const child = byId.get(childId)
            const childAnchor = findAnchorIndex(sessionId, child?.forkAtSeq)
            const effectiveAnchor = childAnchor < 0 ? 0 : childAnchor
            if (effectiveAnchor !== index || effectiveAnchor === mainlineEnd) continue
            handled.add(childId)
            const childLane = allocateLane()
            output.push(...buildSide(childId, childLane, {
              branchStart: true,
              parentLane: 0,
              forkAnchorRow: row,
              branchForkAt: child?.forkAtSeq,
              branchTitle: sessionTitle(list, childId),
            }))
          }
        }

        // The selected path continues in lane 0 without a branch edge.
        output.push(...buildMainline(pathChildId, anchorRow))

        // Siblings that fork at the same event as the selected path share the
        // same parent node; they are rendered after the path so the trunk wins.
        for (const childId of sideChildren) {
          if (handled.has(childId)) continue
          const child = byId.get(childId)
          const childAnchor = findAnchorIndex(sessionId, child?.forkAtSeq)
          const effectiveAnchor = childAnchor < 0 ? 0 : childAnchor
          if (effectiveAnchor !== mainlineEnd && childAnchor >= 0) continue
          handled.add(childId)
          const childLane = allocateLane()
          const childRows = buildSide(childId, childLane, {
            branchStart: true,
            parentLane: 0,
            forkAnchorRow: anchorRow,
            branchForkAt: child?.forkAtSeq,
            branchTitle: sessionTitle(list, childId),
          })
          output.push(...childRows)
        }

        // Everything this Session did after the selected fork is just another
        // side lane. It is the same Session as the trunk above it, so it is
        // identified by that Session's own title — no lane is a "mainline".
        if (mainlineEnd + 1 < events.length) {
          const continuationLane = allocateLane()
          const continuationRows = buildSide(sessionId, continuationLane, {
            startIndex: mainlineEnd + 1,
            branchStart: true,
            parentLane: 0,
            forkAnchorRow: anchorRow,
            branchForkAt: pathChild?.forkAtSeq,
            branchTitle: sessionTitle(list, sessionId),
            branchId: `${sessionId}@continuation${mainlineEnd + 1}`,
            isContinuation: true,
            // The selected path child already occupies lane 0; never replay it
            // under this lane.
            excludeChildren: new Set([pathChildId]),
          })
          output.push(...continuationRows)
        }
        return output
      }

      const eventRows = buildMainline(rootId, null)

      // Every fork must leave a visible parent node. Nested forks whose exact
      // boundary lives in an inherited prefix have no row of their own there,
      // so anchor them to the nearest already-rendered row on the parent lane.
      // This keeps one single edge treatment for all branches.
      const lastRowByLane = new Map()
      for (const row of eventRows) {
        if (row.kind !== 'event') continue
        if (row.branchStart && (row.forkAnchorRow === undefined || row.forkAnchorRow === null)) {
          const fallback = Number.isSafeInteger(row.parentLane) ? lastRowByLane.get(row.parentLane) : undefined
          if (fallback !== undefined) row.forkAnchorRow = fallback
        }
        lastRowByLane.set(row.lane, row)
      }

      // Turn separators belong to the selected mainline lane only; side lanes
      // are interleaved and should not break its reading flow.
      const decorated = []
      const decoratedByOriginal = new Map()
      const lastTurnBySession = new Map()
      for (const row of eventRows) {
        const previousTurn = lastTurnBySession.get(row.sessionId)
        const turnStart = row.lane === 0
          && pathSet.has(row.sessionId)
          && typeof row.event?.turn === 'number'
          && row.event.turn !== previousTurn
        if (turnStart) lastTurnBySession.set(row.sessionId, row.event.turn)
        const decoratedRow = {
          ...row,
          rowPosition: decorated.length,
          ...(turnStart ? { turnStart: row.event.turn } : {}),
        }
        decoratedByOriginal.set(row, decoratedRow)
        decorated.push(decoratedRow)
      }

      // Convert the fork-anchor references into a per-row edge plan.
      const indexOfRow = new Map()
      decorated.forEach((row, index) => indexOfRow.set(row, index))
      for (const [childIndex, row] of decorated.entries()) {
        if (!row.branchStart || row.forkAnchorRow === undefined) continue
        const anchorDecorated = decoratedByOriginal.get(row.forkAnchorRow)
        const anchorIndex = anchorDecorated === undefined ? undefined : indexOfRow.get(anchorDecorated)
        if (anchorIndex === undefined || childIndex <= anchorIndex) continue
        for (let index = anchorIndex; index <= childIndex; index += 1) {
          const target = decorated[index]
          if (target === undefined) continue
          const edges = target.pendingBranchEdges ?? []
          edges.push({
            parentLane: row.parentLane,
            lane: row.lane,
            phase: index === anchorIndex ? 'stub' : index === childIndex ? 'curve' : 'through',
          })
          target.pendingBranchEdges = edges
        }
      }

      const firstByLane = new Map()
      const lastByLane = new Map()
      decorated.forEach((row, index) => {
        if (!firstByLane.has(row.lane)) firstByLane.set(row.lane, index)
        lastByLane.set(row.lane, index)
      })
      for (const row of decorated) {
        if (row.rowPosition === undefined) continue
        row.activeLanes = [...firstByLane.entries()]
          .filter(([lane]) => row.rowPosition >= firstByLane.get(lane) && row.rowPosition <= lastByLane.get(lane))
          .map(([lane]) => lane)
      }

      return {
        rows: decorated,
        branchCount: byId.size,
        maxLane: Math.max(0, nextLane - 1),
        firstByLane,
        lastByLane,
      }
    }

    function treeLanePaths(row, maxLane, firstByLane, lastByLane) {
      const xFor = (lane) => 10 + lane * 20
      const paths = []
      for (const lane of row.activeLanes ?? []) {
        const laneX = xFor(lane)
        let start = 0
        let end = 30
        if (lane === row.lane) {
          if (firstByLane.get(lane) === row.rowPosition) start = 15
          if (lastByLane.get(lane) === row.rowPosition) end = 15
        }
        if (start < end) paths.push({ d: `M${laneX} ${start} L${laneX} ${end}`, color: treeLaneColor(lane) })
      }
      for (const edge of row.pendingBranchEdges ?? []) {
        const parentX = xFor(edge.parentLane)
        const childX = xFor(edge.lane)
        if (edge.phase === 'stub') {
          // Leave the parent node, swing into the branch's own lane, and keep
          // descending there until the branch's first visible row.
          paths.push({
            d: `M${parentX} 15 C${parentX} 22 ${childX} 20 ${childX} 24 L${childX} 30`,
            color: treeLaneColor(edge.lane),
          })
        } else if (edge.phase === 'through') {
          paths.push({ d: `M${childX} 0 L${childX} 30`, color: treeLaneColor(edge.lane) })
        } else {
          paths.push({ d: `M${childX} 0 L${childX} 15`, color: treeLaneColor(edge.lane) })
        }
      }
      return paths
    }

    function TreeLanes({ row, maxLane, firstByLane, lastByLane }) {
      const width = (maxLane + 1) * 20 + 8
      const paths = treeLanePaths(row, maxLane, firstByLane, lastByLane)
      return React.createElement('svg', {
        width,
        height: 30,
        viewBox: `0 0 ${width} 30`,
        'aria-hidden': true,
      },
        paths.map((path, index) => React.createElement('path', {
          key: index,
          className: 'dstt-lane',
          d: path.d,
          stroke: path.color,
        })),
      )
    }

    function TreeGraph({ row, maxLane, firstByLane, lastByLane, onToggle }) {
      const xFor = (lane) => 10 + lane * 20
      const color = treeLaneColor(row.lane)
      const x = xFor(row.lane)
      return React.createElement('span', { className: 'dstt-graph', style: { width: `${(maxLane + 1) * 20 + 8}px` } },
        React.createElement(TreeLanes, { row, maxLane, firstByLane, lastByLane }),
        React.createElement(row.collapsible ? 'button' : 'span', {
          type: row.collapsible ? 'button' : undefined,
          className: 'dstt-node',
          'data-toggle': row.collapsible || undefined,
          style: { left: `${x}px`, top: '15px', '--dstt-lane-color': color },
          title: row.collapsible ? t(row.collapsed ? 'branchExpand' : 'branchCollapse') : undefined,
          'aria-label': row.collapsible ? t(row.collapsed ? 'branchExpand' : 'branchCollapse') : undefined,
          'aria-expanded': row.collapsible ? String(!row.collapsed) : undefined,
          onClick: row.collapsible
            ? (event) => {
              event.stopPropagation()
              onToggle(row.branchId, row.collapsed)
            }
            : undefined,
        }, row.collapsible ? (row.collapsed ? '+' : '−') : null),
      )
    }

    function TreeRow({ row, maxLane, firstByLane, lastByLane, onToggle, onFork, forking }) {
      const color = treeLaneColor(row.lane)
      const graph = TreeGraph({ row, maxLane, firstByLane, lastByLane, onToggle })
      const request = rowForkRequest(row)
      const unavailable = request === null
      const busy = forking === true
      const forkLabel = unavailable ? t('rowForkUnavailable') : `${t('rowFork')} (#${row.event.seq})`
      return React.createElement('div', {
        className: 'dstt-row',
        'data-branch-session': row.sessionId,
        'data-branch-id': row.branchId,
        'data-mainline': row.isMainline || undefined,
        'data-lane': row.lane,
        'data-turn-start': row.turnStart !== undefined || undefined,
        style: { '--dstt-lane-color': color },
      },
        React.createElement('div', { className: 'dstt-turnCell' },
          row.turnStart === undefined
            ? null
            : React.createElement('span', { className: 'dstt-turnLabel' }, t('turn', { turn: row.turnStart })),
        ),
        React.createElement('div', { className: 'dstt-eventCell' },
          graph,
          React.createElement('span', {
            className: 'dstt-kindTag',
            'data-kind': treeKindForRole(row.event.role),
          }, t(`role.${row.event.role}`).toUpperCase()),
        ),
        React.createElement('div', { className: 'dstt-content' },
          row.branchStart
            ? React.createElement('span', {
                className: 'dstt-branchChip',
                style: { '--dstt-lane-color': color },
                title: row.branchTitle,
              }, row.branchTitle)
            : null,
          row.branchStart && Number.isSafeInteger(row.branchForkAt)
            ? React.createElement('span', { className: 'dstt-forkNote' }, t('forkAt', { seq: row.branchForkAt }))
            : null,
          React.createElement('span', { className: 'dstt-text', title: row.event.text },
            row.event.text === '' ? t('noText') : row.event.text),
          row.collapsed && row.hiddenCount > 0
            ? React.createElement('span', { className: 'dstt-hiddenNote' }, t('branchMore', { count: row.hiddenCount }))
            : null,
          // Every row owns one durable event, so the branch boundary is that
          // exact seq in that row's own Session — never the open Session.
          React.createElement('button', {
            type: 'button',
            className: 'dstt-rowAction',
            'data-dst-row-fork': unavailable ? undefined : 'true',
            'data-fork-session': unavailable ? undefined : request.sessionId,
            'data-fork-seq': unavailable ? undefined : String(request.atSeq),
            'data-busy': busy || undefined,
            title: forkLabel,
            'aria-label': forkLabel,
            disabled: unavailable || busy,
            onClick: (event) => {
              event.stopPropagation()
              if (unavailable || busy) return
              onFork(row)
            },
            dangerouslySetInnerHTML: { __html: BRANCH_ICON },
          }),
        ),
      )
    }

    function TreeView(props) {
      const sessionId = props.sessionId
      const sessions = props.sessions
      const uiWorkspace = props.uiWorkspace
      const list = useSessionList(sessions)
      const tree = useTree(sessionId, true)
      const mutate = React.useMemo(() => makeMutation(sessions, uiWorkspace), [sessions, uiWorkspace])
      const [collapsed, setCollapsed] = React.useState(() => new Set())
      const [forking, setForking] = React.useState(() => new Set())
      const [toast, setToast] = React.useState(null)
      const forkingRef = React.useRef(new Set())
      React.useEffect(() => {
        forkingRef.current = new Set()
        setCollapsed(new Set())
        setForking(new Set())
        setToast(null)
      }, [sessionId])
      React.useEffect(() => {
        if (toast === null) return undefined
        const timer = setTimeout(() => setToast(null), 5000)
        return () => clearTimeout(timer)
      }, [toast])
      const projection = React.useMemo(
        () => projectTree(tree.data, sessionId, collapsed, list),
        [tree.data, sessionId, collapsed, list],
      )
      const onToggle = React.useCallback((branchId, wasCollapsed) => {
        setCollapsed((current) => {
          const next = new Set(current)
          if (wasCollapsed) next.delete(branchId)
          else next.add(branchId)
          return next
        })
      }, [])
      const onForkRow = React.useCallback(async (row) => {
        const request = rowForkRequest(row)
        if (request === null) return
        const key = `${request.sessionId}:${request.atSeq}`
        // A double click can land before the disabled flag repaints.
        if (forkingRef.current.has(key)) return
        forkingRef.current.add(key)
        setForking((current) => new Set(current).add(key))
        try {
          await mutate(request)
          setToast({ text: t('childCreated'), error: false })
        } catch (error) {
          setToast({ text: `${t('requestFailed')}: ${error instanceof Error ? error.message : String(error)}`, error: true })
        } finally {
          forkingRef.current.delete(key)
          setForking((current) => {
            const next = new Set(current)
            next.delete(key)
            return next
          })
        }
      }, [mutate])
      const portalRoot = realGlobal()?.document?.body ?? null
      const notice = toast === null || portalRoot === null ? null : ReactDOM.createPortal(
        React.createElement('div', { className: 'dstt-toast', 'data-error': toast.error || undefined, role: 'status' }, toast.text),
        portalRoot,
      )
      const toolbar = React.createElement('div', { className: 'dstt-toolbar' },
        React.createElement('div', { className: 'dstt-toolbarMain' },
          React.createElement('span', { className: 'dstt-title' }, t('treeTitle')),
          React.createElement('span', { className: 'dstt-subtitle' },
            t('treeSubtitle', { count: projection.branchCount, current: sessionTitle(list, sessionId) })),
        ),
        React.createElement('button', {
          type: 'button',
          className: 'dst-button',
          disabled: tree.loading,
          onClick: tree.reload,
        }, tree.loading ? t('saving') : t('refresh')),
      )
      if (tree.data === null) {
        return React.createElement('div', { className: 'dstt-root' }, toolbar,
          React.createElement('div', { className: 'dstt-empty' },
            tree.error === null
              ? t('loading')
              : React.createElement(React.Fragment, null,
                  React.createElement('div', null, t('readFailed')),
                  React.createElement('div', { className: 'dst-error' }, tree.error),
                  React.createElement('button', { type: 'button', className: 'dst-button', onClick: tree.reload }, t('retry')),
                ),
          ),
          notice,
        )
      }
      const eventColumnWidth = Math.max(236, (projection.maxLane + 1) * 20 + 150)
      return React.createElement('div', {
        className: 'dstt-root',
        style: { '--dstt-event-col': `${eventColumnWidth}px` },
      },
        toolbar,
        React.createElement('div', { className: 'dstt-head' },
          React.createElement('span', { 'aria-hidden': true }),
          React.createElement('span', null, 'Event'),
          React.createElement('span', null, 'Content'),
        ),
        React.createElement('div', { className: 'dstt-scroll' },
          projection.rows.length === 0
            ? React.createElement('div', { className: 'dstt-empty' }, t('empty'))
            : projection.rows.map((row, index) => React.createElement(TreeRow, {
                key: `${row.sessionId}-${row.event.seq}-${index}`,
                row,
                maxLane: projection.maxLane,
                firstByLane: projection.firstByLane,
                lastByLane: projection.lastByLane,
                onToggle,
                onFork: onForkRow,
                forking: forking.has(`${row.sessionId}:${row.event.seq}`),
              })),
        ),
        notice,
      )
    }

    /**
     * Read the stable Chat Context key from one rendered flow row.
     *
     * The key is `<definition-name-length>:<definition-name><message-id>`; it is
     * deliberately not a durable Session seq. The Host resolves it against the
     * complete event log so fork boundaries cannot drift to an unrelated event.
     */
    function chatNodeKeyFromRow(row) {
      const value = row?.getAttribute?.('data-chat-node-key')
      return typeof value === 'string' && value.length > 0 ? value : null
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

        const forkAt = async (chatNodeKey, button) => {
          if (busyRef.current) return
          busyRef.current = true
          if (button !== undefined) button.disabled = true
          setError(null)
          try {
            await mutate({ action: 'fork', sessionId, chatNodeKey })
            setToast({ text: t('childCreated'), error: false })
          } catch (forkError) {
            setToast({ text: `${t('requestFailed')}: ${forkError instanceof Error ? forkError.message : String(forkError)}`, error: true })
          } finally {
            busyRef.current = false
            if (button !== undefined) button.disabled = false
          }
        }

        const openEditor = (chatNodeKey, text) => {
          setEditor({ chatNodeKey })
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
            const chatNodeKey = chatNodeKeyFromRow(row)
            if (chatNodeKey === null) return
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
              edit.addEventListener('click', () => openEditor(chatNodeKey, messageTextFromRow(row)))
            }
            if (branch === null) {
              branch = doc.createElement('button')
              branch.type = 'button'
              branch.className = 'dst-hostAction'
              branch.dataset.dstAction = 'branch'
              branch.innerHTML = BRANCH_ICON
              branch.setAttribute('aria-label', t('userFork'))
              branch.title = t('userFork')
              branch.addEventListener('click', () => { void forkAt(chatNodeKey, branch) })
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
            chatNodeKey: editor.chatNodeKey,
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
        {
          name: 'conversation.view',
          id: 'session-tree',
          order: 20,
          label: () => t('tab'),
          inject: injectTreeProps,
        },
        TreeView,
      ))

      // The Chat package exposes no slot inside the user action row, so this
      // null-rendering observer adds edit/branch buttons beside Copy.
      try {
        slots.inject('conversation.session.header.actions', () => slots.register(
          { name: 'conversation.session.header.actions', id: 'session-tree-user-actions', order: 900, inject: injectTreeProps },
          UserActionInjector,
        ))
      } catch (error) {
        console.warn('[dsh-session-tree] could not mount the user action injector', error)
      }
    }

    exports.__test = {
      TreeView,
      TreeRow,
      projectTree,
      rowForkRequest,
      makeMutation,
      UserActionInjector,
      chatNodeKeyFromRow,
      messageTextFromRow,
    }
    return module.exports
  },
})

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
      editTitle: '编辑这条消息',
      childCreated: '已创建新分支',
      requestFailed: '请求失败',
      branchCollapse: '收起分支',
      branchExpand: '展开分支',
      branchMore: '还有 {count} 条',
      tab: '树视图',
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
      editTitle: 'Edit this message',
      childCreated: 'New branch created',
      requestFailed: 'Request failed',
      branchCollapse: 'Collapse branch',
      branchExpand: 'Expand branch',
      branchMore: '{count} more',
      tab: 'Tree',
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
      '.dstt-root{box-sizing:border-box;height:100%;min-height:0;width:100%;display:flex;flex-direction:column;overflow:hidden;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}',
      '.dstt-toolbar{flex:none;height:38px;display:flex;align-items:center;gap:10px;padding:0 14px;border-bottom:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);min-width:0}',
      '.dstt-toolbarMain{min-width:0;display:flex;align-items:baseline;gap:8px;flex:1}',
      '.dstt-title{font-size:12px;font-weight:600;white-space:nowrap}',
      '.dstt-subtitle{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-size:10.5px}',
      '.dstt-head{flex:none;height:30px;display:grid;grid-template-columns:var(--dstt-event-col,236px) minmax(0,1fr);align-items:center;border-bottom:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-specific-sidebar-fill,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-tertiary);font-size:10px;font-weight:500}',
      '.dstt-head > span{padding:0 8px}',
      '.dstt-head > span:first-child{text-align:left;padding-left:12px}',
      '.dstt-scroll{flex:1;min-height:0;overflow:auto;padding-bottom:calc(var(--dsh-composer-height,152px) + 16px);scrollbar-width:thin;scrollbar-color:var(--dsw-alias-scrollbar-bg-l2) transparent}',
      '.dstt-row{display:grid;grid-template-columns:var(--dstt-event-col,236px) minmax(0,1fr);height:30px;border-bottom:.5px solid var(--dsw-alias-border-l1);transition:background-color 120ms var(--ds-ease-in-out)}',
      '.dstt-row:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.dstt-eventCell{display:flex;align-items:center;justify-content:flex-start;gap:6px;min-width:0;padding:0 8px 0 8px;overflow:hidden}',
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
      '.dstt-turn{display:flex;align-items:center;gap:8px;height:29px;padding:0 10px;color:var(--dsw-alias-label-tertiary);font-size:9.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;background:linear-gradient(90deg,color-mix(in srgb,var(--dsw-alias-label-tertiary) 7%,transparent),transparent)}',
      '.dstt-turn::after{content:"";flex:1;height:1px;background:var(--dsw-alias-border-l1)}',
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
     * Project the current Session and every descendant fork into one ordered
     * ledger. The current Session is lane 0; every descendant gets its own lane
     * (pre-order), so no two branches ever share a column.
     */
    function projectTree(data, currentId, collapsed, list) {
      const { byId, children } = familyChildren(data)
      if (!byId.has(currentId)) {
        return { rows: [], branchCount: 0, maxLane: 0, firstByLane: new Map(), lastByLane: new Map() }
      }
      const laneById = new Map([[currentId, 0]])
      let nextLane = 1
      const assignLanes = (parentId) => {
        for (const childId of children.get(parentId) ?? []) {
          laneById.set(childId, nextLane)
          nextLane += 1
          assignLanes(childId)
        }
      }
      assignLanes(currentId)

      const countHidden = (sessionId) => {
        const events = treeVisibleEvents(byId.get(sessionId))
        let total = Math.max(0, events.length - 1)
        for (const childId of children.get(sessionId) ?? []) {
          total += treeVisibleEvents(byId.get(childId)).length + countHidden(childId)
        }
        return total
      }

      const build = (sessionId, parentLane, isRoot) => {
        const session = byId.get(sessionId)
        const lane = laneById.get(sessionId) ?? 0
        const allEvents = treeVisibleEvents(session)
        const isCollapsed = !isRoot && collapsed.has(sessionId)
        const shown = allEvents.length === 0
          ? [{ seq: Number.isSafeInteger(session?.forkAtSeq) ? session.forkAtSeq : 0, role: 'context', text: '', turn: null }]
          : isCollapsed
            ? allEvents.slice(0, 1)
            : allEvents
        const childIds = children.get(sessionId) ?? []
        const collapsible = !isRoot && (allEvents.length > 1 || childIds.length > 0)
        const branchRows = shown.map((event, index) => ({
          kind: 'event',
          sessionId,
          lane,
          parentLane: index === 0 ? parentLane : null,
          event,
          branchStart: index === 0 && !isRoot,
          isRoot,
          branchTitle: sessionTitle(list, sessionId),
          collapsible: index === 0 && collapsible,
          collapsed: index === 0 && isCollapsed,
          hiddenCount: isCollapsed ? countHidden(sessionId) : 0,
          branchForkAt: Number.isSafeInteger(session?.forkAtSeq) ? session.forkAtSeq : null,
        }))
        if (isCollapsed) return branchRows
        let previousFork = null
        let previousEnd = null
        let previousAnchor = null
        for (const childId of childIds) {
          const childRows = build(childId, lane, false)
          const forkAt = byId.get(childId)?.forkAtSeq
          let insertAt = branchRows.length
          let anchorRow = null
          if (Number.isSafeInteger(forkAt)) {
            if (forkAt === previousFork && previousEnd !== null) {
              // Siblings forked at the same event share one parent anchor; only
              // their insertion point moves past the previous sibling's block.
              insertAt = previousEnd
              anchorRow = previousAnchor
            } else {
              for (let index = branchRows.length - 1; index >= 0; index -= 1) {
                const seq = branchRows[index]?.event?.seq
                if (Number.isSafeInteger(seq) && seq <= forkAt) {
                  insertAt = index + 1
                  anchorRow = branchRows[index]
                  break
                }
              }
              // The fork may sit in an inherited prefix that this Session does
              // not display (e.g. a child forked from an ancestor event). Attach
              // it to the closest visible parent row so the branch still leaves
              // the main trunk at a sensible point.
              if (anchorRow === null && insertAt > 0) anchorRow = branchRows[insertAt - 1] ?? null
            }
          }
          if (anchorRow !== null && childRows.length > 0) {
            childRows[0] = { ...childRows[0], forkAnchorRow: anchorRow }
          }
          branchRows.splice(insertAt, 0, ...childRows)
          previousFork = forkAt
          previousEnd = insertAt + childRows.length
          previousAnchor = anchorRow
        }
        return branchRows
      }

      const rows = build(currentId, null, true)
      // Route each fork edge from the parent node down to its first row: a
      // short stub on the anchor row, a vertical run through intervening rows,
      // then the curve into the branch node. This keeps sibling branches
      // (forked at the same event) visibly attached to the same parent point.
      for (const [childIndex, row] of rows.entries()) {
        if (row.kind !== 'event' || !row.branchStart || row.forkAnchorRow === undefined) continue
        const anchorIndex = rows.indexOf(row.forkAnchorRow)
        if (anchorIndex < 0 || childIndex <= anchorIndex) continue
        for (let index = anchorIndex; index <= childIndex; index += 1) {
          const target = rows[index]
          if (target.kind !== 'event') continue
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
      rows.forEach((row, index) => {
        if (row.kind !== 'event') return
        if (!firstByLane.has(row.lane)) firstByLane.set(row.lane, index)
        lastByLane.set(row.lane, index)
      })
      const decorated = []
      let lastTurn = null
      let eventOrder = 0
      rows.forEach((row, index) => {
        if (row.kind !== 'event') {
          decorated.push(row)
          return
        }
        const next = { ...row, eventOrder, rowPosition: index }
        eventOrder += 1
        next.activeLanes = [...firstByLane.entries()]
          .filter(([lane]) => index >= firstByLane.get(lane) && index <= lastByLane.get(lane))
          .map(([lane]) => lane)
        if (next.sessionId === currentId
          && typeof next.event.turn === 'number'
          && next.event.turn !== lastTurn) {
          lastTurn = next.event.turn
          decorated.push({ kind: 'turn', turn: next.event.turn })
        }
        decorated.push(next)
      })
      return {
        rows: decorated,
        branchCount: laneById.size,
        maxLane: Math.max(0, nextLane - 1),
        firstByLane,
        lastByLane,
      }
    }

    function TreeGraph({ row, maxLane, firstByLane, lastByLane, onToggle }) {
      const width = (maxLane + 1) * 20 + 8
      const xFor = (lane) => 10 + lane * 20
      const color = treeLaneColor(row.lane)
      const x = xFor(row.lane)
      const paths = []
      for (const lane of row.activeLanes) {
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
      if (row.branchStart && Number.isSafeInteger(row.parentLane) && !(row.pendingBranchEdges ?? []).some((edge) => edge.phase === 'curve')) {
        const parentX = xFor(row.parentLane)
        paths.push({
          d: `M${parentX} 0 L${parentX} 13 Q${parentX} 16 ${parentX + 3} 16 L${x} 16 L${x} 15`,
          color,
        })
      }
      return React.createElement('span', { className: 'dstt-graph', style: { width: `${width}px` } },
        React.createElement('svg', { width, height: 30, viewBox: `0 0 ${width} 30`, 'aria-hidden': true },
          paths.map((path, index) => React.createElement('path', {
            key: index,
            className: 'dstt-lane',
            d: path.d,
            stroke: path.color,
          })),
        ),
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
              onToggle(row.sessionId, row.collapsed)
            }
            : undefined,
        }, row.collapsible ? (row.collapsed ? '+' : '−') : null),
      )
    }

    function TreeRow({ row, maxLane, firstByLane, lastByLane, onToggle }) {
      const color = treeLaneColor(row.lane)
      const graph = TreeGraph({ row, maxLane, firstByLane, lastByLane, onToggle })
      return React.createElement('div', {
        className: 'dstt-row',
        'data-branch-session': row.sessionId,
        'data-lane': row.lane,
        style: { '--dstt-lane-color': color },
      },
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
        ),
      )
    }

    function TreeView(props) {
      const sessionId = props.sessionId
      const list = useSessionList(props.sessions)
      const tree = useTree(sessionId, true)
      const [collapsed, setCollapsed] = React.useState(() => new Set())
      React.useEffect(() => {
        setCollapsed(new Set())
      }, [sessionId])
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
        )
      }
      const eventColumnWidth = Math.max(236, (projection.maxLane + 1) * 20 + 150)
      return React.createElement('div', {
        className: 'dstt-root',
        style: { '--dstt-event-col': `${eventColumnWidth}px` },
      },
        toolbar,
        React.createElement('div', { className: 'dstt-head' },
          React.createElement('span', null, 'Event'),
          React.createElement('span', null, 'Content'),
        ),
        React.createElement('div', { className: 'dstt-scroll' },
          projection.rows.length === 0
            ? React.createElement('div', { className: 'dstt-empty' }, t('empty'))
            : projection.rows.map((row, index) => row.kind === 'turn'
                ? React.createElement('div', { key: `turn-${row.turn}-${index}`, className: 'dstt-turn' }, t('turn', { turn: row.turn }))
                : React.createElement(TreeRow, {
                    key: `${row.sessionId}-${row.event.seq}-${index}`,
                    row,
                    maxLane: projection.maxLane,
                    firstByLane: projection.firstByLane,
                    lastByLane: projection.lastByLane,
                    onToggle,
                  })),
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
      projectTree,
      UserActionInjector,
      seqFromNodeKey,
      messageTextFromRow,
    }
    return module.exports
  },
})

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
      emptyDraft: '消息不能为空。',
      userEdit: '编辑消息',
      userFork: '分叉',
      editTitle: '编辑这条消息',
      childCreated: '已创建新分支',
      requestFailed: '请求失败',
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
      emptyDraft: 'The message cannot be empty.',
      userEdit: 'Edit message',
      userFork: 'Branch',
      editTitle: 'Edit this message',
      childCreated: 'New branch created',
      requestFailed: 'Request failed',
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
      /* Inline Session graph inside the native Trajectory ledger. */
      'table[data-dst-graph=on] > colgroup > col:first-child{min-width:84px}',
      'table[data-dst-graph=on] td:first-child{position:relative;overflow:visible!important}',
      'table[data-dst-graph=on] [data-role-kind]{box-sizing:border-box;width:19px!important;height:19px!important;min-width:19px!important;padding:0!important;justify-content:center!important;border-radius:6px!important;transform:translateX(var(--dst-lane-offset,0px));position:relative;z-index:2;outline:1.5px solid color-mix(in srgb,var(--dst-lane-color,#4b8dff) 55%,transparent);outline-offset:1px}',
      'table[data-dst-graph=on] [data-role-kind] > span:last-child{display:none!important}',
      'table[data-dst-graph=on] [data-role-kind] > span:first-child{display:inline-flex!important;width:13px!important;height:13px!important;opacity:1!important;transform:none!important}',
      'table[data-dst-graph=on] [data-role-kind] > span:first-child svg{width:13px!important;height:13px!important}',
      '.dstg-rowGraph{position:absolute;z-index:1;top:0;left:0;overflow:visible;pointer-events:none}',
      '.dstg-rowGraph path{fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}',
      '.dstg-synthRow{height:30px}',
      '.dstg-synthRow > td{height:30px;border-bottom:.5px solid var(--dsw-alias-border-l1);background:color-mix(in srgb,var(--dst-lane-color,#4b8dff) 2.5%,transparent)}',
      '.dstg-synthRow:hover > td{background:var(--dsw-alias-interactive-bg-hover)}',
      'tr[data-dst-lane] > td:first-child{position:relative;overflow:visible!important}',
      '.dstg-synthEvent{position:relative;height:30px;min-width:0}',
      '.dstg-node{position:absolute;z-index:2;box-sizing:border-box;width:19px;height:19px;margin:-9.5px 0 0 -9.5px;display:grid;place-items:center;border:1.5px solid var(--dst-lane-color,#4b8dff);border-radius:6px;background:color-mix(in srgb,var(--dst-lane-color,#4b8dff) 8%,var(--dsw-alias-bg-layer-1));color:var(--dst-lane-color,#4b8dff);box-shadow:0 0 0 2px var(--dsw-alias-bg-layer-1)}',
      '.dstg-node svg{display:block;width:12px;height:12px}',
      '.dstg-synthContent{display:flex;align-items:center;gap:6px;min-width:0;padding:0 8px 0 4px;overflow:hidden;color:var(--dsw-alias-label-primary);font-size:11px;line-height:18px;white-space:nowrap}',
      '.dstg-synthRole{flex:none;color:var(--dsw-alias-label-tertiary);font-size:9.5px}',
      '.dstg-synthText{min-width:0;overflow:hidden;text-overflow:ellipsis;color:var(--dsw-alias-label-secondary)}',
      '.dstg-synthSeq{flex:none;margin-left:auto;color:var(--dsw-alias-label-tertiary);font:9.5px var(--ds-font-family-code);font-variant-numeric:tabular-nums}',
      '.dstg-branchChip{display:inline-flex;flex:none;align-items:center;gap:4px;height:16px;padding:0 5px;border:1px solid color-mix(in srgb,var(--dst-lane-color,#4b8dff) 30%,transparent);border-radius:999px;background:color-mix(in srgb,var(--dst-lane-color,#4b8dff) 9%,transparent);color:color-mix(in srgb,var(--dst-lane-color,#4b8dff) 82%,var(--dsw-alias-label-primary));font-size:9px;line-height:1}',
      '.dstg-branchChip::before{content:"";width:4px;height:4px;border-radius:50%;background:var(--dst-lane-color,#4b8dff)}',
      '.dstg-forkNote{flex:none;color:var(--dsw-alias-label-tertiary);font-size:9px;font-variant-numeric:tabular-nums}',
      '.dstg-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:1300;max-width:min(620px,calc(100vw - 32px));box-sizing:border-box;border-radius:10px;padding:9px 13px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-primary));box-shadow:var(--dsw-elevation-prominent,0 10px 30px rgba(0,0,0,.24));color:var(--dsw-alias-label-primary);font-size:12px;line-height:18px}',
      '.dstg-toast[data-error]{color:var(--dsw-alias-state-error-primary,#e5484d)}',
      '@media (prefers-reduced-motion:no-preference){table[data-dst-graph=on] [data-role-kind]{transition:transform .18s var(--ds-ease-in-out)}}',
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

    function useTree(sessionId, enabled = true) {
      const [state, setState] = React.useState({ loading: true, data: null, error: null })
      const [tick, setTick] = React.useState(0)
      const requestId = React.useRef(0)
      const load = React.useCallback(async () => {
        if (!enabled || typeof sessionId !== 'string' || sessionId.length === 0) return
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

    const LANE_COLORS = ['#4b8dff', '#8f6bff', '#e35d83', '#20a464', '#c98a00', '#2aa8b8']
    const LANE_STEP = 24

    function laneColor(lane) {
      return LANE_COLORS[Math.max(0, lane) % LANE_COLORS.length]
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

    function ownerAtSeq(chain, seq) {
      if (!Array.isArray(chain) || chain.length === 0 || !Number.isSafeInteger(seq)) return null
      let ownerIndex = 0
      for (let index = 1; index < chain.length; index += 1) {
        const inherited = chain[index]?.inheritedEventCount
        if (Number.isSafeInteger(inherited) && seq >= inherited) ownerIndex = index
        else break
      }
      return { session: chain[ownerIndex], lane: ownerIndex }
    }

    function descendantBranches(data, currentId) {
      const { byId, children } = familyChildren(data)
      if (!byId.has(currentId)) return []
      const baseDepth = Math.max(0, chainTo(data, currentId).length - 1)
      const result = []
      const visit = (parentId, depth, seen) => {
        for (const childId of children.get(parentId) ?? []) {
          if (seen.has(childId)) continue
          const nextSeen = new Set(seen)
          nextSeen.add(childId)
          const session = byId.get(childId)
          result.push({
            sessionId: childId,
            parentSessionId: parentId,
            depth,
            forkAtSeq: Number.isSafeInteger(session?.forkAtSeq) ? session.forkAtSeq : null,
            events: Array.isArray(session?.events) ? session.events : [],
          })
          visit(childId, depth + 1, nextSeen)
        }
      }
      visit(currentId, baseDepth + 1, new Set([currentId]))
      return result
    }

    function decodeTrajectoryKey(row) {
      const raw = row.getAttribute('data-trajectory-row-key')
      if (typeof raw !== 'string') return ''
      try { return decodeURIComponent(raw) } catch { return raw }
    }

    const ROLE_ICON = {
      user: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"><circle cx="8" cy="5.2" r="2.5"/><path d="M3.4 13c.5-2.6 2.2-4 4.6-4s4.1 1.4 4.6 4"/></svg>',
      assistant: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round"><path d="M8 2.2c.4 3.1 2.7 5.4 5.8 5.8-3.1.4-5.4 2.7-5.8 5.8C7.6 10.7 5.3 8.4 2.2 8 5.3 7.6 7.6 5.3 8 2.2Z"/></svg>',
      tool: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><path d="M13.7 3.4a3.5 3.5 0 0 1-4.4 4.4L4.4 12.7a1.5 1.5 0 1 1-2.1-2.1l4.9-4.9a3.5 3.5 0 0 1 4.4-4.4l-2.1 2.1 2.1 2.1 2.1-2.1Z"/></svg>',
      'tool-result': '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"><path d="M4 2.4h5.2L12 5.2v8.4H4V2.4Z"/><path d="M9 2.6v3h3M6 8h4M6 10.5h4"/></svg>',
      context: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"><circle cx="8" cy="8" r="5.8"/><path d="M8 7.2v4M8 4.8v.2"/></svg>',
      'turn-end': '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="m3.6 8.2 2.9 2.9 6-6"/></svg>',
      retry: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M13 5.4A5.4 5.4 0 1 0 13.2 10"/><path d="M13 2.7v3.1H9.9"/></svg>',
      compaction: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="m2.5 2.5 3.7 3.7M3 6.2h3.2V3M13.5 2.5 9.8 6.2M13 6.2H9.8V3M2.5 13.5l3.7-3.7M3 9.8h3.2V13M13.5 13.5l-3.7-3.7M13 9.8H9.8V13"/></svg>',
    }

    function roleIcon(role) {
      return ROLE_ICON[role] ?? ROLE_ICON.context
    }

    function ensureRowGraph(td, spec) {
      const g = realGlobal()
      if (g === null || g.document === undefined) return
      let svg = td.querySelector(':scope > svg.dstg-rowGraph')
      if (svg === null) {
        svg = g.document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        svg.setAttribute('class', 'dstg-rowGraph')
        svg.setAttribute('aria-hidden', 'true')
        td.prepend(svg)
      }
      const height = Math.max(1, spec.height)
      const width = Math.max(1, spec.width)
      svg.setAttribute('width', String(width))
      svg.setAttribute('height', String(height))
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
      svg.style.width = `${width}px`
      svg.style.height = `${height}px`
      while (svg.firstChild !== null) svg.removeChild(svg.firstChild)
      const addPath = (d, lane) => {
        const path = g.document.createElementNS('http://www.w3.org/2000/svg', 'path')
        path.setAttribute('d', d)
        path.setAttribute('stroke', laneColor(lane))
        path.setAttribute('opacity', '0.66')
        svg.appendChild(path)
      }
      const centerY = height / 2
      const active = new Set(spec.activeLanes)
      for (const lane of spec.activeLanes) {
        const x = spec.baseX + lane * LANE_STEP
        const endY = spec.endAtNode && lane === spec.lane ? centerY : height
        addPath(`M${x} 0 L${x} ${endY}`, lane)
      }
      // Stop a parent lane at the fork point when it has no later row.
      if (spec.forkFrom !== null && spec.forkFrom !== undefined && !active.has(spec.forkFrom)) {
        const x = spec.baseX + spec.forkFrom * LANE_STEP
        addPath(`M${x} 0 L${x} ${centerY}`, spec.forkFrom)
      }
      if (spec.forkFrom !== null && spec.forkFrom !== undefined) {
        const fromX = spec.baseX + spec.forkFrom * LANE_STEP
        const toX = spec.baseX + spec.lane * LANE_STEP
        addPath(
          `M${fromX} 0 C${fromX} ${centerY * 1.15} ${toX} ${centerY * 0.55} ${toX} ${centerY}`,
          spec.forkFrom,
        )
      }
    }

    function applyNativeRowGraph(tr, spec) {
      const td = tr.firstElementChild
      if (td === null) return
      const tag = tr.querySelector('[data-role-kind]')
      if (tag === null) return
      const height = tr.getBoundingClientRect().height || 30
      const slot = tag.parentElement
      if (slot !== null) slot.style.transform = `translateX(${-spec.maxLane * LANE_STEP}px)`
      tag.style.setProperty('--dst-lane-offset', `${spec.lane * LANE_STEP}px`)
      tag.style.setProperty('--dst-lane-color', laneColor(spec.lane))
      tr.dataset.dstLane = String(spec.lane)
      tr.dataset.dstLaneColor = laneColor(spec.lane)
      tr.dataset.dstSession = spec.sessionId
      tr.dataset.dstSeq = String(spec.seq)
      const baseX = spec.eventColumnWidth - 5.5 - spec.maxLane * LANE_STEP
      ensureRowGraph(td, {
        width: spec.eventColumnWidth,
        height,
        baseX,
        lane: spec.lane,
        activeLanes: spec.activeLanes,
        forkFrom: spec.forkFrom,
        endAtNode: false,
      })
    }

    function createSynthRow(doc, spec) {
      const tr = doc.createElement('tr')
      tr.className = 'dstg-synthRow'
      tr.dataset.dstSynth = '1'
      tr.dataset.dstSession = spec.sessionId
      tr.dataset.dstSeq = String(spec.seq)
      tr.dataset.dstLane = String(spec.lane)
      tr.dataset.dstLaneColor = laneColor(spec.lane)
      tr.dataset.dstLaneColor = laneColor(spec.lane)
      tr.style.setProperty('--dst-lane-color', laneColor(spec.lane))
      const eventTd = doc.createElement('td')
      eventTd.className = 'dstg-synthEvent'
      const contentTd = doc.createElement('td')
      contentTd.className = 'dstg-synthContent'
      const inner = doc.createElement('div')
      inner.className = 'dstg-synthContent'
      contentTd.appendChild(inner)

      const baseX = spec.eventColumnWidth - 5.5 - spec.maxLane * LANE_STEP
      const node = doc.createElement('span')
      node.className = 'dstg-node'
      node.style.left = `${baseX + spec.lane * LANE_STEP}px`
      node.style.top = '15px'
      node.style.setProperty('--dst-lane-color', laneColor(spec.lane))
      node.innerHTML = roleIcon(spec.event.role)
      eventTd.appendChild(node)
      ensureRowGraph(eventTd, {
        width: spec.eventColumnWidth,
        height: 30,
        baseX,
        lane: spec.lane,
        activeLanes: spec.activeLanes,
        forkFrom: spec.forkFrom,
        endAtNode: spec.branchEnd,
      })

      if (spec.branchStart) {
        const chip = doc.createElement('span')
        chip.className = 'dstg-branchChip'
        chip.style.setProperty('--dst-lane-color', laneColor(spec.lane))
        chip.textContent = spec.branchTitle
        inner.appendChild(chip)
        const note = doc.createElement('span')
        note.className = 'dstg-forkNote'
        note.textContent = spec.forkAtSeq === null ? '' : `#${spec.forkAtSeq}`
        if (note.textContent !== '') inner.appendChild(note)
      }
      const role = doc.createElement('span')
      role.className = 'dstg-synthRole'
      role.textContent = t(`role.${spec.event.role}`)
      const text = doc.createElement('span')
      text.className = 'dstg-synthText'
      text.textContent = spec.event.text === '' ? t('noEvents') : spec.event.text
      text.title = spec.event.text
      const seq = doc.createElement('span')
      seq.className = 'dstg-synthSeq'
      seq.textContent = `#${spec.seq}`
      inner.append(role, text, seq)
      tr.append(eventTd, contentTd)
      return tr
    }

    /** Track whether the native Trajectory table is currently mounted. */
    function useTrajectoryPresent() {
      const [present, setPresent] = React.useState(false)
      React.useEffect(() => {
        const g = realGlobal()
        if (g === null || g.document === undefined || g.document.body === null) return undefined
        let frame = 0
        let disposed = false
        const check = () => {
          frame = 0
          if (disposed) return
          setPresent(g.document.querySelector('[data-trajectory-scroll]') !== null)
        }
        const schedule = () => {
          if (frame !== 0) return
          frame = g.requestAnimationFrame(check)
        }
        const observer = new g.MutationObserver(schedule)
        observer.observe(g.document.body, { childList: true, subtree: true })
        check()
        return () => {
          disposed = true
          observer.disconnect()
          if (frame !== 0) g.cancelAnimationFrame(frame)
        }
      }, [])
      return present
    }

    function TrajectoryGraphInjector(props) {
      const sessionId = props.sessionId
      const sessions = props.sessions
      const list = useSessionList(sessions)
      const trajectoryPresent = useTrajectoryPresent()
      const tree = useTree(sessionId, trajectoryPresent)

      React.useEffect(() => {
        if (typeof sessionId !== 'string' || sessionId.length === 0) return undefined
        const g = realGlobal()
        if (g === null || g.document === undefined) return undefined
        const doc = g.document
        let frame = 0
        let injecting = false
        let disposed = false
        let timer = 0

        const clearGraph = () => {
          doc.querySelectorAll('tr[data-dst-synth]').forEach((element) => element.remove())
          doc.querySelectorAll('svg.dstg-rowGraph').forEach((element) => element.remove())
          doc.querySelectorAll('[data-dst-lane]').forEach((element) => {
            element.removeAttribute('data-dst-lane')
            element.removeAttribute('data-dst-lane-color')
            element.removeAttribute('data-dst-session')
            element.removeAttribute('data-dst-seq')
          })
          doc.querySelectorAll('table[data-dst-graph=on] [data-role-kind]').forEach((element) => {
            element.style.removeProperty('--dst-lane-offset')
            element.style.removeProperty('--dst-lane-color')
            if (element.parentElement !== null) element.parentElement.style.removeProperty('transform')
          })
          doc.querySelectorAll('table[data-dst-graph=on]').forEach((table) => {
            table.removeAttribute('data-dst-graph')
            const col = table.querySelector('colgroup > col:first-child')
            if (col !== null) col.style.removeProperty('width')
          })
        }

        const apply = () => {
          frame = 0
          if (disposed) return
          const data = tree.data
          if (data === null || data.sessions === undefined) return
          const table = doc.querySelector('[data-trajectory-scroll] table')
          if (table === null) return
          const tbody = table.querySelector('tbody')
          if (tbody === null) return
          const byId = new Map(data.sessions.map((session) => [session.sessionId, session]))
          const current = byId.get(sessionId)
          if (current === undefined) return
          const chain = chainTo(data, sessionId)
          if (chain.length === 0) return
          const descendants = descendantBranches(data, sessionId)
          const maxLane = Math.max(chain.length - 1, ...descendants.map((branch) => branch.depth), 0)
          const eventColumnWidth = 84 + maxLane * LANE_STEP
          table.setAttribute('data-dst-graph', 'on')
          const col = table.querySelector('colgroup > col:first-child')
          if (col !== null) col.style.width = `${eventColumnWidth}px`

          const eventIndex = current.eventIndex ?? {}
          const firstSeqByLane = new Map()
          const lastSeqByLane = new Map()
          for (const info of Object.values(eventIndex)) {
            if (!info || !Number.isSafeInteger(info.seq)) continue
            const owner = ownerAtSeq(chain, info.seq)
            if (owner === null) continue
            const previousFirst = firstSeqByLane.get(owner.lane)
            if (previousFirst === undefined || info.seq < previousFirst) firstSeqByLane.set(owner.lane, info.seq)
            const previousLast = lastSeqByLane.get(owner.lane)
            if (previousLast === undefined || info.seq > previousLast) lastSeqByLane.set(owner.lane, info.seq)
          }
          const nativeActiveLanes = (lane, seq) => {
            const lanes = []
            for (let index = 0; index <= lane; index += 1) {
              if (index === lane || (lastSeqByLane.get(index) ?? -1) > seq) lanes.push(index)
            }
            return lanes
          }

          const renderedNative = new Set()
          for (const tr of tbody.querySelectorAll('tr[data-trajectory-row-key]')) {
            if (tr.hasAttribute('data-dst-synth')) continue
            const key = decodeTrajectoryKey(tr)
            const info = eventIndex[key]
            if (info === undefined) continue
            const owner = ownerAtSeq(chain, info.seq)
            if (owner === null) continue
            const lane = owner.lane
            const forkFrom = lane > 0 && firstSeqByLane.get(lane) === info.seq ? lane - 1 : null
            applyNativeRowGraph(tr, {
              eventColumnWidth,
              maxLane,
              lane,
              activeLanes: nativeActiveLanes(lane, info.seq),
              forkFrom,
              sessionId: owner.session.sessionId,
              seq: info.seq,
            })
            renderedNative.add(tr)
          }

          const clearSynth = () => {
            tbody.querySelectorAll('tr[data-dst-synth]').forEach((element) => element.remove())
          }
          clearSynth()

          const children = new Map()
          for (const branch of descendants) {
            const bucket = children.get(branch.parentSessionId)
            if (bucket === undefined) children.set(branch.parentSessionId, [branch])
            else bucket.push(branch)
          }
          const visibleRows = () => [...tbody.querySelectorAll('tr[data-dst-session]')]
            .map((row) => ({
              row,
              sessionId: row.getAttribute('data-dst-session'),
              seq: Number(row.getAttribute('data-dst-seq')),
            }))
            .filter((row) => typeof row.sessionId === 'string' && Number.isSafeInteger(row.seq))

          const findAnchor = (parentSessionId, forkAtSeq) => {
            const rows = visibleRows().filter((row) => row.sessionId === parentSessionId)
            let best = null
            let bestSeq = -1
            for (const row of rows) {
              if (Number.isSafeInteger(forkAtSeq) && row.seq > forkAtSeq) continue
              if (row.seq >= bestSeq) {
                bestSeq = row.seq
                best = row.row
              }
            }
            return best
          }

          const insertBranch = (branch, insertionRow) => {
            // A branch is only drawn when its fork anchor is currently in the
            // virtualized window. Guessing a top-of-table position would put
            // the branch at the wrong point in the timeline.
            if (insertionRow === null || insertionRow.parentNode === null) return null
            let cursor = insertionRow
            const anchorSeq = Number(insertionRow.getAttribute('data-dst-seq'))
            const parentHasLater = visibleRows().some((row) =>
              row.sessionId === branch.parentSessionId
              && Number.isSafeInteger(row.seq)
              && row.seq > (Number.isSafeInteger(anchorSeq) ? anchorSeq : -1))
            const events = branch.events.length > 0
              ? branch.events
              : [{ seq: branch.forkAtSeq ?? 0, role: 'context', text: '', turn: null }]
            const fragment = doc.createDocumentFragment()
            let lastRow = null
            for (const [index, event] of events.entries()) {
              const row = createSynthRow(doc, {
                eventColumnWidth,
                maxLane,
                lane: branch.depth,
                activeLanes: parentHasLater
                  ? Array.from({ length: branch.depth + 1 }, (_, lane) => lane)
                  : [branch.depth],
                forkFrom: index === 0 && branch.depth > 0 ? branch.depth - 1 : null,
                branchStart: index === 0,
                branchEnd: index === events.length - 1,
                branchTitle: sessionTitle(list, branch.sessionId),
                forkAtSeq: branch.forkAtSeq,
                sessionId: branch.sessionId,
                seq: Number.isSafeInteger(event.seq) ? event.seq : 0,
                event,
              })
              fragment.appendChild(row)
              lastRow = row
            }
            cursor.after(fragment)
            const branchRows = [...tbody.querySelectorAll(`tr[data-dst-synth][data-dst-session="${CSS.escape(branch.sessionId)}"]`)]
            const ownLast = branchRows.at(-1) ?? lastRow
            let siblingCursor = ownLast
            let siblingAnchor = null
            for (const child of children.get(branch.sessionId) ?? []) {
              const anchor = findAnchor(branch.sessionId, child.forkAtSeq)
              const effectiveAnchor = anchor !== null && anchor === siblingAnchor && siblingCursor?.parentNode !== null
                ? siblingCursor
                : anchor
              const inserted = insertBranch(child, effectiveAnchor)
              if (inserted !== null) {
                siblingAnchor = anchor
                siblingCursor = inserted
              }
            }
            return siblingCursor ?? ownLast
          }

          let siblingCursor = null
          let siblingAnchor = null
          for (const branch of children.get(sessionId) ?? []) {
            const anchor = findAnchor(sessionId, branch.forkAtSeq)
            const effectiveAnchor = anchor !== null && anchor === siblingAnchor && siblingCursor?.parentNode !== null
              ? siblingCursor
              : anchor
            const inserted = insertBranch(branch, effectiveAnchor)
            if (inserted !== null) {
              siblingAnchor = anchor
              siblingCursor = inserted
            }
          }
        }

        const schedule = () => {
          if (frame !== 0 || disposed) return
          frame = g.requestAnimationFrame(() => {
            frame = 0
            if (disposed) return
            injecting = true
            try { apply() } catch (error) { console.warn('[dsh-session-tree] graph injection failed', error) }
            clearTimeout(timer)
            timer = g.setTimeout(() => { injecting = false }, 0)
          })
        }

        const observer = new g.MutationObserver(() => {
          if (injecting) return
          schedule()
        })
        observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-trajectory-row-key'] })
        schedule()
        return () => {
          disposed = true
          observer.disconnect()
          if (frame !== 0) g.cancelAnimationFrame(frame)
          clearTimeout(timer)
          clearGraph()
        }
      }, [list, sessionId, tree.data])

      return null
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

      // There is intentionally no `conversation.view` registration: Session
      // lineage is drawn inside the native Trajectory ledger instead of a
      // separate Tree View tab.

      // Null-rendering observers mounted in the session header: one augments
      // the Host's own user action row, the other draws the inline graph.
      try {
        slots.inject('conversation.session.header.actions', () => slots.register(
          { name: 'conversation.session.header.actions', id: 'session-tree-user-actions', order: 900, inject: injectTreeProps },
          UserActionInjector,
        ))
      } catch (error) {
        console.warn('[dsh-session-tree] could not mount the user action injector', error)
      }
      try {
        slots.inject('conversation.session.header.actions', () => slots.register(
          { name: 'conversation.session.header.actions', id: 'session-tree-trajectory-graph', order: 901, inject: injectTreeProps },
          TrajectoryGraphInjector,
        ))
      } catch (error) {
        console.warn('[dsh-session-tree] could not mount the Trajectory graph injector', error)
      }
    }

    exports.__test = {
      TrajectoryGraphInjector,
      UserActionInjector,
      seqFromNodeKey,
      messageTextFromRow,
    }
    return module.exports
  },
})

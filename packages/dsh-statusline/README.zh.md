# @gitsang/dsh-statusline

一个 DSH 状态栏插件：**保持内置会话统计的原有样式**，只补上原弹窗做不到的一件事——
把模型用时拆成“首 token 用时”和“输出用时”。

输入框下方仍然是原来的两个 pill：

```
21 轮 279 步 · 59 tok/s      53.6M tok · 缓存命中 99%
```

点击仪表 pill，弹出的仍是原来的锚定弹窗样式，只是模型用时多了三行：

```
会话统计
  模型用时                 7小时18分
  首 token 用时            6小时13分
  输出用时                 1小时0分
  工具调用用时             28分59秒
  首 token 平均（TTFT）    1分23秒
  输出速度（TPS）          60 tok/s
```

Token 用量 pill 的弹窗和文案保持原样。

## 为什么这样拆

`sessionStats` 已经记录了足够的数据：

| 字段 | 区间 |
|---|---|
| `llmMs` | `step/start` → `assistant/message` |
| `ttftMs` | `step/start` → 第一个非空流式增量 |
| `decodeMs` | 第一个增量 → `assistant/message`，且该步上报了输出 token（显示为**输出用时**） |

弹窗展示总用时、首 token 用时、输出用时、工具调用用时、首 token 平均延迟
和输出速度。

`ttftMs` 是**客户端观察到的墙钟时间**，包含请求发出、网络、服务端排队、
prefill 以及生成第一个 token 的时间。如果未来 provider 适配器记录了真实
prefill 时间，才应该把那个字段标成 prefill；在那之前不能拿客户端时钟冒充。

## 样式一致性

本包替换 `conversation.composer.dock` 里内置的 `stats` cell（同 id、
`priority: -1`），并刻意复用：

- 内置的 `IconGaugeOutlineRegular`、`IconDatabaseOutlineRegular` 图标；
- 内置的 `useAnchoredPosition`、`useDismissOnOutsidePointer` 定位与关闭行为；
- `StatsPills.module.css` 和 `stat-dialog.module.css` 中逐字段一致的 CSS 值
  （pill 的 padding/gap/radius/颜色、12px/20px 状态条字号、300–440px 弹窗、
  16px 内边距、阴影、hover/focus 状态）；
- 同样的 `data-composer-stats` 钩子，因此 `dsh-mobile` 现有紧凑规则继续生效。

已在真实页面里与内置组件对比：桌面和 390px 手机宽度下，行高同为 22px，
pill 尺寸、颜色、定位一致。唯一有意的视觉差异是时间弹窗因为多了三行而更高。

## 数据来源

不新增 Host 半部、不重放日志、不发模型请求。浏览器半部只读取已有投影：

| 投影 | 用途 |
|---|---|
| `sessionStats` | 轮次、步骤、模型用时、首 token 用时、输出用时/token、工具用时 |
| `tokenUsage` | 全日志累计的未缓存输入 / 缓存读取 / 输出 |

投影基于完整持久日志，分页与压缩不会改变数字。投影缺失时对应 pill 会隐藏。

## 安装

这个组件随 `@gitsang/dsh-qol` 一起安装，不再作为独立 bundle 安装。

```bash
# 本地 checkout
dsh plugin --profile web add ~/src/github.com/gitsang/dsh-qol

# npm 发布后
dsh plugin --profile web add @gitsang/dsh-qol
```

启用 `@gitsang/dsh-qol` 后，在插件详情页里单独开启或关闭这个组件。

## 开发

浏览器半部是纯 JavaScript，无构建步骤。它通过 `window.__ModuleLoader__`
注册，并从 client module table 获取 React、React DOM 和 UI 基础组件。

```bash
node --check src/client.js
node --test
```

测试通过伪造的 module-loader 注册加载真实浏览器半部，覆盖纯函数折叠：
时间拆分、未归因余量、token 分桶、内置缓存命中格式化以及 slot 注册。

## 兼容性

- 仅 Web profile；没有 TUI 渲染。
- 时间拆分依赖 `@deepseek-ai/dsh-session-stats`（`sessionStats`），token
  统计依赖 `@deepseek-ai/dsh-token-meter`（`tokenUsage`），Web profile 均自带。
- 替换行为耦合 `conversation.composer.dock` 的内置 id `stats`。未来若重命名，
  本插件会变成一个附加 pill，弹窗仍然可用。
- 不读取内置的 **compact / detailed** 性能偏好，因此只要有数据就渲染两个
  详细 pill。
- 所有可见文案注册在 `statusline` locale 命名空间（`zh` / `en`）。

## License

MIT

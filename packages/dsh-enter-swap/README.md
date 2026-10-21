# @gitsang/dsh-enter-swap

把 dsh Web 输入框的两个回车快捷键**对调**，并且可以在 **设置 → 通用** 里随时切回来：

| 手势 | dsh 默认 | 插件默认（`Enter 换行`） |
| --- | --- | --- |
| `Enter` | 发送消息 | **换行** |
| `Ctrl/Cmd+Enter` | 加速发送（Queue/Steer 互切） | **发送消息** |
| `Shift+Enter` | 换行 | 换行（不变） |
| `Ctrl/Cmd+Shift+Enter` | 加速发送 | 加速发送（不变，保留原语义） |

设置页里的这一行可以切换两种模式，切换**立即生效**（无需刷新）：

- `Enter 换行 / Ctrl+Enter 发送` —— 对调（默认）
- `dsh 默认：Enter 发送` —— 完全恢复上游行为

## 为什么「快捷键」页面里改不了

`发送消息`（Enter）和 `换行`（Shift+Enter）在 dsh 里是**固定快捷键**，不是可编辑快捷键：

- `packages/client/ui-conversation` 用 `ctx.shortcuts.registerFixed()` 注册 `fixed.send` / `fixed.newline`，
  而不是 `register()`。
- 固定快捷键在「快捷键」设置页里是**只读**的：渲染时不带编辑按钮，代码里
  `ShortcutRegistry.edit()` 对 `row.fixed !== undefined` 的行直接返回 `not-ready`。
- 而且就算改成普通命令也注册不进去：`client-shortcuts` 的 `bindingIssue()` 把纯
  `Enter` / `Shift+Enter` 判为 `modifier-required`、把 `Ctrl+Enter` 判为 `reserved`，
  `register()` 遇到这类默认值直接抛错。
- 根本原因是这两个键的语义不在快捷键注册表里，而在编辑器的 Lexical keymap 中
  （`input/editor/keymap.ts`）：Enter 走 submit 分支，Shift+Enter 落到 Lexical 自己的
  `INSERT_LINE_BREAK` 默认实现。快捷键系统只是把它们**展示**出来，并不驱动它们。

所以「快捷键」页面里那两行永远只读；本插件改为在 **设置 → 通用** 提供一行普通设置，
并在 DOM 边界上完成手势对调。要真正让「快捷键」页面可编辑，必须改 dsh 源码
（放宽 `bindingIssue`，并把 composer 的 Enter 分发改成读取绑定），不是插件能做


## 实现方式

一个 `window` 上的 capture 阶段 `keydown` 监听（Lexical 是在 contenteditable 根节点的
冒泡阶段绑定的，所以能先拿到真实的按键）：

1. `Enter` → 吞掉，往编辑器根节点重新派发一个 `Shift+Enter` → Lexical 插入换行。
2. `Ctrl/Cmd+Enter` → 吞掉，重新派发普通的 `Enter` → 走原来的 submit 路径。
3. `Ctrl/Cmd+Shift+Enter` → 重新派发 `Ctrl+Enter`，保住「加速发送 / 空草稿时
   steer 全部排队消息」的手势。

因为重放的就是上游手势本身，**提交策略、忙时 Queue/Steer 偏好、IME 保护、
队列/插话投递全部沿用上游实现**，插件不复制任何业务逻辑。

刻意不接管的情况：

- **输入法组合中**（`isComposing` / `keyCode 229`）的 Enter —— 永远是确认候选词。
- **`/` 和 `@` 菜单打开时** —— Enter 仍然是「选中候选项」。
- **草稿是斜杠命令时**（`draft.trimStart().startsWith('/')`，与上游 Send 按钮的判据一致）
  —— Enter 仍然是「执行命令」，否则菜单关掉后就没法用 Enter 跑 `/compact` 了。
- **弹窗/菜单打开时**、以及输入框以外的任何地方 —— 完全不碰。

## 安装

这个组件随 `@gitsang/dsh-qol` 一起安装，不再作为独立 bundle 安装。

```bash
# 本地 checkout
dsh plugin --profile web add ~/src/github.com/gitsang/dsh-qol

# npm 发布后
dsh plugin --profile web add @gitsang/dsh-qol
```

启用 `@gitsang/dsh-qol` 后，在插件详情页里单独开启或关闭这个组件。

## 注意

- 只对 Web 前端生效（`dsh web`）。桌面端有自己的原生键盘桥，键位由菜单驱动。
- 「快捷键」设置页仍然显示 `Enter = 发送消息` / `Shift+Enter = 换行`，因为那是上游的
  固定行，插件没有改它的展示。实际行为按上表交换，开关在 **设置 → 通用 → 回车键行为**。
- 偏好存在浏览器 `localStorage`（`dsh.enterSwap.v1`），按浏览器+源隔离，不写 Host
  设置文件；多标签页之间会同步。
- 卸载：从 `bundles` 里删掉包名并重启即可，没有服务端状态；浏览器里可能残留一个
  `dsh.enterSwap.v1` 键，不影响任何行为。

---
description: "在组件自己的插件配置页修改右侧栏终端的字体与主体色，不必再改 dsh 自带的终端打包文件。"
---

# @gitsang/dsh-sidebar-terminal-enhance

[English](README.md) | 中文

## 概述

dsh 自带的右侧栏终端把字体写死在 xterm 初始化参数里，并且只跟随全局浅色/深色主题，
没有配置入口。这个组件在
**插件 → @gitsang/dsh-qol → @gitsang/dsh-sidebar-terminal-enhance** 提供同一个
**终端** 配置页，包含两组：

| 分组 | 字段 | 含义 |
|---|---|---|
| 字体 | 字体族 | 任意已安装的 CSS 字体族列表，例如 `JetBrainsMono Nerd Font Mono` |
| 字体 | 字号 | 整数 8–32 px |
| 字体 | 行高 | 0.9–2 的倍数，图标行太挤时有用 |
| 主体色 | 模式 | **浅色**、**深色** 或 **跟随外观** |

保存后字体会立即作用到已经打开的终端，不需要关闭标签页；两组选择都保存在浏览器
`localStorage` 中，刷新后仍然生效。清空字体字段会恢复自带终端的原始参数；选择
**跟随外观** 并保存会移除配色覆盖，重新跟随当前 DSH 主题。

配置页使用与官方插件配置页相同的 `SettingsForm`、字段、开关和分段控件；修改在点
**保存** 前只停留在表单里，离开页面即丢弃。

## 为什么不能只用 CSS？

xterm 依据 `options.fontFamily` 和 `options.fontSize` 计算字符网格。只用 CSS 覆盖
`.xterm-rows` 会让网格停留在旧度量上，列宽与字形前进宽度脱节，光标会落到错误的
单元格。这个组件改为写入公开的 options：

```js
terminal.options.fontFamily = 'JetBrainsMono Nerd Font Mono'
terminal.options.fontSize = 15
terminal.options.lineHeight = 1.2
```

然后重新执行 FitAddon，并把新的行列数上报给 Host PTY —— 与自带终端在窗口尺寸
变化时使用的流程一致。

终端主体色也由自带终端从屏幕元素的计算样式推导。本组件通过公开的 theme override
层只在 `[data-sidebar-terminal]` 范围内覆盖背景色和默认文字色，因此光标强调色、
选区和默认单元格颜色仍能正确计算。

## 使用

这个包是 `@gitsang/dsh-qol` 的一个组件，自身不声明 `dsh.bundle`。安装一次总 bundle，
再打开对应开关即可：

```bash
dsh plugin --profile web add @gitsang/dsh-qol
```

然后：

1. 打开 **插件 → @gitsang/dsh-qol**，确认
   `@gitsang/dsh-sidebar-terminal-enhance` 已启用。
2. 确认字体安装在**运行浏览器的那台机器**上。
3. 打开这一行的 **配置** 页，填写字体族名，例如
   `JetBrainsMono Nerd Font Mono, Sarasa Term SC Nerd Font, monospace`。
   字体族名不等于文件名；Linux 上用 `fc-list : family | grep -i nerd` 确认，
   macOS 上用「字体册」查看。
4. 选择主体色，用预览确认图标字形正常，然后点 **保存**。

## 范围与行为

- 只影响右侧栏终端的屏幕区域；DSH 其它界面和会话中的代码块保持原有字体与主题。
- 字体留空表示沿用自带默认值；每个字段的 **恢复默认** 只清除该字段的覆盖。
- 每个模拟器挂载时应用一次字体，通过 `MutationObserver` 跟踪新终端；之后打开的
  终端会自动套用当前设置。
- 修改字体会重新 fit 终端并调整 Host PTY，全屏程序拿到的尺寸是正确的。
- 配色保存在历史键 `@gitsang/dsh-terminal-color/preference`，所以原先两个终端组件
  合并前保存的选择会在升级后继续生效。
- 字体只由浏览器所在机器解析。装在 dsh Host 上的字体对远程浏览器无效。

## 已知限制

- xterm 没有对外暴露 DOM 句柄，因此组件通过自带 `TerminalScreen` 渲染的屏幕节点上
  挂的 React fiber 找到活的模拟器实例。每一步都做了形状校验与异常保护，未来 React
  或 xterm 变更最多导致「字体不再被覆盖」，不会弄坏终端 —— 但也可能静默失效。
- 浏览器不允许页面枚举本机字体，字体族名写错只会回退到列表中的下一项。
- 插件首次运行前就已经打开的终端也会被接管，但已有回滚缓冲不会重新折行，旧内容
  要等程序重绘后才换列宽。

## 开发

```bash
node --test test/*.test.mjs
```

测试用替身模拟器覆盖选项写入、fiber 遍历、字体归一化、配色 token、两条持久化路径
以及组件配置页注册。

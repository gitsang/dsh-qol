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
| 字体 | 字体族 | 可搜索下拉框，列表来自宿主机已安装字体并按需流式下载到浏览器；也支持手动输入 CSS 字体族列表 |
| 字体 | 字号 | 整数 8–32 px |
| 字体 | 行高 | 0.9–2 的倍数，图标行太挤时有用 |
| 主体色 | 模式 | **浅色**、**深色** 或 **跟随外观** |

保存后字体会立即作用到已经打开的终端，不需要关闭标签页；两组选择都保存在浏览器
`localStorage` 中，刷新后仍然生效。清空字体字段会恢复自带终端的原始参数；选择
**跟随外观** 并保存会移除配色覆盖，重新跟随当前 DSH 主题。

配置页使用与官方插件配置页相同的 `SettingsForm`、字段、开关和分段控件；修改在点
**保存** 前只停留在表单里，离开页面即丢弃。

### 字体列表

字体族字段会从宿主机读取真实字体目录，不用再猜族名：

- 输入即过滤：先按子串命中，再按模糊子序列匹配；
- `↑` / `↓` 移动、`Enter` 选中、`Esc` 关闭；
- 右侧下拉按钮手动展开列表；
- **仅等宽** 只保留宿主机报告为等宽的字体；
- 选中的字体替换最后一个逗号分段，所以仍可手工拼出
  `JetBrainsMono Nerd Font Mono, Sarasa Term SC Nerd Font, monospace` 这样的回退栈；
- **刷新列表** 重新枚举宿主机字体。

Host 半身提供一条同源路由：

```text
GET /sidebar-terminal-enhance/fonts[?refresh=1]
→ { ok: true, source: "fc-list", cached: false,
    fonts: [{ family: "DejaVu Sans Mono", monospace: true }, …] }
```

它调用平台自带工具：Linux 与 macOS 优先用 `fc-list`（fontconfig），macOS 失败时回退到
`system_profiler SPFontsDataType -json`，Windows 上通过 PowerShell 读 .NET 的
`InstalledFontCollection`；随后把各字面合并成字体族、标记等宽字体，并缓存十分钟。
`?refresh=1` 跳过缓存。

这份目录是**建议来源，不是校验器**。浏览器与 Host 不是同一台机器时，列出的是 Host
的字体而不是浏览器的；所以字段始终接受手动输入，未知族名会自然落到浏览器自己的
回退链上。

### 远程浏览器如何使用宿主字体

字体装在 Host 上，对另一台机器上的浏览器是无效的——浏览器只在本地解析字体族。
因此本组件会把字体文件本身流式发给浏览器。当选中（或输入到预览）目录中的字体族时，
浏览器半身会为它发布 `@font-face`：

```css
@font-face {
  font-family: "Iosevka Nerd Font Mono";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: local("Iosevka Nerd Font Mono"),
       url("/sidebar-terminal-enhance/font/Iosevka%20Nerd%20Font%20Mono/regular.ttf") format("truetype");
}
```

`local()` 在前：本机已装该字体就直接用，不下载；否则浏览器从这条路由取：

```text
GET /sidebar-terminal-enhance/font/<family>/<style>.ttf
style ∈ regular | bold | italic | bolditalic
```

Host 用 `fc-match` 解析字体族，并**拒绝静默替换**（否则缺失的族名会匹配到某个无关的
默认字体），把文件压缩一次（浏览器支持时用 brotli，否则 gzip），以
`Cache-Control: public, max-age=86400, no-transform` 和 `ETag` 返回。压缩结果在内存里
按路径、mtime、大小缓存，上限 48 MB，字体升级后会自动重读而不是发旧文件。

这就是远程浏览器**无需本地安装**也能使用宿主字体的原因。由此带来：

- 只发布终端会用到的四个字面，其它字重回退；
- 首次打开终端会下载一次 regular（以及 bold）——Iosevka 约 3.3 MB——之后走 HTTP 缓存；
- 浏览器不需要任何额外权限或步骤，选中字体族即可；
- 目录响应里的 `streaming.supported` 表示 Host 是否支持流式提供，支持时字段会显示提示。
  没有 fontconfig 时字段仍可作为自由文本使用，回退到浏览器自带字体。

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
4. 预览会显示 `0-9a-zA-Z` 以及 Nerd Font 字形
   `U+E627 U+E73C U+F323 U+E620 U+E738 U+ED0D`；确认字形正常后选择主体色，
   再点 **保存**。

## 范围与行为

- 只影响右侧栏终端的屏幕区域；DSH 其它界面和会话中的代码块保持原有字体与主题。
- 字体留空表示沿用自带默认值；每个字段的 **恢复默认** 只清除该字段的覆盖。
- 每个模拟器挂载时应用一次字体，通过 `MutationObserver` 跟踪新终端；之后打开的
  终端会自动套用当前设置。
- 修改字体会重新 fit 终端并调整 Host PTY，全屏程序拿到的尺寸是正确的。
- 配色保存在历史键 `@gitsang/dsh-terminal-color/preference`，所以原先两个终端组件
  合并前保存的选择会在升级后继续生效。
- 选中目录中的字体族后，其字面会通过 Host 路由按需下载到浏览器，因此远程电脑不必
  本地安装；只有手动输入的、不在目录里的族名才依赖浏览器本机字体。

## 已知限制

- xterm 没有对外暴露 DOM 句柄，因此组件通过自带 `TerminalScreen` 渲染的屏幕节点上
  挂的 React fiber 找到活的模拟器实例。每一步都做了形状校验与异常保护，未来 React
  或 xterm 变更最多导致「字体不再被覆盖」，不会弄坏终端 —— 但也可能静默失效。
- 浏览器不允许页面枚举本机字体，字体族名写错只会回退到列表中的下一项。
- 流式字体在首次使用时按字面下载一次。慢速链路上首屏可能先显示回退字体，直到
  `font-display: swap` 生效；发布规则后 xterm 会重新测量单元格。
- 插件首次运行前就已经打开的终端也会被接管，但已有回滚缓冲不会重新折行，旧内容
  要等程序重绘后才换列宽。

## 开发

```bash
node --test test/*.test.mjs
```

测试用替身模拟器覆盖选项写入、fiber 遍历、字体归一化、配色 token、两条持久化路径、
组件配置页注册，以及 Host 侧的字体枚举、`fc-match` 解析、字体压缩缓存与流式路由。

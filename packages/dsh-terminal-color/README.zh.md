---
description: "为右侧终端选择浅色、深色或跟随外观的主体色，不改变 DSH 其它界面的主题。"
---

# @gitsang/dsh-terminal-color

[English](README.md) | 中文

## 概述

在 **插件 → @gitsang/dsh-qol → @gitsang/dsh-terminal-color** 提供
**终端主体色** 配置页，和「外观」一样提供三个选项：

- **浅色**：即使 DSH 是深色，终端也保持浅色。
- **深色**：即使 DSH 是浅色，终端也保持深色。
- **跟随外观**：终端使用与 DSH 其它界面相同的浅色/深色。

选择保存在浏览器中，刷新后仍然生效。终端的 ANSI 调色板、程序通过 OSC 设置的
颜色、光标与选区行为仍由 DSH 自带终端管理。所选主体色和默认文字色会走终端原本
使用的计算颜色路径，因此光标强调色和默认单元格颜色仍保持可读。

## 使用

1. 在 **插件 → @gitsang/dsh-qol** 中启用 `@gitsang/dsh-terminal-color`。
2. 打开这一行的 **配置** 页。
3. 选择 **浅色**、**深色** 或 **跟随外观**，然后点 **保存**。

## 范围

只影响右侧栏终端的屏幕区域。其它终端类界面、其它插件的配置页以及全局 DSH 主题都不变。

## 开发

```bash
pnpm install
pnpm --filter @gitsang/dsh-terminal-color test
```

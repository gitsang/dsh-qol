# @gitsang/dsh-qol

面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的顺手工具箱：**一个插件，七个可独立开关的组件**。

`QOL` 是 **Quality of Life** 的缩写，指日常使用体验上的小改进，而不是新的核心功能。

## 包含的组件

| 包名 | 作用 | 截图 |
| --- | --- | --- |
| `@gitsang/dsh-enter-swap` | Enter 换行，Ctrl/Cmd+Enter 发送。 | |
| `@gitsang/dsh-no-preview-notice` | 跳过新会话页的版本预览提示。 | |
| `@gitsang/dsh-experimental-auto-review-enhance` | 在组件自己的插件配置页设置实验性的 Auto review 新会话默认值，并可选择中文拒绝理由、是否把理由返回给会话 AI。 | |
| `@gitsang/dsh-reset-terminals` | 提供 `/reset-terminals` 和输入框按钮，在切换权限前关闭持久 PTY 会话。 | |
| `@gitsang/dsh-sidebar-terminal-enhance` | 设置右侧终端的字体族、字号、行高，以及浅色/深色/跟随外观的主体色。 | |
| `@gitsang/dsh-statusline` | 保留原统计胶囊，并把模型用时拆成首 token 等待与输出时间。 | |
| `@gitsang/dsh-session-tree` | 新增「轨迹树」Tab，以 git graph 风格展示整棵会话树，把当前打开的分支重新视为主干 lane 0，行渲染与原生轨迹页一致；可从任意持久事件分叉，也可编辑旧消息后从该轮之前分叉。 | ![轨迹树：git graph 风格的分支泳道](docs/dsh-session-tree-trajectory-branch-tree.png) |

只有 `@gitsang/dsh-qol` 是安装进 profile 的 bundle。七个组件包是它的依赖，并且**刻意不再声明自己的 `dsh.bundle`**。总 bundle 的 patch 为每个组件插入一条 Loader row，所以在 **插件 → @gitsang/dsh-qol → 包含的组件** 里可以看到七个独立开关。

## 组件展示约定

**插件 → @gitsang/dsh-qol** 里的每一行组件都使用同一套展示规则：

- 标题是完整包名（`@gitsang/dsh-statusline`，不用「状态栏」这类别名）；
- 描述来自该包自己的 `package.json` description；
- row id（`statusline`）以代码样式显示；
- 图标使用 DSH 的默认插件图。所有组件包都不声明 `icon`，所以七行组件和插件卡片
  共用同一份双色方块默认图。

如果给某个包加 `icon`（或在 `locale/*.json` 里加 `meta.title`），那一行就会再次
和其它行不一致；想保持统一就不要加。

带配置的组件会在 **插件 → @gitsang/dsh-qol** 下各自的行页面提供 **配置** 入口。
回车键行为、终端字体与主体色、Auto review 新会话默认值、理由语言以及理由是
否返回给会话 AI 都在组件自己的页面里编辑并保存，不再作为一行注入 **设置 → 通用**
或其它设置页。修改在点
**保存** 前只停留在表单里，离开页面即丢弃。

## 安装

### 从本地 checkout 安装

```bash
git clone git@github.com:gitsang/dsh-qol.git ~/src/github.com/gitsang/dsh-qol
cd ~/src/github.com/gitsang/dsh-qol
pnpm install
dsh plugin --profile web add ~/src/github.com/gitsang/dsh-qol
```

然后把 `@gitsang/dsh-qol` 加进 `~/.dsh/profiles/web/package.json` 的 `dsh.profile.bundles`，或者在插件页面里打开它。

### 从 npm 安装

包发布后：

```bash
dsh plugin --profile web add @gitsang/dsh-qol
```

## 单独启停组件

打开 **插件 → @gitsang/dsh-qol**。详情页会列出这个 bundle 的 Loader rows，每一行都可以单独开关，互不影响；bundle 总开关会一次关闭全部七个组件。

前提：

- `@gitsang/dsh-experimental-auto-review-enhance` 需要同时启用 `@deepseek-ai/dsh-experimental-auto-review`；
- `@gitsang/dsh-statusline` 只读取现有的 session projection，不需要 Host 端逻辑；
- `@gitsang/dsh-session-tree` 需要 Host 端的 Session Controller、Session Query 与 Workspace 服务；
- `@gitsang/dsh-sidebar-terminal-enhance` 不需要 Host 端逻辑，它在浏览器里接管
  活的 xterm 实例，并把字体与主体色选择保存在 `localStorage`；字体必须安装在运行
  浏览器的同一台机器上。

## 开发

```bash
pnpm install
pnpm -r --if-present test
```

各组件保留各自的版本、测试和 README。旧的独立仓库已归档，git 历史仍保留在对应的 `gitsang/dsh-*` 仓库中。

## License

MIT

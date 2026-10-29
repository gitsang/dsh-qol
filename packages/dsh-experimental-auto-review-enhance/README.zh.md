# dsh-experimental-auto-review-enhance

在组件自己的 **插件 → @gitsang/dsh-qol → @gitsang/dsh-experimental-auto-review-enhance**
配置页里配置实验性的 **Auto review**：让新建的顶层会话默认使用 Auto review，可选择
拒绝理由的展示语言，并可选择把审核理由一并返回给会话 AI。不会向 DSH 的设置页注入
任何配置项。

适用于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
`0.2.0-rc.2`，并要求 profile 里已启用
`@deepseek-ai/dsh-experimental-auto-review`。

## 为什么需要插件

官方 `@deepseek-ai/dsh-permission-presets` 有意让 `auto` 只存在于当前会话：

- `defaultSettings()` 只接受配置表里的预设，profile 里写 `defaultPreset: auto`
  会让整个 `permission` 行在启动时激活失败（`permission: unknown preset "auto"`）；
- `auto` 只会在 Auto review 集成存活时存在。

因此插件把自己的选择保存在独立的按 profile 状态文件里，并在创建会话时采用 Auto，
而不是把不受支持的值写进权限 Config。

## 它做什么

1. 为本组件的配置页提供一个同源端点：Auto review 新会话默认值、拒绝理由语言，
   以及理由是否也返回给会话 AI。页面会先暂存这些选择，只有点 **保存** 才写入。
2. 把真正新建的顶层会话切到 `auto`：包装
   `permissionPresets.pinInitialPermission`（决定会话初始权限的唯一入口），
   并保留一个 `prepend` 的 `session/created` 监听器作为回退。两条路径共用同一个
   幂等的 `adopt()`，只对真正新建的会话生效。
3. 可选地指示 Auto review 审查器把自由文本 `reason` 写成简体中文。
4. 可选地把审查器自己写的那句理由返回给会话 AI。官方集成有意不把它放进模型可见
   内容：最终拒绝只把理由写进持久化的 `error.info.reason`（由 UI 本地化展示），
   而转人工审批的拒绝只把理由写进审批提示。开启后，插件从 `approval/request`
   事件记住提示里的理由，并在 `tools/post-execute` 里把它追加到该次调用的模型
   可见错误内容末尾；结构化的拒绝标识保持不变，所以 UI 仍显示原来的本地化拒绝卡片。

三项选择都保存在按 profile 划分的文件中：

```text
$DSH_HOME/experimental-auto-review-enhance/<profile>.json
```

不会写入 `permission` Config；官方 `permission.defaultPreset` 始终保持正常值，
所以组合永远能启动。

## 配置组件

1. 打开 **插件 → @gitsang/dsh-qol**，确认
   `@gitsang/dsh-experimental-auto-review-enhance` 已启用。
2. 打开这一行的 **配置** 页。
3. 如果希望新顶层会话默认使用 Auto review，打开
   **新会话默认使用 Auto review**。
4. 选择 **拒绝理由语言**：**英文** 保持官方行为；**中文** 会让审查器用简体中文
   写 `reason`。
5. 如果希望会话 AI 也能看到审查器的理由，打开 **向会话 AI 返回拒绝理由**
   （默认关闭）。
6. 点 **保存**。

Auto review 审查器返回的 JSON 协议始终是英文（`risk`、`decision` 和可选的
`reason`）。其中 `reason` 是审批弹窗或工具拒绝卡片上展示给你的原因说明。翻译
有意只限于这句理由：`risk` 值、`decision` 值、JSON 成员名、审批审计以及模型可见的
固定拒绝消息都保持英文，以保证审批协议稳定；只有可选追加的审查理由会跟随审查器的
语言。这个选项只控制审查器，不会自动跟随 DSH 界面语言。

**向会话 AI 返回拒绝理由** 默认关闭，也不依赖 Auto 新会话默认值。开启后，审查器
拒绝调用时会给 AI 看到的错误追加一行：

```text
Error: Auto review rejected tool "bash"; its body was not executed
Auto review's reason: 会写入 /etc/passwd
```

在 `ask` 审批策略下，审查器拒绝后会先问你；如果你驳回该审批，AI 看到的拒绝里也会
追加同一行。只有「审查器确实拒绝了且给出了 `reason`」的调用会被追加：放行、取消、
其他工具、其他来源的审批请求都不受影响；追加文本会被压成一行并截断到 400 字符，
结构化的 `AutoReviewDeniedError` 标识保持不变，UI 仍按原样展示本地化拒绝卡片。

取消勾选 Auto 默认值并保存后，插件会清掉自己的覆盖，新会话重新遵循普通权限默认值；
语言和 AI 可见性选择会保留。

## 安装

这个组件随 `@gitsang/dsh-qol` 一起安装，不再作为独立 bundle 安装。

```bash
# 本地 checkout
dsh plugin --profile web add ~/src/github.com/gitsang/dsh-qol

# npm 发布后
dsh plugin --profile web add @gitsang/dsh-qol
```

启用 `@gitsang/dsh-qol` 后，在插件详情页里单独开启或关闭这个组件。

## 卸载

在 `@gitsang/dsh-qol` 的插件详情页里关闭这个组件即可。如果还想清掉已保存的选择：

```bash
rm -rf ~/.dsh/experimental-auto-review-enhance
```

## 范围与限制

- 只影响 **新建的顶层会话**；恢复、续接、fork 和 seeded 会话保持原权限。
- 会话的权限在**创建那一刻**就固定了，早于第一条消息。点「新会话」时这个会话已经
  创建并固定，所以之后改组件配置只对**改完以后新建**的会话生效。已经在的会话请用
  输入框的权限控件或 `/permission <preset>` 切换。
- 跳过子代理会话（Auto 集成本来就把子代理固定为 `never`）。
- Auto review 集成未启用时，配置页会禁用 Auto 默认值控件，新会话遵循普通权限默认值；
  已保存的 Auto 选择会保留下来，等集成恢复后继续生效。
- 在组件配置页开启 Auto 默认值 **不会** 弹官方的实验风险确认（官方只对「完全权限」
  和当前会话控件里的 Auto 弹）；想要确认请用 `/permission auto`。
- 包装的是宿主实例方法和 `session/created` 时机，不是公开扩展点；DSH 升级后若
  `pinInitialPermission` 改名会静默失效（日志里有
  `experimental-auto-review-enhance:` warning），但不会破坏启动。语言选项另外通过
  `REVIEW_POLICY` 横幅识别官方 Auto review 系统提示词；若横幅改名，该选项不再生效，
  但官方英文审查仍正常工作。AI 可见性选项通过 `AutoReviewDeniedError` /
  `AUTO_REVIEW_DENIED` 标识和 `Auto review denied tool "<name>":` 提示前缀识别官方
  拒绝；若上游改动其中任一格式，追加的理由会静默消失，但展示给用户的理由仍正常。

## 排错

- **Auto 默认值复选框是禁用的。** 说明当前 profile 里的 Auto review 集成本身没有
  启用。启用 `@deepseek-ai/dsh-experimental-auto-review` 后重启 Host。
- **开启后新建会话仍是原权限。** 这个设置只对 **保存之后新建** 的会话生效。更新并
  重启：`cd ~/.dsh/profiles/web && pnpm update @gitsang/dsh-experimental-auto-review-enhance`，
  然后重启 `dsh web`。
- **AI 看到的还是官方那句拒绝消息。** 可能是 AI 可见性选项没开、审查器拒绝时没有给
  `reason`（无理由的 `deny` 是合法的）、调用被取消，或结果先被其它插件拦下。打开选项
  并保存即可；只要审查器按策略给出理由就会被追加。
- **状态文件位置。** 选择按 profile 保存在
  `$DSH_HOME/experimental-auto-review-enhance/<profile>.json`；旧包
  `permission-auto` 保存的选择仍会被读取，下一次写入会使用新目录。

## 验证

在 DSH `0.2.0-rc.2` 的真实 Host 上（临时 headless profile + Auto review 集成）实测，
以及单元测试与真实 Cordis 监听器组合验证：

| 检查 | 结果 |
| --- | --- |
| 组件配置页可以读取并写入 Auto 新会话默认值 | 通过 |
| Auto 默认值不会注入到 **设置 → 权限** | 通过 |
| profile patch 里没有非法的 `defaultPreset: auto` | 通过 |
| 真实 web 组合里 `agents.create()` 的第 0 条事件就是 `permission/preset: auto` | 通过 |
| 子代理会话不被改动 | 通过 |
| Auto 集成不存在时控件禁用并降级为官方行为 | 通过 |
| 中文语言只给 Auto review 请求追加 reason 语言指令，不影响其他 LLM 调用 | 通过 |
| 选项为英文时不追加任何指令 | 通过 |
| 开启后，最终拒绝的理由会追加到模型可见错误；关闭时不会 | 通过（单元 + 真实 Cordis 组合） |
| 驳回审查器发起的审批时，理由也会返回给 AI | 通过（单元 + 真实 Cordis 组合） |
| 即使 web 侧审批回答器独占处理请求，前置观察者仍能看到它 | 通过（真实 Cordis 组合） |
| 其他工具、其他来源审批、无理由拒绝、被取消的调用都不受影响 | 通过（单元） |

`npm test` 包含基于假 Host 的单元测试，覆盖配置端点、状态字段合并和浏览器组件配置页的注册。

## License

MIT

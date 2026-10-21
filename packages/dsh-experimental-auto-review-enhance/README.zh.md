# dsh-experimental-auto-review-enhance

让内置的 **Auto review** 权限预设出现在 **设置 → 权限**（新会话默认权限）下拉框里，
同时不把 Auto review 写死成唯一默认值。选「仅可查看」「工作区内修改」「完全权限」时
行为与官方完全一致。

适用于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
`0.2.0-rc.2`，并要求 profile 里已启用
`@deepseek-ai/dsh-experimental-auto-review`。

## 为什么需要插件

官方 `@deepseek-ai/dsh-permission-presets` 有意让 `auto` 只存在于当前会话：

- `defaultSettings()` 只接受配置表里的预设，profile 里写 `defaultPreset: auto`
  会让整个 `permission` 行在启动时激活失败（`permission: unknown preset "auto"`）；
- 设置页那一行只渲染 `catalog().defaultOptions`，而它就是
  `Object.keys(presets)`——只有配置表里的预设。

## 它做什么

1. 包装 `permissionPresets.catalog()`，在 Auto review 集成存活时把 `auto`
   追加进 `defaultOptions`（带描述），并发布
   `permission-presets/catalog-changed`，让已经打开的设置面板立即重读。
2. 包装活动的 `settings` 服务：
   - `describe()` 把 `permission` 命名空间的 `value.defaultPreset` 报告为 `auto`；
   - `mutate()` / `update()` 拦截 `defaultPreset: "auto"` 的写入，改为写入本插件
     自己的状态文件。**真正的 `permission.defaultPreset` 始终是普通预设**，
     所以组合永远能启动。
3. 把真正新建的顶层会话切到 `auto`：包装
   `permissionPresets.pinInitialPermission`（决定会话初始权限的唯一入口），
   并保留一个 `prepend` 的 `session/created` 监听器作为回退（宿主没有该方法或
   改名时用）。两条路径共用一个幂等的 `adopt()`，只对真正新建的会话生效。

选择保存在：

```text
$DSH_HOME/experimental-auto-review-enhance/<profile>.json
```

切回普通预设时插件会自动清空它，并把写入交回官方服务。

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

- 只影响 **新建的顶层会话**；恢复/续接/fork 的会话保持原权限。
- 会话的权限在**创建那一刻**就固定了，早于第一条消息。点「新会话」时这个会话已经
  创建并固定，所以之后改设置只对**改完以后新建**的会话生效。已经在的会话请用输入框
  的权限控件或 `/permission <preset>` 切换。
- 跳过子代理会话（Auto 集成本来就把子代理固定为 `never`）。
- Auto review 集成未启用时：下拉框不会出现该项，设置行回退到真实默认值，
  新会话也回退到官方行为。
- 设置页选择 Auto **不会**弹官方的实验风险确认（官方只对「完全权限」和当前会话
  控件里的 Auto 弹）；想要确认请用 `/permission auto`。
- 包装的是宿主实例方法和 `session/created` 时机，不是公开扩展点；DSH 升级后若
  `catalog` / `settings.describe` / `pinInitialPermission` 改名会静默失效
  （日志里有 `experimental-auto-review-enhance:` warning），但不会破坏启动。升级后发现新会话不再
  进 Auto，先查宿主日志里的这个前缀。

## 排错

- **设置里能看到 Auto review，但新建会话仍是原权限。** 说明宿主加载的是旧版本
  插件。更新并重启：
  `cd ~/.dsh/profiles/web && pnpm update @gitsang/dsh-experimental-auto-review-enhance`，
  然后重启 `dsh web`。
- **状态文件位置。** 选择按 profile 保存在
  `$DSH_HOME/experimental-auto-review-enhance/<profile>.json`；旧包
  `permission-auto` 保存的选择仍会被读取，下一次写入会使用新目录。

## 验证

在 DSH `0.2.0-rc.2` 的真实 Host 上（临时 headless profile + Auto review 集成）实测：

| 检查 | 结果 |
| --- | --- |
| `catalog().defaultOptions` 多出 `auto`（`Auto review`） | 通过 |
| 设置写入 auto 后 `describe()` 返回 `auto` | 通过 |
| profile patch 里没有非法的 `defaultPreset: auto` | 通过 |
| 切回普通预设后状态清空、写入交回官方 | 通过 |
| 真实 web 组合里 `agents.create()` 的第 0 条事件就是 `permission/preset: auto` | 通过 |
| 子代理会话不被改动 | 通过 |
| Auto 集成不存在时降级为官方行为 | 通过 |

`npm test` 有 18 个基于假 Host 的单元测试。

## License

MIT

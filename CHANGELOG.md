# Changelog

本项目的所有显著变更将记录在本文件。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [SemVer](https://semver.org/lang/zh-CN/)。

## [1.0.0] - 2026-09-28

### Added

- **「思考语言」设置项**：Web GUI 的「设置 → 通用设置」新增一行，样式与相邻的「语言」行一致
  （同一套标记与 `--dsw-alias-*` token，自绘复刻，不依赖 `dsh-client-ui-primitives`）。
  两档：
  - `简体中文`（默认）：注入两条强制指令（思考用简体中文 + 回复跟随提问语言）；
  - `默认英文`：只注入回复条款，思考语言交给模型自身默认。
- **per-turn 注入**（`injectPerTurn`，默认关）：面向对静态 system prompt section 服从弱的模型，
  每轮在第一条用户消息前以用户消息形态前置同一指令（`agent/pre-step` 瀑布，prepend）；注入带
  幂等标记 `[dsh-think-zh/preturn]`，宿主不提供该瀑布时降级跳过并记 error 日志。
- **Client 半** `client.js`：零构建的 `window.__ModuleLoader__.load` bundle，经
  `ctx.slots.inject('settings.general.item')` 注册行（order 5，位于「语言」0 与「外观」10 之间），
  值经官方 settings 服务读写 profile 条目 config 的 `thinkingLanguage` 字段，文案走 locale 命名空间
  `settings.thinking-language`。
- **即时生效**：`thinkingLanguage` 声明为 schemastery `.volatile()` 字段，section 文本以提供者形态
  注册，宿主每次组装现读 → 改完设置无需重启、不重挂插件。新增 `src/runtime.ts` 的 `readVolatile`
  统一解引用（volatile 字段连默认值也是 `{ get() }` 引用）。
- 导出宿主用的 `Config` schema（schemastery），profile patch 中的 config 由宿主按 schema 解析。

### Fixed

- **per-turn 幂等边界**：只认数组中第一条用户消息——整条已含 `[dsh-think-zh/preturn]` 标记即原样
  返回，未含才注入其首个文本块，不向后续文本块或后续用户消息顺延。
- **设置行保存反馈**：`form.set` 返回值非字面 `true` 时回读快照确认，确实未落盘才提示
  「保存失败，请重试」。
- 「思考语言」下拉菜单打开期间随窗口缩放与任意滚动容器（capture 捕获）重算位置，fixed 定位贴合
  触发器；打开即聚焦当前选中项，方向键遍历立即可用。

### Changed

- `injectPerTurn` 与 `injectPrompt` 为独立开关：两者任一关闭都不影响另一条通道投递指令。
- 档位归一化大小写与首尾空白不敏感（手写 YAML 的 `thinkingLanguage: EN` 等价 `en`），
  client 侧 `pickId` 采用同一规则，两侧取值不分叉。
- `resolveConfig` 入参放宽为 `RawConfigInput`（字段 unknown），内部统一解 volatile 引用后归一：
  非布尔回退默认、`injectionText` 空白视作未自定义并按档位生成文本。
- `registerLanguageInjection` / `registerPerTurnNudge` 改为接收文本提供者 `() => string`。
- 包声明 `dsh.client`（platform web）与 `exports["./client"]`；新增可选 peerDependency
  `@deepseek-ai/schemastery`（volatile 需 ≥3.18.3）；版本 1.0.0。
- 文档按 1.0 重写；新增设计说明 `docs/superpowers/specs/2026-09-27-dsh-think-zh-v1.0-thinking-language.md`。

### Note

- 默认档 `简体中文` 的注入文本与 0.2.0 逐字一致：沿用旧配置的用户行为不变。
- `agent/pre-step` 处理器始终调用 `next()` 维持瀑布契约（处理器不得短路）；`aborted` 只跳过指令
  改写，链路行为交由宿主自查。

### Docs

- README 重构为「特性／安装／使用／配置项／工作原理／兼容性／常见问题／开发与贡献」结构：补桌面
  应用插件页安装方式、逐项配置表、兼容性版本表与排错清单；注入文本字数为实测值（简体中文档
  90 字符、默认英文档 64 字符）。
- 设置导航路径统一为「设置 → 通用设置」，README、`package.json` 描述与 `client.js` 文件头注释同步。
- 新增 `.github/ISSUE_TEMPLATE/feature_request.yml`（此前禁用空 issue 且仅有 bug 模板，功能建议
  没有提交入口）；`.gitignore` 补环境与凭据条目（`.env`、`.npmrc`、`*.tgz` 等）。

## [0.2.0] - 2026-09-05

### Fixed

- `resolveConfig`：YAML 配置传来 `injectPrompt: null`（或 undefined/非布尔值）时，展开合并会覆盖默认值导致插件静默失效；现非布尔一律回退默认 `true`（含回归测试）。

### Added

- GitHub Actions CI：push/PR 触发 typecheck + vitest + build（Node 22）。
- `package.json` 声明 `sideEffects: false`。

### Changed

- `injector.ts` 的 order 注释与 README 对齐官方稀疏 section order 约定（persona 0、一方工具指引 1000+，第三方可用任意有限整数、同 order 按名称序平局）。

## [0.1.0] - 2026-08-16

### Added

- 首个可用版本：单一注入机制——`ctx.systemPrompt.section()` 注册 `dsh-think-zh/language` section（order 2），每次请求向 system prompt 注入精简中文指令（思考恒为简体中文、回复跟随提问语言、代码与标识符保持原文）。
- 配置项：`injectPrompt`（默认开）、`injectionText`（自定义指令文本，空白/非字符串回退内置）。
- 声明 `inject: ['systemPrompt']`（插件入口与 cordis.patch.yml 双保险），确保 `systemPrompt` 服务就绪后才执行 `apply`。

### Removed

- v1 的响应侧 CJK 校验器（语言检测、告警、会话提醒）在 v2 重做中彻底移除：只保留注入，零检测、零缓冲、零写回。

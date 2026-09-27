# Changelog

本项目的所有显著变更将记录在本文件。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [SemVer](https://semver.org/lang/zh-CN/)。

## [1.1.0] - 2026-09-28

### Fixed

- **per-turn 注入幂等守卫漏过**：第一条用户消息已带 `[dsh-think-zh/preturn]` 标记时，旧逻辑按
  「首个未标记文本块」继续向后扫描，把指令再注入同消息的后续文本块（多文本块场景），多轮历史下
  更会逐轮污染后续用户消息。现只考虑数组中第一条用户消息：整条已含标记则原样返回，未含才注入
  其首个文本块，绝不向后顺延；新增三例回归测试。
- **设置行假「保存失败」**：`form.set` 返回值非 `true` 一律判失败；现回读快照确认，确实未落盘才
  提示重试，宿主成功时返回非字面 `true` 不再误报。
- 「思考语言」下拉菜单打开期间随窗口缩放与设置内容栏滚动（capture 捕获任意滚动容器）重算位置，
  fixed 定位不再与触发器脱开；打开即把焦点移入当前选中项，方向键遍历立即可用（未定位首帧改用
  opacity 隐藏，`visibility:hidden` 元素不可聚焦）。

### Changed

- `injectPerTurn` 与 `injectPrompt` 解耦为独立开关：`injectPrompt: false` 不再连带关闭 per-turn 注入，
  可单独以高显著通道投递指令。
- 档位归一化大小写与首尾空白不敏感：手写 YAML 的 `thinkingLanguage: EN` 现按 `en` 生效
  （此前被白名单拒绝而静默回退 `zh`）；client 侧 `pickId` 采用同一规则，两侧取值不分叉。

### Note

- `agent/pre-step` 处理器始终调用 `next()` 维持瀑布契约（处理器不得短路）；`aborted` 只跳过指令改写，
  链路行为交由宿主自查。

## [1.0.0] - 2026-09-27

### Added

- **「思考语言」设置项**：Web GUI 的「设置 → 通用」新增一行，样式与相邻的「语言」行一致
  （同一套标记与 `--dsw-alias-*` token，自绘复刻，不依赖 `dsh-client-ui-primitives`）。
  两档：
  - `简体中文`（默认）：注入两条强制指令（思考用简体中文 + 回复跟随提问语言）；
  - `默认英文`：只注入回复条款，思考语言交给模型自身默认。
- **Client 半** `client.js`：零构建的 `window.__ModuleLoader__.load` bundle，经
  `ctx.slots.inject('settings.general.item')` 注册行（order 5，位于「语言」0 与「外观」10 之间），
  值经官方 settings 服务读写 profile 条目 config 的 `thinkingLanguage` 字段，文案走 locale 命名空间
  `settings.thinking-language`。
- **即时生效**：`thinkingLanguage` 声明为 schemastery `.volatile()` 字段，section 文本以提供者形态
  注册，宿主每次组装现读 → 改完设置无需重启、不重挂插件。新增 `src/runtime.ts` 的 `readVolatile`
  统一解引用（volatile 字段连默认值也是 `{ get() }` 引用）。
- 导出宿主用的 `Config` schema（schemastery），profile patch 中的 config 由宿主按 schema 解析。

### Changed

- `resolveConfig` 入参放宽为 `RawConfigInput`（字段 unknown），内部统一解 volatile 引用后归一：
  非布尔回退默认、`injectionText` 空白视作未自定义并按档位生成文本。
- `registerLanguageInjection` / `registerPerTurnNudge` 改为接收文本提供者 `() => string`。
- 包声明 `dsh.client`（platform web）与 `exports["./client"]`；新增可选 peerDependency
  `@deepseek-ai/schemastery`（volatile 需 ≥3.18.3）；版本升至 1.0.0。
- 文档按 1.0 重写；新增设计说明 `docs/superpowers/specs/2026-09-27-dsh-think-zh-v1.0-thinking-language.md`。

### Note

- 默认档仍是 `简体中文`，与 0.2.0 的注入文本逐字一致：升级后未动设置者行为不变。

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

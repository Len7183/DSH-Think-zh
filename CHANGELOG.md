# Changelog

本项目的所有显著变更将记录在本文件。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [SemVer](https://semver.org/lang/zh-CN/)。

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

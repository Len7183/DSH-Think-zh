# dsh-think-zh 设计文档

日期：2026-08-15
状态：已批准（用户逐节确认）

## 背景与目标

DeepSeek Harness（DSH，`@deepseek-ai/dsh@0.1.0-rc.6`）是 DeepSeek AI 开源的 Agent 框架，基于 Cordis 插件元框架，「一切皆插件」。本机已安装 DSH（npm 全局 + 源码检出 `<DSH 源码检出路径>` + 用户配置 `~/.dsh/profiles/web`）。

目标：制作一个 DSH 插件，**强制 DeepSeek 的回答（content）与思考（reasoning_content）语言为简体中文**，交付形态为独立 DSH 插件包，附带单元测试与安装文档，并在本工作区初始化 git 仓库。

## 方案选择

| 方案 | 描述 | 结论 |
|---|---|---|
| A. 独立 DSH 插件包 | Cordis 插件：请求侧注入中文指令 + 响应侧语言校验 | **采用** |
| B. 仅注入型插件 | 只注册 system prompt section，无校验 | 弃（缺一半需求） |
| C. 纯配置方案 | 只提供 cordis.patch.yml 补丁与 persona 文本 | 弃（不算插件、不可复用） |

## 架构与组件

插件名 `dsh-think-zh`，单个 Cordis 插件入口，内部拆为独立可测单元：

```
src/
  index.ts          # apply(ctx)：挂载注入器与校验器，读取配置
  injector.ts       # 请求侧：注册 system prompt section
  verifier.ts       # 响应侧：session/event 监听 + 回合级语言检测
  language.ts       # 纯函数：CJK 语言检测（零依赖）
  config.ts         # 配置 Schema（schemastery 风格）
cordis.patch.yml    # 声明插件配置项
tests/              # vitest 单元测试
README.zh.md        # 安装/验证/工作原理/限制
```

**注入器**：调用 `ctx.systemPrompt.section()` 注册名为 `dsh-think-zh/language` 的固定 section，把中文语言指令注入每次请求的 system prompt。指令要求回答与思考均使用简体中文（含代码注释、日志、提交信息等细节）。`order` 取 `2`（persona 为 `0`，其后、工具声明之前），不影响工具 schema 组装。

**校验器**：订阅 `session/event` firehose，按 `sessionId` 缓冲 `assistant/chunk` 流中的 `reasoning`（思考）与 `text`（回答）块，回合结束（`turn/end`）时分别统计两类文本的中文占比，低于阈值则告警（`ctx.logger` + 可选向会话追加提示消息，默认关闭追加）。

## 数据流

```
用户提问
  → agent-loop 组装 system prompt（含 dsh-think-zh 注入的中文指令 section）
  → LLM 流式响应 → assistant/chunk（reasoning + text 块）
  → 校验器按 sessionId 缓冲块文本
  → turn/end → 分别统计 reasoning/text 的中文占比
  → 低于阈值 → 告警（ctx.logger + 可选会话提示）
```

## 配置

全部带默认值，Schema 化校验：

| 键 | 默认值 | 说明 |
|---|---|---|
| `injectPrompt` | `true` | 是否注入中文指令 section |
| `injectionText` | 内置默认指令 | 自定义注入文本；留空用默认 |
| `verifyResponse` | `true` | 是否开启响应语言校验 |
| `cjkRatioThreshold` | `0.5` | 有效文本中 CJK 字符占比阈值（剔除代码/符号噪音后） |
| `remindInSession` | `false` | 检测到非中文时是否向会话追加提示消息（默认只告警） |

## 错误处理

- 校验器全程 try/catch：异常只记 `ctx.logger.warn`，不抛给上游；**只读校验**，不拦截、不修改流式响应内容（避免破坏 `assistant/chunk` 协议）。
- 注入器注册失败（如 section 名冲突）→ 记日志并降级为不注入。
- 语言检测为纯函数：空/异常输入返回「无法判定」而非抛错。

## 测试（vitest）

- `language.ts`：中文/英文/日文/代码/混合/空文本/符号噪音边界用例。
- `verifier.ts`：mock `ctx`（`session/event` 事件源 + `turn/end`），验证缓冲聚合、占比计算、阈值告警、`remindInSession` 追加。
- `injector.ts`：mock `systemPrompt.section`，验证注册参数（name/order/text）。
- `config.ts`：默认值、非法阈值报错。

## 文档（README.zh.md）

- 安装：`dsh plugin --profile web add <本目录>` + 重启 profile。
- 验证：`dsh --profile web --dump-config` 应出现 `dsh-think-zh` 行；新会话实测中文问答与思考。
- 工作原理：注入点（systemPrompt section）+ 校验点（session/event）。
- **限制声明**：模型思考语言本质是模型自身行为，无法 100% 程序化锁死——插件通过「指令注入 + 事后检测告警」逼近强制；检测为启发式，代码为主的响应可能误报。

## Git 仓库

- 在 `I:\project\DSH-Think-zh\DSH-Think-zh` 初始化（已完成，`main` 分支）。
- `.gitignore`：`node_modules/`、`lib/` 等构建产物。
- 提交策略：设计文档与实现分开提交。

## 验收标准

1. `dsh plugin --profile web add <本目录>` 可安装，`dsh --profile web --dump-config` 输出含 `dsh-think-zh`。
2. 注入器：所有会话的 system prompt 包含中文语言指令 section。
3. 校验器：纯英文回答/思考触发告警；中文回答/思考不触发。
4. `vitest` 全部用例通过。
5. README.zh.md 提供安装、验证与限制说明。

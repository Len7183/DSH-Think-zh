# dsh-think-zh 设计文档

日期：2026-08-15（v1）；2026-08-16（v2 重做，本文档当前生效版本）
状态：v2 已批准（用户确认：只保留注入、文本精简、强制措辞）

## 背景与目标

DeepSeek Harness（DSH，`@deepseek-ai/dsh@0.1.0-rc.6`）是 DeepSeek AI 开源的 Agent 框架，基于 Cordis 插件元框架，「一切皆插件」。本机已安装 DSH（npm 全局 + 源码检出 `<DSH 源码检出路径>` + 用户配置 `~/.dsh/profiles/web`）。

目标：制作一个 DSH 插件，**当插件启用时**，以最小开销强制 DeepSeek 的思考（reasoning）与回答（content）使用简体中文。交付形态为独立 DSH 插件包，附带单元测试与安装文档，并在本工作区维护 git 仓库。

## v1 → v2 重做原因

v1 采用「请求侧注入 + 响应侧校验告警」双机制。用户重做要求（2026-08-16）：

1. **思考语言指令**：注入一条硬性规则，规定内部推理使用简体中文（非可选项，从第一个思考词开始）。
2. **响应语言指令**：注入一条规则，对用户回复默认使用简体中文，除非用户明确要求其他语言；保证思考与回复语言一致。
3. **保留原文**：两条规则都要求代码、标识符、文件路径、shell 命令等保持原样，不翻译。
4. **零污染零浪费**：插件不污染上下文、不造成 token 浪费。

用户明确决策：

- **只保留注入，彻底去掉校验器**（不再做事后 CJK 检测/告警/写回会话）。
- **注入文本精简到最短版**（覆盖全部 4 点，约 75 字）。
- **「硬」= 注入文本使用「必须/强制」措辞**；插件层不做事后干预（模型是否遵守超出插件控制，见「限制声明」）。

## 方案选择（v2）

| 方案 | 描述 | 结论 |
|---|---|---|
| A. 只注入、精简文本 | 单一 system prompt section，注入强制中文指令；无校验、无检测、无写回 | **采用** |
| B. 注入 + 校验告警 | v1 方案：请求侧注入 + 响应侧 CJK 检测告警 | 弃（用户要求去掉校验器，避免无谓开销与上下文污染） |
| C. 纯配置方案 | 只提供 cordis.patch.yml 补丁与 persona 文本 | 弃（不算插件、不可复用） |

## 架构与组件

插件名 `dsh-think-zh`，单个 Cordis 插件入口，内部拆为独立可测单元：

```
src/
  index.ts          # apply(ctx)：读取配置并挂载注入器（唯一机制）
  injector.ts       # 请求侧：注册 system prompt section
  config.ts         # 配置归一化（默认值、校验、回退）
  types.ts          # 最小宿主接口（仅 systemPrompt + logger）
cordis.patch.yml    # 声明插件配置项
tests/              # vitest 单元测试
README.zh.md        # 安装/验证/工作原理/限制
```

**注入器**：调用 `ctx.systemPrompt.section()` 注册名为 `dsh-think-zh/language` 的固定 section，把中文语言指令注入每次请求的 system prompt。`order` 取 `2`（persona 为 `0`，其后、工具声明之前），不影响工具 schema 组装。注册失败记 error 并降级为不注入，绝不抛出。

**默认注入文本**（精简版，覆盖 4 点需求，约 80 字）：

```
语言要求（强制）：
1. 思考（reasoning）必须使用简体中文。
2. 回复使用与用户提问相同的语言；无法判断时默认简体中文。代码、标识符、文件路径、命令等保持原文，不翻译。
```

- 第 1 条 = 思考语言硬性指令；第 2 条 = 响应语言指令（跟随提问语言 + 兜底中文）+ 保留原文条款。
- 每字符说明：DSH 的 system prompt 每次请求都会重新组装，注入 section 的文本必然随每次请求发送。约 75 字即规则生效的理论最小 token 开销；插件不做任何检测、缓冲、告警或写回，运行时开销为零。

**已删除（相对 v1）**：`verifier.ts`（session/event 监听与回合判定）、`language.ts`（CJK 占比纯函数）及其测试；`MinimalContext` 中事件相关类型（`SessionLike`、`SessionEventLike`、`on`）。

## 数据流

```
用户提问
  → agent-loop 组装 system prompt（含 dsh-think-zh 注入的强制中文指令 section）
  → LLM 依指令思考与回复（插件不监听、不检测、不干预）
```

## v2.1 修复（2026-08-16）：inject 服务依赖

**现象**：插件已安装（link、bundles、patch 均正确，`dump-config` 有条目），但实际发送的 system prompt 中始终没有 `dsh-think-zh/language` section；DSH 会话记录显示模型思考为英文。

**诊断**（对照 dsh-liangshen 插件的 `export const inject = ['systemPrompt', 'tools']` 先例，读 cordis 源码确认）：

- cordis 的 `inject` 机制：插件声明 `inject: ['systemPrompt']` 后，fiber 在服务实现就绪前保持 INACTIVE，**apply 不会被调用**（`_refresh` 中任一注入服务缺失即不激活）。
- dsh-think-zh 未声明 `inject` → apply 在 bundle 启动早期执行，此时 `systemPrompt` 服务可能尚未注册 → `ctx.systemPrompt` 为 `undefined` → `registerLanguageInjection` 的 try/catch 将其捕获并 **warn 降级为不注入**（进程不崩溃，症状是"装了但没生效"）。

**修复**（双保险）：

- `src/index.ts` 导出 `inject = ['systemPrompt']`（模块级声明，cordis 标准路径）。
- `cordis.patch.yml` 的 insert 增加 `inject: [systemPrompt]`（entry options 路径，loader 显式注入）。

**验证**：

- 模拟实验（真实 cordis + dsh-system-prompt）：插件先注册、服务延迟 150ms 注册时，apply 等待服务就绪后执行，`ctx.systemPrompt` 可用，section 注册成功并出现在 assemble 结果中。
- 单元测试：`index.spec.ts` 断言 `inject === ['systemPrompt']`；全量 45 用例通过。

## v2.2 调整（2026-08-16）：回复跟随提问语言

v2/v2.1 的注入文本要求「回复默认简体中文，除非用户明确要求其他语言」。实测用户以英文提问时模型按指令以中文回复，不符合用户预期。

**调整**：第 2 条改为「回复使用与用户提问相同的语言；无法判断时默认简体中文」。英文问→英文答、中文问→中文答，思考（reasoning）恒为简体中文不变。

**验证**：`config.spec.ts` 断言更新（含「提问」）；重建 `lib/` 后需重启 DSH 生效（link 安装）。

## 配置

| 键 | 默认值 | 说明 |
|---|---|---|
| `injectPrompt` | `true` | 是否注入中文指令 section |
| `injectionText` | 内置精简指令 | 自定义注入文本；空白/null/非字符串回退默认 |

（v1 的 `verifyResponse`、`cjkRatioThreshold`、`remindInSession` 随校验器一并移除。）

## 错误处理

- 注入器注册失败（如 section 名冲突）→ 记 `ctx.logger.error` 并降级为不注入。
- 配置回退：`injectionText` 非字符串或空白时回退默认精简指令（类型守卫，不抛错）。

## 测试（vitest）

- `config.ts`：默认值、部分覆盖合并、空白/null/非字符串回退、默认文本同时约束思考/回复/保留原文。
- `injector.ts`：mock `systemPrompt.section`，验证注册参数（name/order/text）。
- `index.ts`：`apply` 默认挂载注入器；`injectPrompt=false` 不注册 section。

## 文档（README.zh.md）

- 安装：`dsh plugin --profile web add <本目录>` + 重启 profile。
- 验证：`dsh --profile web --dump-config` 应出现 `dsh-think-zh` 行；新会话实测中文问答与思考。
- 工作原理：单一注入点（system prompt section），明确 token 开销（每次请求约 75 字）与「零检测、零写回」。
- **限制声明**：模型思考语言本质是模型自身行为，插件只能通过「注入强制指令」影响；是否遵守超出插件控制。

## Git 仓库

- 在本插件仓库维护（`main` 分支）。
- `.gitignore`：`node_modules/`、`lib/` 等构建产物。
- 提交策略：设计文档与实现分开提交；v2 重做吸收 v1 遗留的未提交修改（`config.ts` 类型守卫、`config.spec.ts` 对应用例——重写后自然并入）。

## 验收标准

1. `dsh plugin --profile web add <本目录>` 可安装，`dsh --profile web --dump-config` 输出含 `dsh-think-zh`。
2. 注入器：所有会话的 system prompt 包含精简中文指令 section。
3. 插件源码中不存在校验器/语言检测相关代码与测试。
4. `vitest` 全部用例通过。
5. README.zh.md 提供安装、验证、token 开销与限制说明。

## v0.2.0 优化（2026-09-05）

- **修复**：`resolveConfig` 中 YAML 传来的 `injectPrompt: null`（或 undefined/非布尔值）经展开合并覆盖默认值，导致插件静默失效不注入；现非布尔一律回退默认 `true`（含回归测试）。
- **工程化**：新增 GitHub Actions CI（typecheck + vitest + build，Node 22）；新增 CHANGELOG.md（Keep a Changelog）；`package.json` 声明 `sideEffects: false` 并升版至 0.2.0。
- **文档**：order 注释与 README 对齐官方稀疏 section order 约定（persona 0、一方工具指引 1000+，第三方可用任意有限整数、同 order 平局按名称序；order 2 落在 persona 与 500 之间的留白区）；「错误处理」节 warn → error 对齐代码现状。
- **勘误说明**：本文档早前「注册失败记 warn」与代码实现（记 error）不一致，已以上述勘误对齐；order 注释中「工具声明 100-199」为设计时的过期认知，现行约定见官方 sparse-first-party-prompt-section-orders 笔记。

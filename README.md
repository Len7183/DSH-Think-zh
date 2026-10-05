# dsh-think-zh

[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![CI](https://github.com/Len7183/DSH-Think-zh/actions/workflows/ci.yml/badge.svg)](https://github.com/Len7183/DSH-Think-zh/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%E2%89%A522.19-339933)](package.json)
[![DSH](https://img.shields.io/badge/DSH-%E2%89%A50.1.0-5B6CFF)](#兼容性)

DeepSeek Harness（DSH）插件：**把模型的思考（reasoning）语言锁定为所选档位**（简体中文 / 默认英文），档位在
**设置 → 通用设置 →「思考语言」**里随时切换；回复语言跟随提问语言。

## 项目解决什么问题

DeepSeek Harness 默认的思考语言常常为英文，这不利于中文使用者阅读推理过程、复核结论。
本插件在每次请求的 system prompt 中注入一条精简的强制语言指令，使：

- **思考语言可控**：两档可选——「简体中文」强制思考用简体中文，「默认英文」只约束回复、把思考语言交还模型（1.1.0 起为默认档）；
- **回复跟随提问语言**：中文提问用中文答，英文提问用英文答，判断不出语言倾向时默认简体中文；
- **代码、标识符、文件路径、命令等保持原文**，不翻译。

> **限制声明**：思考语言本质是模型自身行为，插件只能通过「注入强制指令」影响，无法在程序上
> 100% 锁死；模型是否遵守超出插件控制范围。

## 目录

- [特性](#特性)
- [安装](#安装)
- [使用](#使用)
- [配置项](#配置项)
- [工作原理](#工作原理)
- [兼容性](#兼容性)
- [常见问题](#常见问题)
- [许可](#许可)

## 特性

- **两档思考语言**：「简体中文」注入两条强制条款（思考用简体中文 + 回复跟随提问语言）；「默认英文」（1.1.0 起的默认档）只保留回复条款，思考语言交还模型。
- **指令位于 system prompt 最上层**：order -1000000 排在宿主全部内置 section（最小的是 harness 身份段 -1000）之前；另在 `system-prompt/assemble` 瀑布末端把该段重排到首位兜底，防止其他插件以更小 order 或瀑布改序插队（1.1.0 起）。
- **档位在 GUI 里切换**：设置 → 通用设置 →「思考语言」，样式与相邻的「语言」行一致。
- **改完即时生效**：档位是 volatile 配置，下一份请求即用新文本；不用重启、也不用重挂插件。
- **两条投递通道**：静态 system prompt section（默认开）与每轮用户消息前置（`injectPerTurn`，默认关，用于对静态 section 服从弱的模型），两者相互独立。
- **零运行时开销**：只注入一段文本，无语言检测、无缓冲、无写回；每次请求的额外成本就是那段指令本身（默认英文档 64 字符、简体中文档 90 字符）。
- **免构建安装**：仓库内已提交 `lib/` 构建产物，包不含任何安装期脚本，git 直装不触发 pnpm 的构建脚本拦截。

## 安装

前置条件（分级要求，按用到的能力取高者）：

- DeepSeek Harness **≥ 0.1.0-rc.6**：静态 system prompt 注入（`injectPrompt`、`injectionText`）。
- **≥ 0.1.2**：每轮用户消息注入（`injectPerTurn`，需 `agent/pre-step` 瀑布）。
- **≥ 0.1.7**：「思考语言」设置项（依赖官方 settings 服务的 volatile 字段）。
- 源码方式另需 Node.js ≥ 22.19 与 pnpm（`dsh plugin` 内部调用 pnpm）。

### 方式一：桌面应用内安装（推荐）

1. 打开侧栏 **插件**，点 **添加插件**。
2. 填仓库地址 `https://github.com/Len7183/DSH-Think-zh`（也接受 `github:Len7183/DSH-Think-zh`）。
3. 安装完成后按提示重启 DSH。

### 方式二：命令行安装

```bash
dsh plugin --profile <profile 名> add github:Len7183/DSH-Think-zh
```

需要可复现安装时，固定到某个提交：

```bash
dsh plugin --profile <profile 名> add github:Len7183/DSH-Think-zh#<commit-sha>
```

- `<profile 名>` 即 `~/.dsh/profiles/<名字>` 的目录名；等价写法 `npx @deepseek-ai/dsh plugin ...`。
- 桌面应用自己的 `desktop` profile 由应用独占管理，`dsh plugin` 对它不可用——桌面用户走方式一。
- 仓库内已提交 `lib/` 构建产物，且包不含任何安装期脚本（1.1.0 起移除了 `prepare`），从 git 安装不需要本机构建，也不会触发 pnpm 对 git 依赖构建脚本的 `allowBuilds` 拦截——1.0.x 安装报 `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED` 即此因，升级后消除。

### 方式三：从源码安装

```bash
git clone https://github.com/Len7183/DSH-Think-zh.git
cd DSH-Think-zh
npm install
npm run build

# 装进 profile（任意目录执行）；桌面应用也可在插件页填这个绝对路径
dsh plugin --profile <profile 名> add <本目录绝对路径>
```

> 安装必须经由 `dsh plugin` 或桌面插件页。在本目录执行 `npm install` 只是安装开发依赖（构建、测试用）；插件本身只有经由 `dsh plugin` 或桌面插件页才会注册进 profile。

## 使用

### 设置项：思考语言

**设置 → 通用设置**，在「语言」行下方即是「思考语言」两档。

**简体中文**：

```
语言要求（强制）：
1. 思考（reasoning）必须使用简体中文。
2. 回复使用与用户提问相同的语言；无法判断时默认简体中文。代码、标识符、文件路径、命令等保持原文，不翻译。
```

**默认英文**（1.1.0 起的默认档）：

```
语言要求（强制）：
1. 回复使用与用户提问相同的语言；无法判断时默认简体中文。代码、标识符、文件路径、命令等保持原文，不翻译。
```

- **即时生效**：改完的下一份请求即用新文本；已经发出的那一轮不回溯改写。
- **持久化**：写入当前 profile 的 `cordis.patch.yml`，即 `dsh-think-zh` 条目的 `config.thinkingLanguage`。
- **1.0 → 1.1 默认档变更**：1.0 的默认档为「简体中文」，1.1 起为「默认英文」。已在设置页手动选过档位的用户不受影响（档位持久化在 profile 里）；从未改过设置的用户，升级后思考语言会变为不受约束，需要中文思考的话到设置页选回「简体中文」。
- 「默认英文」档不注入思考语言条款，模型是否仍用中文思考取决于模型自身。

### 验证是否生效

profile 由命令行启动时（web、tui 等）：

```bash
dsh --profile <profile 名> --dump-config | grep dsh-think-zh
```

会话内：新建会话，在轨迹视图（先在 设置 → 通用设置 打开「代码工作工具」）里看 system prompt 是否出现「语言要求（强制）：」这一段；打开设置切档位，该段文本应随之变化。

### 输入输出示例

中文提问（「简体中文」档）：

```
用户：请帮我写一个计算斐波那契数列的 Python 函数。

思考（reasoning，简体中文）：用户需要一个计算斐波那契数列的 Python 函数。可以用迭代或递归实现……
回答（text，简体中文）：下面是一个使用迭代实现的 Python 函数：
def fibonacci(n): ...
```

英文提问（「简体中文」档：思考仍为中文，回复跟随英文）：

```
用户：Write a Python function to compute the Fibonacci sequence.

思考（reasoning，恒为简体中文）：用户要求一个计算斐波那契数列的 Python 函数。回复语言应跟随提问使用英文，代码保持原样……
回答（text，跟随提问使用英文）：Here is an iterative Python implementation:
def fibonacci(n): ...
```

> 以上是机制示意，实际输出取决于模型：思考语言由所选档位约束，回复语言跟随提问语言，代码与标识符保持原文。

## 配置项

| 字段 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `injectPrompt` | boolean | `true` | 是否把指令注册为 system prompt section（静态通道） |
| `injectionText` | string | `''` | 自定义指令文本；非空时整段生效，「思考语言」档位被忽略 |
| `injectPerTurn` | boolean | `false` | 是否每轮在用户消息前额外注入（高显著通道） |
| `thinkingLanguage` | `zh` \| `en` | `en` | 设置页写入的档位；大小写与首尾空白不敏感，一般无需手改 |

想在配置文件里直接改，就在 `~/.dsh/profiles/<profile 名>/cordis.patch.yml` 的 `dsh-think-zh` 条目下追加 `config`：

```yaml
- id: dsh-think-zh
  name: 'dsh-think-zh'
  config:
    injectPrompt: true
    injectionText: ''           # 非空时整段生效，档位被忽略
    injectPerTurn: false
    thinkingLanguage: zh        # 可选 zh / en，大小写与首尾空白不敏感
```

### injectPerTurn：每轮注入（可选）

静态 system prompt section 对多数模型已经够用，但**部分模型对静态 section 的服从弱**——实证：kimi k3-256k 在默认 effort 档、思考已开的情况下仍从第一步起用英文（2026-09-10）。这类场景把 `injectPerTurn` 打开，插件会在每轮请求的第一条用户消息前，以用户消息形态（与对话 steering 同一高显著通道）前置同一指令，文本同样跟随「思考语言」档位。

- 注入形如 `[dsh-think-zh/preturn] <指令文本>`，带幂等标记：多 pre-step 调用不会重复叠加，也不会扩散到后续文本块或后续用户消息；幂等按首文本块前缀判定，用户正文出现该字样不会误判为已注入。
- 依赖宿主的 `agent/pre-step` 瀑布；宿主不提供时记一条 `dsh-think-zh:` 开头的 error 日志并跳过，静态通道不受影响。
- 两条通道独立：`injectPrompt: false` 时，仍可只用 per-turn 通道投递指令。

## 工作原理

| 环节 | 机制 |
| --- | --- |
| 加载依赖 | 插件声明 `inject: [systemPrompt]`，cordis 等 `systemPrompt` 服务就绪后才执行 `apply` |
| 注入点 | `ctx.systemPrompt.section()` 注册 `dsh-think-zh/language`（order -1000000：宿主按 order 升序、平局按名称排序 sections，最小内置段是 harness 身份段 -1000，本段稳居其前）；并在 `system-prompt/assemble` 瀑布末端把该段重排到 sections 首位——排序发生在瀑布之前、瀑布返回的顺序即最终顺序，末端重排是第二重保障，兜住其他插件以更小 order 注册或在瀑布中改序的情况 |
| 生效时机 | 每次请求组装 system prompt 时现读；section 的 `text` 以提供者形态注册，volatile 配置改完立刻反映到下一份请求 |
| 设置行 | `client.js` 注册 `settings.general.item`（order 5，位于「语言」0 与「外观」10 之间），取值经官方 settings 服务写入 profile 条目 config |
| 持久化 | `thinkingLanguage` 是 schemastery `.volatile()` 字段：改完即时生效、不重挂插件 |
| 运行时开销 | 无检测、无缓冲、无写回；token 成本就是那段指令（默认英文档 64 字符、简体中文档 90 字符） |

`section()` 的注册在宿主侧是 cordis effect，随插件所在 context 卸载自动回收。

## 兼容性

| 能力 | 起始宿主版本 |
| --- | --- |
| 静态 system prompt 注入（`injectPrompt`、`injectionText`） | 0.1.0-rc.6 |
| 每轮用户消息注入（`injectPerTurn`，需 `agent/pre-step` 瀑布） | 0.1.2 |
| 「思考语言」设置项（需 settings 服务 volatile 字段，schemastery ≥ 3.18.3） | 0.1.7 |

> 注：宿主内置 schemastery 低于 3.18.3 时插件仍正常加载，仅失去「改完即时生效」——档位变更随插件重挂生效，启动日志会给出提示。per-turn 注入在宿主消息缺省 `source` 字段时按 `role === 'user'` 回退判定。

## 常见问题

**装完没反应？** 先重启 DSH——插件在启动时组合，漏重启是最常见原因；再用上面的 `--dump-config` 确认 `dsh-think-zh` 条目确实在 profile 里。

**思考还是英文？** 先确认设置里选的是「简体中文」；已经是而模型仍不服从，说明它对静态 section 服从弱，打开 `injectPerTurn`。

**git 安装报 `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`？** 安装的是 1.0.x：那个版本带 `prepare` 构建脚本，pnpm 默认拦截 git 依赖的构建脚本。升级到 1.1.0+ 重装即可（脚本已移除）；或按报错提示把对应 key 加进 profile 的 `pnpm-workspace.yaml` 的 `allowBuilds`。

**设置里没有「思考语言」行？** 宿主低于 0.1.7，升级 DSH。

**设置行显示「保存失败，请重试」？** profile 目录写入失败，检查 `~/.dsh/profiles/<profile 名>` 的写权限后重试。

**轨迹视图在哪？** 先在 设置 → 通用设置 打开「代码工作工具」。

**Bug 与功能建议提在哪？** 走 [Issues](https://github.com/Len7183/DSH-Think-zh/issues)。

## 许可

MIT © [Len7183](https://github.com/Len7183)

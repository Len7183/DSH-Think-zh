# dsh-think-zh

[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE) [![CI](https://github.com/Len7183/DSH-Think-zh/actions/workflows/ci.yml/badge.svg)](https://github.com/Len7183/DSH-Think-zh/actions/workflows/ci.yml)

为 DeepSeek Harness（DSH）打造的插件：**强制模型的思考（reasoning）使用简体中文**，并在
**「设置 → 通用 → 思考语言」**里随时切换档位；回复语言跟随提问语言。

## 项目解决什么问题

DeepSeek Harness 默认的思考语言常常为英文，这不利于中文使用者阅读推理过程、复核结论。本插件通过在每次请求的 system prompt 中注入一条精简的强制语言指令，使：

- **思考（reasoning）语言可控**：默认档强制简体中文，也可切到「默认英文」把思考语言交还模型；
- **回复跟随提问语言**：中文提问用中文答，英文提问用英文答，无法判断语言倾向时默认简体中文；
- **代码、标识符、文件路径、命令等保持原文**，不翻译。

> **限制声明**：模型思考语言本质是模型自身行为，插件只能通过「注入强制指令」影响，无法 100% 程序化锁死；是否遵守超出插件控制。

## 设置：思考语言

安装后打开 **设置 → 通用**，在「语言」行下方即是「思考语言」行（同款下拉样式）。两档：

**简体中文**（默认）：

```
语言要求（强制）：
1. 思考（reasoning）必须使用简体中文。
2. 回复使用与用户提问相同的语言；无法判断时默认简体中文。代码、标识符、文件路径、命令等保持原文，不翻译。
```

**默认英文**：

```
语言要求（强制）：
1. 回复使用与用户提问相同的语言；无法判断时默认简体中文。代码、标识符、文件路径、命令等保持原文，不翻译。
```

- **即时生效**：改完的下一份请求即用新文本，无需重启、不重挂插件；进行中的会话同样生效。
- **持久化**：写入当前 profile 的 `cordis.patch.yml`，`dsh-think-zh` 条目的 `config.thinkingLanguage`。
- **默认档**：`简体中文`，与 1.0 之前的内置文本逐字一致——升级后未动设置者行为不变。
- 「默认英文」档不注入思考语言条款，模型是否仍用中文思考取决于它自己。

## 安装方法

前置条件：

- 已安装 DeepSeek Harness（`dsh --version` 可运行），版本 **≥ 0.1.7**（设置项依赖官方 settings 服务的 volatile 字段）。
- Node.js ≥ 22.19，pnpm（`dsh plugin` 内部调用）。

### 方式一：从 GitHub 直接安装（推荐）

无需本地构建，命令行执行（等价写法 `npx @deepseek-ai/dsh ...`）：

```bash
dsh plugin --profile <你的 profile 名> add github:Len7183/DSH-Think-zh

# 可复现安装（固定到指定提交，避免上游变更引入意外）：
dsh plugin --profile <你的 profile 名> add github:Len7183/DSH-Think-zh#<commit-sha>
```

### 方式二：从源码构建安装

```bash
# 1. 克隆并构建插件
git clone https://github.com/Len7183/DSH-Think-zh.git
cd DSH-Think-zh
npm install
npm run build

# 2. 安装到 profile（任意目录执行；profile 名以本机 ~/.dsh/profiles 下的目录名为准）
dsh plugin --profile <你的 profile 名> add <本插件目录的绝对路径>

# 3. 重启 DSH
```

> 必须用 `dsh plugin` 形式安装——直接 `npm install` 只会把包当普通库装到当前目录，不会注册进任何 DeepSeek Harness profile。

## 使用方法

安装并重启后插件默认生效（`injectPrompt: true`），无需额外配置。

**验证是否生效**：

```bash
# 确认插件已组合进 profile
dsh --profile <你的 profile 名> --dump-config | grep dsh-think-zh
```

新建会话，观察 system prompt（轨迹视图）中出现「语言要求（强制）」section 即注入成功；
打开 **设置 → 通用** 应看到「思考语言」行，切换档位后该 section 文本随之变化。

**自定义配置**（可选）：在 `~/.dsh/profiles/<profile>/cordis.patch.yml` 中为 `dsh-think-zh` 行追加 `config`：

```yaml
- id: dsh-think-zh
  name: 'dsh-think-zh'
  config:
    injectPrompt: true          # 是否注入中文指令（system prompt section）
    injectionText: ''           # 自定义指令文本；非空时整段生效，思考语言档位被忽略
    injectPerTurn: false        # 是否每轮在用户消息前额外注入（高显著通道，见下）
    thinkingLanguage: zh        # 设置页写入的档位（zh | en），一般无需手改
```

**`injectPerTurn`（每轮注入，可选）**：默认 `false`。静态 system prompt section
对多数模型已足够；但**部分模型**（实证 = kimi k3-256k，默认 effort 档、思考已开）
对静态 section 的服从弱——指令在场、思考仍用英文（2026-09-10 实证）。此类场景
开启 `injectPerTurn: true` 后，插件会在每轮请求的第一条用户消息前以用户消息
形态（对话 steering 同款高显著通道）前置同一指令（文本同样跟随「思考语言」档位）。
注入带幂等标记 `[dsh-think-zh/preturn]`，多 pre-step 调用不会重复叠加。
需要宿主提供 `agent/pre-step` 瀑布（0.1.2+ 均提供）；缺失时降级跳过并记
error 日志，不影响静态注入。

## 输入输出示例

### 中文提问（默认「简体中文」档）

```
用户：请帮我写一个计算斐波那契数列的 Python 函数。

思考（reasoning，简体中文）：用户需要一个计算斐波那契数列的 Python 函数。可以用迭代或递归实现……
回答（text，简体中文）：下面是一个使用迭代实现的 Python 函数：
def fibonacci(n): ...
```

### 英文提问（默认「简体中文」档：思考仍为中文，回复跟随英文）

```
用户：Write a Python function to compute the Fibonacci sequence.

思考（reasoning，恒为简体中文）：用户要求一个计算斐波那契数列的 Python 函数。回复语言应跟随提问使用英文，代码保持原样……
回答（text，跟随提问使用英文）：Here is an iterative Python implementation:
def fibonacci(n): ...
```

> 说明：以上为机制示意，实际输出内容取决于模型。思考语言由所选档位约束；回复语言跟随提问语言，代码与标识符保持原文。

## 工作原理

| 环节 | 机制 |
|---|---|
| 加载依赖 | 插件声明 `inject: [systemPrompt]`：cordis 等待 `systemPrompt` 服务就绪后才执行 `apply` |
| 注入点 | `ctx.systemPrompt.section()` 注册 `dsh-think-zh/language`（order 2，位于 persona 之后、一方工具指引之前） |
| 生效时机 | 每次请求的 system prompt 组装；section 文本以提供者形态注册，**每次组装现读** volatile 配置 |
| 设置行 | Client 半 `client.js` 注册 `settings.general.item`（order 5），值经官方 settings 服务写 profile 条目 config |
| 持久化 | host 侧 `Config` schema 中 `thinkingLanguage` 为 schemastery `.volatile()` 字段：改完即时生效、不重挂插件 |
| 运行时开销 | 零检测、零缓冲、零写回；token 成本仅为每次请求约 75 字指令文本 |

兼容性说明：设置项依赖宿主 settings 服务的 volatile 字段，要求 `@deepseek-ai/dsh` **0.1.7** 及以上；
仅注入能力在 0.1.0-rc.6 起可用。`section()` 的注册在宿主侧是 cordis effect，随插件所在 context 卸载自动回收。

## 开发

```bash
npm install
npm test        # vitest 单元测试（含 client bundle 契约）
npm run build   # tsc 构建 host 半到 lib/
npm run typecheck
```

`client.js` 是手写的零构建 bundle（`window.__ModuleLoader__.load`），由宿主直接提供给浏览器，
不经 tsc；其契约（模块 id、inject、注册参数、档位表与 host 常量一致）由 `tests/client.spec.ts` 锁定。

## 许可

MIT © [Len7183](https://github.com/Len7183)

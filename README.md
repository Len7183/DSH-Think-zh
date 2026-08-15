# dsh-think-zh

![license](https://img.shields.io/badge/license-MIT-blue)

为 DeepSeek Harness（DSH）打造的插件：**强制模型的思考（reasoning）使用简体中文**，并让回复语言跟随提问语言。

## 项目解决什么问题

DeepSeek Harness 默认的思考语言常常为英文，这不利于中文使用者阅读推理过程、复核结论。本插件通过在每次请求的 system prompt 中注入一条精简的强制语言指令，使：

- **思考（reasoning）恒为简体中文**，无论用户用什么语言提问；
- **回复跟随提问语言**：中文提问用中文答，英文提问用英文答，无法判断语言倾向时默认简体中文；
- **代码、标识符、文件路径、命令等保持原文**，不翻译。

> **限制声明**：模型思考语言本质是模型自身行为，插件只能通过「注入强制指令」影响，无法 100% 程序化锁死；是否遵守超出插件控制。

## 主要功能

- **单一注入机制**：`ctx.systemPrompt.section()` 在每次请求的 system prompt 注册 `dsh-think-zh/language` section（order 2，persona 之后、工具声明之前）。
- **零上下文污染、零 token 浪费**：不做任何检测、缓冲、告警或写回；token 成本仅为每次请求约 75 字的指令文本。
- **可靠的加载时序**：插件声明 `inject: ['systemPrompt']`，cordis 等待 `systemPrompt` 服务就绪后才执行 `apply`，避免 section 注册被静默降级。
- **可配置**：支持关闭注入或自定义指令文本。

内置默认指令：

```
语言要求（强制）：
1. 思考（reasoning）必须使用简体中文。
2. 回复使用与用户提问相同的语言；无法判断时默认简体中文。代码、标识符、文件路径、命令等保持原文，不翻译。
```

## 安装方法

前置条件：

- 已安装 DeepSeek Harness（`dsh --version` 可运行）。
- Node.js ≥ 22.19，pnpm（`dsh plugin` 内部调用）。

### 方式一：从 GitHub 直接安装（推荐）

无需本地构建，命令行执行（等价写法 `npx @deepseek-ai/dsh ...`）：

```bash
dsh plugin --profile web add github:Len7183/DSH-Think-zh
```

### 方式二：从源码构建安装

```bash
# 1. 克隆并构建插件
git clone https://github.com/Len7183/DSH-Think-zh.git
cd DSH-Think-zh
npm install
npm run build

# 2. 安装到 web profile（任意目录执行）
dsh plugin --profile web add <本插件目录的绝对路径>

# 3. 重启 DSH
dsh web
```

> 必须用 `dsh plugin` 形式安装——直接 `npm install` 只会把包当普通库装到当前目录，不会注册进任何 DeepSeek Harness profile。

## 使用方法

安装并重启后插件默认生效（`injectPrompt: true`），无需额外配置。

**验证是否生效**：

```bash
# 确认插件已组合进 profile
dsh --profile web --dump-config | grep dsh-think-zh
```

新建会话，观察 system prompt（轨迹视图）中出现「语言要求（强制）」section 即注入成功。

**自定义配置**（可选）：在 `~/.dsh/profiles/web/cordis.patch.yml` 中为 `dsh-think-zh` 行追加 `config`：

```yaml
- id: dsh-think-zh
  name: 'dsh-think-zh'
  config:
    injectPrompt: true        # 是否注入中文指令
    injectionText: ''         # 自定义指令文本；留空用内置精简版
```

## 输入输出示例

### 中文提问

```
用户：请帮我写一个计算斐波那契数列的 Python 函数。

思考（reasoning，简体中文）：用户需要一个计算斐波那契数列的 Python 函数。可以用迭代或递归实现，考虑到性能，迭代更合适……
回答（text，简体中文）：下面是一个使用迭代实现的 Python 函数：
def fibonacci(n): ...
```

### 英文提问

```
用户：Write a Python function to compute the Fibonacci sequence.

思考（reasoning，恒为简体中文）：用户要求一个计算斐波那契数列的 Python 函数。回复语言应跟随提问使用英文，代码保持原样……
回答（text，跟随提问使用英文）：Here is an iterative Python implementation:
def fibonacci(n): ...
```

> 说明：以上为机制示意，实际输出内容取决于模型。思考恒为简体中文，回复语言跟随提问语言，代码与标识符保持原文。

## 工作原理

| 环节 | 机制 |
|---|---|
| 加载依赖 | 插件声明 `inject: [systemPrompt]`：cordis 等待 `systemPrompt` 服务就绪后才执行 `apply` |
| 注入点 | `ctx.systemPrompt.section()` 注册 `dsh-think-zh/language`（order 2，persona 之后、工具声明之前） |
| 生效时机 | 每次请求的 system prompt 组装 |
| 运行时开销 | 零检测、零缓冲、零写回；token 成本仅为每次请求约 75 字指令文本 |

## 开发

```bash
npm test        # vitest 单元测试
npm run build   # tsc 构建到 lib/
```

## 许可

MIT © [Len7183](https://github.com/Len7183)

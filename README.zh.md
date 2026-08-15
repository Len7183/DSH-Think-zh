# dsh-think-zh

强制 DeepSeek Harness（DSH）的思考与回答使用简体中文。

通过**单一机制**生效：在每次请求的 system prompt 注入一条精简的强制语言指令（`dsh-think-zh/language` section）。插件不做任何检测、缓冲、告警或写回——**不污染上下文**，token 开销仅为每次请求约 75 字的指令文本。

注入的指令内容（内置默认）：

```
语言要求（强制）：
1. 思考（reasoning）必须使用简体中文。
2. 回复默认使用简体中文，除非用户明确要求其他语言；代码、标识符、文件路径、命令等保持原文，不翻译。
```

> **限制声明**：模型思考语言本质是模型自身行为，插件只能通过「注入强制指令」影响，无法 100% 程序化锁死；是否遵守超出插件控制。

## 前置条件

- 已安装 DeepSeek Harness（`dsh --version` 可运行）。
- Node.js ≥ 22.19，pnpm（`dsh plugin` 内部调用）。

## 安装

```bash
# 1. 构建插件
npm install
npm run build

# 2. 安装到 web profile（任意目录执行；等价写法 npx @deepseek-ai/dsh ...）
dsh plugin --profile web add <本插件目录的绝对路径>

# 3. 重启 DSH
dsh web
```

## 验证

```bash
# 确认插件已组合进 profile
dsh --profile web --dump-config | grep dsh-think-zh
```

新建会话，分别用中文与英文提问，观察：

- system prompt（轨迹视图）中出现「语言要求（强制）」section；
- 中文提问时思考与回答均为简体中文。

## 配置

在 `~/.dsh/profiles/web/cordis.patch.yml` 中为 `dsh-think-zh` 行追加 `config`：

```yaml
- id: dsh-think-zh
  name: 'dsh-think-zh'
  config:
    injectPrompt: true        # 是否注入中文指令
    injectionText: ''         # 自定义指令文本；留空用内置精简版
```

## 工作原理

| 环节 | 机制 |
|---|---|
| 加载依赖 | 插件声明 `inject: [systemPrompt]`：cordis 等待 `systemPrompt` 服务就绪后才执行 `apply`，避免 section 注册在服务未就绪时被静默降级（注入失效） |
| 注入点 | `ctx.systemPrompt.section()` 注册 `dsh-think-zh/language`（order 2，persona 之后、工具声明之前） |
| 生效时机 | 每次请求的 system prompt 组装 |
| 运行时开销 | 零检测、零缓冲、零写回；token 成本仅为每次请求约 75 字指令文本 |

## 开发

```bash
npm test        # vitest 单元测试
npm run build   # tsc 构建到 lib/
```

## 许可

MIT

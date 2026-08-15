# dsh-think-zh

强制 DeepSeek Harness（DSH）的回答与思考使用简体中文。

通过两条机制逼近「强制」：

1. **注入**：在每次请求的 system prompt 注入中文语言指令（`dsh-think-zh/language` section）。
2. **校验**：监听 `session/event`，对每个回合的思考（reasoning）与回答（text）分别统计 CJK 占比，低于阈值时告警（并可选择向会话追加中文提醒）。

> **限制声明**：模型思考语言本质是模型自身行为，任何插件都无法 100% 程序化锁死。本插件通过「指令注入 + 事后检测告警」尽量逼近强制；语言检测为启发式（按字符占比），代码为主的响应可能误报。

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
- 英文回答/思考时日志出现 `疑似非中文` 告警，中文时无告警。

## 配置

在 `~/.dsh/profiles/web/cordis.patch.yml` 中为 `dsh-think-zh` 行追加 `config`：

```yaml
- id: dsh-think-zh
  name: 'dsh-think-zh'
  config:
    injectPrompt: true        # 是否注入中文指令
    injectionText: ''         # 自定义指令文本；留空用内置默认
    verifyResponse: true      # 是否开启响应语言校验
    cjkRatioThreshold: 0.5    # CJK 占比阈值（0-1）
    remindInSession: false    # 非中文时是否向会话追加中文提醒
```

## 工作原理

| 环节 | 机制 |
|---|---|
| 注入点 | `ctx.systemPrompt.section()` 注册 `dsh-think-zh/language`（order 2，persona 之后、工具声明之前） |
| 校验点 | `ctx.on('session/event')` 缓冲 `assistant/chunk` 的 `reasoning-delta`/`text-delta`，`turn/end` 时判定 |
| 语言检测 | 纯函数字符统计：汉字（扩展A/基本/兼容区）+ 中文标点 / 非空白字符 |

## 开发

```bash
npm test        # vitest 单元测试
npm run build   # tsc 构建到 lib/
```

## 许可

MIT

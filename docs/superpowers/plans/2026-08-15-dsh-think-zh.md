# dsh-think-zh 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建 DSH（DeepSeek Harness）插件 `dsh-think-zh`，通过 system prompt 注入 + 响应语言校验，强制 DeepSeek 的回答与思考使用简体中文。

**Architecture:** 单个 Cordis 插件入口（`apply(ctx, config)`），内部拆为四个可测单元：`language.ts`（零依赖 CJK 语言检测纯函数）、`config.ts`（配置归一化）、`injector.ts`（`ctx.systemPrompt.section()` 注册中文指令）、`verifier.ts`（监听 `session/event` firehose 缓冲 `assistant/chunk` 的 reasoning/text 块，`turn/end` 时判定并告警）。校验只读，不拦截/修改流式响应。

**Tech Stack:** TypeScript（ESM, NodeNext）+ vitest。**零 runtime 依赖**（`typescript`/`vitest`/`@types/node` 仅为 devDependencies）。

## Global Constraints

（来自 `docs/superpowers/specs/2026-08-15-dsh-think-zh-design.md`，逐条照抄）

- 插件名 `dsh-think-zh`；prompt section 名 `dsh-think-zh/language`，order 取 `2`（persona `0` 之后、工具声明 `100-199` 之前）。
- 配置默认值：`injectPrompt=true`、`injectionText=内置默认指令`、`verifyResponse=true`、`cjkRatioThreshold=0.5`、`remindInSession=false`。
- 校验器**只读**：不得拦截、不得修改流式响应内容；任何异常只记 `ctx.logger.warn`，绝不抛出到 agent 循环。
- 语言检测为纯函数，零依赖；空/异常输入返回「无法判定」（`null`）而非抛错。
- 回答（text）与思考（reasoning）**分别**统计 CJK 占比并分别判定。
- 源码使用 ESM，import 带 `.js` 后缀（NodeNext 解析）；测试用 vitest 直接跑 TS。
- 构建产物 `lib/` 与 `node_modules/` 不入库（`.gitignore` 已含）。
- 所有用户可见文案（README、注释、提交信息）使用简体中文。

---

### Task 1: 项目脚手架 + 语言检测纯函数 `language.ts`

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/language.ts`
- Create: `tests/language.spec.ts`

**Interfaces:**
- Produces（供 Task 4 使用）:
  - `countCjk(text: string): number` —— 文本中 CJK 汉字字符数（含扩展区与兼容区）
  - `countRelevant(text: string): number` —— 非空白字符总数（含英文/数字/标点/CJK）
  - `cjkRatio(text: string): number | null` —— `countCjk / countRelevant`；`countRelevant === 0` 时返回 `null`（无法判定）

- [ ] **Step 1: 写失败测试 `tests/language.spec.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { countCjk, countRelevant, cjkRatio } from '../src/language.js'

describe('countCjk', () => {
  it('统计简体中文字符', () => {
    expect(countCjk('你好世界')).toBe(4)
  })
  it('忽略英文与数字', () => {
    expect(countCjk('hello 123 world')).toBe(0)
  })
  it('识别扩展区与兼容区汉字', () => {
    expect(countCjk('\u3400\u4DBF\uF900')).toBe(3) // 扩展A、扩展A末、兼容区
  })
  it('中文全角标点计入中文内容', () => {
    expect(countCjk('你好，世界！')).toBe(6) // 4 汉字 + ，+ ！
  })
  it('日文假名不计入中文', () => {
    expect(countCjk('こんにちは')).toBe(0)
  })
  it('空字符串返回 0', () => {
    expect(countCjk('')).toBe(0)
  })
})

describe('countRelevant', () => {
  it('排除空白字符', () => {
    expect(countRelevant('a b\tc\n d')).toBe(4)
  })
  it('空与纯空白返回 0', () => {
    expect(countRelevant('')).toBe(0)
    expect(countRelevant('  \n\t ')).toBe(0)
  })
})

describe('cjkRatio', () => {
  it('纯中文比例为 1', () => {
    expect(cjkRatio('你好世界')).toBe(1)
  })
  it('中英混合按占比计算', () => {
    expect(cjkRatio('你好 world')).toBeCloseTo(2 / 3, 5)
  })
  it('纯英文为 0', () => {
    expect(cjkRatio('hello world')).toBe(0)
  })
  it('纯代码为 0', () => {
    expect(cjkRatio('const x = foo(1)')).toBe(0)
  })
  it('无可判定字符返回 null（不抛错）', () => {
    expect(cjkRatio('')).toBeNull()
    expect(cjkRatio('   ')).toBeNull()
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run tests/language.spec.ts`
Expected: FAIL —— `Cannot find module '../src/language.js'`（或 import 解析错误）

- [ ] **Step 3: 创建 `src/language.ts`**

```ts
/**
 * 零依赖 CJK 语言检测纯函数。
 * 设计：只做字符统计，不做分词、不做语义判断；调用方决定阈值语义。
 */

/** 汉字：扩展A区、基本区、兼容区（按 DSH 生态惯例不含日文假名）。 */
const CJK_HAN_RE = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/

/** 中文内容常见全角/中文标点：全角 ASCII、CJK 符号区、中文引号与破折号。 */
const CJK_PUNCT_RE = /[\u3000-\u303F\uFF01-\uFF0F\uFF1A-\uFF20\uFF3B-\uFF40\uFF5B-\uFF65\u2014\u2018\u2019\u201C\u201D\u2026]/

const WHITESPACE_RE = /\s/

/** 统计文本中的 CJK 字符数（汉字 + 中文标点）。 */
export function countCjk(text: string): number {
  let count = 0
  for (const char of text) {
    if (CJK_HAN_RE.test(char) || CJK_PUNCT_RE.test(char)) count += 1
  }
  return count
}

/** 统计非空白字符总数（可作为「有效文本」长度）。 */
export function countRelevant(text: string): number {
  let count = 0
  for (const char of text) {
    if (!WHITESPACE_RE.test(char)) count += 1
  }
  return count
}

/**
 * 有效文本中的 CJK 占比；无可判定字符时返回 `null`（无法判定，调用方不应告警）。
 * @param text - 待检测文本
 */
export function cjkRatio(text: string): number | null {
  const relevant = countRelevant(text)
  if (relevant === 0) return null
  return countCjk(text) / relevant
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run tests/language.spec.ts`
Expected: PASS（11 个用例）

- [ ] **Step 5: 提交**

```bash
git add package.json tsconfig.json src/language.ts tests/language.spec.ts
git commit -m "feat: 脚手架与零依赖 CJK 语言检测纯函数"
```

---

### Task 2: 配置归一化 `config.ts`

**Files:**
- Create: `src/config.ts`
- Create: `tests/config.spec.ts`

**Interfaces:**
- Consumes: 无
- Produces（供 Task 3/4/5 使用）:
  - `interface Config { injectPrompt: boolean; injectionText: string; verifyResponse: boolean; cjkRatioThreshold: number; remindInSession: boolean }`
  - `DEFAULT_INJECTION_TEXT: string` —— 内置中文指令全文
  - `DEFAULT_CONFIG: Config`
  - `resolveConfig(input?: Partial<Config>): Config` —— 合并默认值；`cjkRatioThreshold` 非 `[0,1]` 有限数抛 `TypeError`；`injectionText` 空白时回退默认

- [ ] **Step 1: 写失败测试 `tests/config.spec.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, DEFAULT_INJECTION_TEXT, resolveConfig } from '../src/config.js'

describe('resolveConfig', () => {
  it('无输入时返回全部默认值', () => {
    expect(resolveConfig()).toEqual(DEFAULT_CONFIG)
  })
  it('合并部分覆盖', () => {
    const resolved = resolveConfig({ cjkRatioThreshold: 0.3 })
    expect(resolved.cjkRatioThreshold).toBe(0.3)
    expect(resolved.injectPrompt).toBe(true) // 未覆盖项保留默认
  })
  it('空白 injectionText 回退为默认指令', () => {
    expect(resolveConfig({ injectionText: '   ' }).injectionText).toBe(DEFAULT_INJECTION_TEXT)
  })
  it('阈值超出 [0,1] 抛 TypeError', () => {
    expect(() => resolveConfig({ cjkRatioThreshold: 1.5 })).toThrow(TypeError)
    expect(() => resolveConfig({ cjkRatioThreshold: -0.1 })).toThrow(TypeError)
    expect(() => resolveConfig({ cjkRatioThreshold: Number.NaN })).toThrow(TypeError)
  })
  it('默认指令同时约束回答与思考', () => {
    expect(DEFAULT_INJECTION_TEXT).toContain('回答')
    expect(DEFAULT_INJECTION_TEXT).toContain('思考')
    expect(DEFAULT_INJECTION_TEXT).toContain('简体中文')
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run tests/config.spec.ts`
Expected: FAIL —— `Cannot find module '../src/config.js'`

- [ ] **Step 3: 创建 `src/config.ts`**

```ts
/**
 * dsh-think-zh 配置归一化：合并默认值 + 校验，零依赖。
 */

export interface Config {
  /** 是否向每次请求的 system prompt 注入中文语言指令。 */
  injectPrompt: boolean
  /** 注入的指令文本；空白时回退到 DEFAULT_INJECTION_TEXT。 */
  injectionText: string
  /** 是否开启响应语言校验。 */
  verifyResponse: boolean
  /** 有效文本中 CJK 占比阈值；低于此值判定为非中文。 */
  cjkRatioThreshold: number
  /** 检测到非中文时是否向会话追加一条中文提醒消息（默认只告警，不干扰对话）。 */
  remindInSession: boolean
}

export const DEFAULT_INJECTION_TEXT = `语言要求（强制）：
- 你的回答（content）必须使用简体中文书写，除非用户明确要求使用其他语言。
- 你的思考过程（reasoning/thinking）也必须使用简体中文。
- 代码标识符、命令、文件名等专业术语保持原文，但注释、日志、提交信息与说明文字一律使用简体中文。`

export const DEFAULT_CONFIG: Config = {
  injectPrompt: true,
  injectionText: DEFAULT_INJECTION_TEXT,
  verifyResponse: true,
  cjkRatioThreshold: 0.5,
  remindInSession: false,
}

/** 合并默认值并校验；非法阈值抛 TypeError，空白指令回退默认。 */
export function resolveConfig(input?: Partial<Config>): Config {
  const merged: Config = { ...DEFAULT_CONFIG, ...input }
  const { cjkRatioThreshold } = merged
  if (typeof cjkRatioThreshold !== 'number'
    || !Number.isFinite(cjkRatioThreshold)
    || cjkRatioThreshold < 0
    || cjkRatioThreshold > 1) {
    throw new TypeError(`dsh-think-zh: cjkRatioThreshold 必须是 [0,1] 内的有限数，收到 ${String(cjkRatioThreshold)}`)
  }
  if (merged.injectionText.trim().length === 0) {
    merged.injectionText = DEFAULT_INJECTION_TEXT
  }
  return merged
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run tests/config.spec.ts`
Expected: PASS（5 个用例）

- [ ] **Step 5: 提交**

```bash
git add src/config.ts tests/config.spec.ts
git commit -m "feat: 配置归一化 resolveConfig 与内置中文指令"
```

---

### Task 3: 注入器 `injector.ts` + 最小上下文类型 `types.ts`

**Files:**
- Create: `src/types.ts`
- Create: `src/injector.ts`
- Create: `tests/helpers.ts`
- Create: `tests/injector.spec.ts`

**Interfaces:**
- Consumes: 无（类型为本 Task 定义）
- Produces:
  - `src/types.ts`:
    - `interface SessionLike { readonly id: string; append(type: string, data: unknown, opts?: unknown): void }`
    - `interface SessionEventLike { type: string; seq: number; data: any }`
    - `interface MinimalContext { on(event: string, handler: (session: SessionLike, event: SessionEventLike) => void): () => void; systemPrompt: { section(section: { name: string; order: number; text: string }): () => void }; logger: { warn(...args: unknown[]): void } }`
  - `src/injector.ts`:
    - `PROMPT_SECTION_NAME = 'dsh-think-zh/language'`
    - `PROMPT_SECTION_ORDER = 2`
    - `registerLanguageInjection(ctx: MinimalContext, text: string): () => void` —— 注册 section；失败记 warn 并返回空 disposer（降级不注入）
  - `tests/helpers.ts`:
    - `createMockContext(): MockContext` —— 含 `on`/`systemPrompt.section`/`logger` 及测试可用的 `emit(event, session?)`、`handlers`、`spies`

- [ ] **Step 1: 写失败测试 `tests/injector.spec.ts`**

```ts
import { describe, expect, it, vi } from 'vitest'
import { PROMPT_SECTION_NAME, PROMPT_SECTION_ORDER, registerLanguageInjection } from '../src/injector.js'
import { createMockContext } from './helpers.js'

describe('registerLanguageInjection', () => {
  it('以固定 name/order/文本注册 system prompt section', () => {
    const ctx = createMockContext()
    registerLanguageInjection(ctx, '请用中文')
    expect(ctx.systemPrompt.section).toHaveBeenCalledWith({
      name: PROMPT_SECTION_NAME,
      order: PROMPT_SECTION_ORDER,
      text: '请用中文',
    })
  })
  it('注册失败时记 warn 并降级为不注入（不抛出）', () => {
    const ctx = createMockContext()
    ctx.systemPrompt.section.mockImplementation(() => { throw new Error('duplicate section') })
    expect(() => registerLanguageInjection(ctx, '请用中文')).not.toThrow()
    expect(ctx.logger.warn).toHaveBeenCalled()
  })
  it('返回 section 注册的 disposer', () => {
    const ctx = createMockContext()
    const disposer = vi.fn()
    ctx.systemPrompt.section.mockReturnValue(disposer)
    expect(registerLanguageInjection(ctx, '请用中文')).toBe(disposer)
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run tests/injector.spec.ts`
Expected: FAIL —— `Cannot find module '../src/injector.js'`

- [ ] **Step 3: 创建 `src/types.ts`、`src/injector.ts`、`tests/helpers.ts`**

`src/types.ts`：

```ts
/**
 * dsh-think-zh 使用的最小宿主接口。
 * 只声明本插件实际调用的形状，避免引入 DSH 子包作为构建依赖（零 runtime 依赖）。
 */

export interface SessionLike {
  readonly id: string
  append(type: string, data: unknown, opts?: unknown): void
}

export interface SessionEventLike {
  type: string
  seq: number
  data: any
}

export interface MinimalContext {
  on(event: string, handler: (session: SessionLike, event: SessionEventLike) => void): () => void
  systemPrompt: {
    section(section: { name: string; order: number; text: string }): () => void
  }
  logger: {
    warn(...args: unknown[]): void
  }
}
```

`src/injector.ts`：

```ts
import type { MinimalContext } from './types.js'

export const PROMPT_SECTION_NAME = 'dsh-think-zh/language'
/** persona 为 0，工具声明 100-199；取 2 保证在 persona 之后、工具之前。 */
export const PROMPT_SECTION_ORDER = 2

/**
 * 向 host 的 systemPrompt 服务注册中文指令 section。
 * 注册失败记 warn 并降级为不注入，绝不抛出（防御式）。
 * @returns 注册的 disposer（失败时为空函数）。
 */
export function registerLanguageInjection(ctx: MinimalContext, text: string): () => void {
  try {
    return ctx.systemPrompt.section({
      name: PROMPT_SECTION_NAME,
      order: PROMPT_SECTION_ORDER,
      text,
    })
  } catch (error: unknown) {
    ctx.logger.warn(`dsh-think-zh: 注册 system prompt section 失败，降级为不注入: ${String(error)}`)
    return () => {}
  }
}
```

`tests/helpers.ts`：

```ts
import { vi } from 'vitest'
import type { MinimalContext, SessionEventLike, SessionLike } from '../src/types.js'

export interface MockContext extends MinimalContext {
  handlers: Record<string, Array<(session: SessionLike, event: SessionEventLike) => void>>
  systemPrompt: { section: ReturnType<typeof vi.fn> }
  logger: { warn: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> }
  /** 向某事件名的所有 handler 派发一次事件。 */
  emit(eventName: string, session: SessionLike, event: SessionEventLike): void
}

export function createMockContext(): MockContext {
  const handlers: MockContext['handlers'] = {}
  const ctx = {
    handlers,
    on: (eventName: string, handler: (session: SessionLike, event: SessionEventLike) => void) => {
      ;(handlers[eventName] ??= []).push(handler)
      return () => {
        handlers[eventName] = handlers[eventName].filter((h) => h !== handler)
      }
    },
    systemPrompt: { section: vi.fn(() => vi.fn()) },
    logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
    emit(eventName: string, session: SessionLike, event: SessionEventLike) {
      for (const handler of handlers[eventName] ?? []) handler(session, event)
    },
  }
  return ctx as MockContext
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run tests/injector.spec.ts`
Expected: PASS（3 个用例）

- [ ] **Step 5: 提交**

```bash
git add src/types.ts src/injector.ts tests/helpers.ts tests/injector.spec.ts
git commit -m "feat: system prompt 中文指令注入器"
```

---

### Task 4: 校验器 `verifier.ts`

**Files:**
- Create: `src/verifier.ts`
- Create: `tests/verifier.spec.ts`

**Interfaces:**
- Consumes: `src/types.ts`（`MinimalContext`/`SessionLike`/`SessionEventLike`）、`src/language.ts`（`cjkRatio`）
- Produces:
  - `REMINDER_MESSAGE = '（自动提醒）请使用简体中文回复；你的回答与思考过程请使用简体中文。继续当前任务。'`
  - `interface TurnAssessment { reasoningRatio: number | null; textRatio: number | null; reasoningNonZh: boolean; textNonZh: boolean }`
  - `assessTurn(reasoning: string, text: string, threshold: number): TurnAssessment` —— 纯函数；`null` 比例不判为非中文
  - `installVerifier(ctx: MinimalContext, config: { cjkRatioThreshold: number; remindInSession: boolean }): () => void` —— 挂 `session/event` 监听，返回 disposer

**事件契约**（来自 DSH 源码，实现按此处理）：
- `session/event` 回调签名 `(session, event)`，`event = { type, seq, data }`
- `assistant/chunk`：`event.data = { turn, step, chunk }`；`chunk.type` 为 `'reasoning-delta'`/`'text-delta'` 时 `chunk.text` 为增量文本
- `turn/end`：`event.data = { turn, reason }`；触发判定并清理该 session 的缓冲
- 追加提醒：`session.append('user/message', { role: 'user', content: [{ type: 'text', text: REMINDER_MESSAGE }] }, { surfaceOp: 'append' })`

- [ ] **Step 1: 写失败测试 `tests/verifier.spec.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { assessTurn, installVerifier, REMINDER_MESSAGE } from '../src/verifier.js'
import { createMockContext } from './helpers.js'
import type { SessionEventLike, SessionLike } from '../src/types.js'

function chunkEvent(chunk: { type: string; text?: string }): SessionEventLike {
  return { type: 'assistant/chunk', seq: 0, data: { turn: 1, step: 1, chunk } }
}
function turnEndEvent(): SessionEventLike {
  return { type: 'turn/end', seq: 1, data: { turn: 1, reason: { kind: 'completed' } } }
}
function makeSession(id: string): SessionLike {
  return {
    id,
    append: (...args: unknown[]) => { /* record via spy in tests */ },
  }
}

describe('assessTurn', () => {
  it('中文回答与思考不触发', () => {
    const a = assessTurn('我需要分析问题', '已经完成了', 0.5)
    expect(a.reasoningNonZh).toBe(false)
    expect(a.textNonZh).toBe(false)
  })
  it('纯英文回答触发 text 告警', () => {
    const a = assessTurn('I need to analyze', 'All done now', 0.5)
    expect(a.textNonZh).toBe(true)
    expect(a.reasoningNonZh).toBe(true)
  })
  it('无法判定的比例（null）不触发告警', () => {
    const a = assessTurn('', '', 0.5)
    expect(a.reasoningRatio).toBeNull()
    expect(a.textRatio).toBeNull()
    expect(a.reasoningNonZh).toBe(false)
    expect(a.textNonZh).toBe(false)
  })
  it('代码为主的回答按阈值判定', () => {
    const a = assessTurn('', 'const x = 1', 0.5)
    expect(a.textNonZh).toBe(true)
  })
})

describe('installVerifier', () => {
  it('聚合 text-delta 与 reasoning-delta 并在 turn/end 告警', () => {
    const ctx = createMockContext()
    const warn = ctx.logger.warn
    installVerifier(ctx, { cjkRatioThreshold: 0.5, remindInSession: false })
    const session = makeSession('s1')
    ctx.emit('session/event', session, chunkEvent({ type: 'reasoning-delta', text: 'I think in English' }))
    ctx.emit('session/event', session, chunkEvent({ type: 'text-delta', text: 'Hello there' }))
    ctx.emit('session/event', session, turnEndEvent())
    expect(warn).toHaveBeenCalledTimes(2)
    expect(warn.mock.calls[0][0]).toContain('reasoning')
    expect(warn.mock.calls[1][0]).toContain('text')
  })
  it('中文响应不告警', () => {
    const ctx = createMockContext()
    const warn = ctx.logger.warn
    installVerifier(ctx, { cjkRatioThreshold: 0.5, remindInSession: false })
    const session = makeSession('s1')
    ctx.emit('session/event', session, chunkEvent({ type: 'reasoning-delta', text: '我正在思考' }))
    ctx.emit('session/event', session, chunkEvent({ type: 'text-delta', text: '好的，已完成' }))
    ctx.emit('session/event', session, turnEndEvent())
    expect(warn).not.toHaveBeenCalled()
  })
  it('remindInSession 开启时向会话追加中文提醒 user 消息', () => {
    const ctx = createMockContext()
    const appended: unknown[] = []
    const session: SessionLike = {
      id: 's1',
      append: (...args: unknown[]) => { appended.push(args) },
    }
    installVerifier(ctx, { cjkRatioThreshold: 0.5, remindInSession: true })
    ctx.emit('session/event', session, chunkEvent({ type: 'text-delta', text: 'English only' }))
    ctx.emit('session/event', session, turnEndEvent())
    expect(appended).toHaveLength(1)
    const [type, data, opts] = appended[0] as [string, { role: string; content: Array<{ type: string; text: string }> }, { surfaceOp: string }]
    expect(type).toBe('user/message')
    expect(data.role).toBe('user')
    expect(data.content[0].text).toBe(REMINDER_MESSAGE)
    expect(opts.surfaceOp).toBe('append')
  })
  it('事件处理异常被捕获，不抛出', () => {
    const ctx = createMockContext()
    installVerifier(ctx, { cjkRatioThreshold: 0.5, remindInSession: false })
    // 异常数据：chunk 为 null，handler 必须自行防御
    const session = makeSession('s1')
    expect(() => {
      ctx.emit('session/event', session, { type: 'assistant/chunk', seq: 0, data: { turn: 1, step: 1, chunk: null } })
      ctx.emit('session/event', session, turnEndEvent())
    }).not.toThrow()
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run tests/verifier.spec.ts`
Expected: FAIL —— `Cannot find module '../src/verifier.js'`

- [ ] **Step 3: 创建 `src/verifier.ts`**

```ts
import { cjkRatio } from './language.js'
import type { MinimalContext, SessionEventLike, SessionLike } from './types.js'

export const REMINDER_MESSAGE = '（自动提醒）请使用简体中文回复；你的回答与思考过程请使用简体中文。继续当前任务。'

export interface TurnAssessment {
  reasoningRatio: number | null
  textRatio: number | null
  reasoningNonZh: boolean
  textNonZh: boolean
}

/**
 * 纯函数：对一个回合的思考/回答文本做语言判定。
 * `cjkRatio` 为 `null`（无可判定字符）时对应项不判为非中文。
 */
export function assessTurn(reasoning: string, text: string, threshold: number): TurnAssessment {
  const reasoningRatio = cjkRatio(reasoning)
  const textRatio = cjkRatio(text)
  return {
    reasoningRatio,
    textRatio,
    reasoningNonZh: reasoningRatio !== null && reasoningRatio < threshold,
    textNonZh: textRatio !== null && textRatio < threshold,
  }
}

interface VerifierConfig {
  cjkRatioThreshold: number
  remindInSession: boolean
}

interface TurnBuffer {
  reasoning: string
  text: string
}

/**
 * 挂载响应校验器：监听 `session/event`，按会话缓冲 `assistant/chunk`，
 * `turn/end` 时判定并告警（可选向会话追加中文提醒）。只读，异常只记日志。
 * @returns 卸载监听与清理缓冲的 disposer。
 */
export function installVerifier(ctx: MinimalContext, config: VerifierConfig): () => void {
  const buffers = new Map<string, TurnBuffer>()

  function appendDelta(session: SessionLike, event: SessionEventLike): void {
    const data = event.data as { chunk?: { type?: string; text?: string } } | null | undefined
    const chunk = data?.chunk
    if (chunk === undefined || chunk === null || typeof chunk !== 'object') return
    if (chunk.type !== 'reasoning-delta' && chunk.type !== 'text-delta') return
    if (typeof chunk.text !== 'string') return
    const buffer = buffers.get(session.id) ?? { reasoning: '', text: '' }
    if (chunk.type === 'reasoning-delta') buffer.reasoning += chunk.text
    else buffer.text += chunk.text
    buffers.set(session.id, buffer)
  }

  function finalizeTurn(session: SessionLike): void {
    const buffer = buffers.get(session.id)
    if (buffer === undefined) return
    buffers.delete(session.id)
    const assessment = assessTurn(buffer.reasoning, buffer.text, config.cjkRatioThreshold)
    if (assessment.reasoningNonZh) {
      ctx.logger.warn(
        `dsh-think-zh: 会话 ${session.id} 的 reasoning（思考）疑似非中文（CJK 占比 ${String(assessment.reasoningRatio)} < ${String(config.cjkRatioThreshold)}）`,
      )
    }
    if (assessment.textNonZh) {
      ctx.logger.warn(
        `dsh-think-zh: 会话 ${session.id} 的 text（回答）疑似非中文（CJK 占比 ${String(assessment.textRatio)} < ${String(config.cjkRatioThreshold)}）`,
      )
    }
    if ((assessment.reasoningNonZh || assessment.textNonZh) && config.remindInSession) {
      try {
        session.append(
          'user/message',
          { role: 'user', content: [{ type: 'text', text: REMINDER_MESSAGE }] },
          { surfaceOp: 'append' },
        )
      } catch (error: unknown) {
        ctx.logger.warn(`dsh-think-zh: 追加中文提醒失败: ${String(error)}`)
      }
    }
  }

  const disposer = ctx.on('session/event', (session: SessionLike, event: SessionEventLike) => {
    try {
      if (event.type === 'assistant/chunk') appendDelta(session, event)
      else if (event.type === 'turn/end') finalizeTurn(session)
    } catch (error: unknown) {
      ctx.logger.warn(`dsh-think-zh: 校验器处理事件异常: ${String(error)}`)
    }
  })

  return () => {
    disposer()
    buffers.clear()
  }
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run tests/verifier.spec.ts`
Expected: PASS（6 个用例）

- [ ] **Step 5: 提交**

```bash
git add src/verifier.ts tests/verifier.spec.ts
git commit -m "feat: 响应语言校验器（聚合 chunk、回合判定、告警与提醒）"
```

---

### Task 5: 插件入口 `index.ts` + `cordis.patch.yml` + 构建

**Files:**
- Create: `src/index.ts`
- Create: `cordis.patch.yml`
- Create: `tests/index.spec.ts`

**Interfaces:**
- Consumes: `resolveConfig`（Task 2）、`registerLanguageInjection`（Task 3）、`installVerifier`（Task 4）
- Produces: Cordis 插件入口
  - `export const name = 'dsh-think-zh'`
  - `export function apply(ctx: MinimalContext, config?: Partial<Config>): void`
  - `cordis.patch.yml`：`- insert:` 一行 `{ id: dsh-think-zh, name: 'dsh-think-zh', config: {} }`

- [ ] **Step 1: 写失败测试 `tests/index.spec.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { apply, name } from '../src/index.js'
import { DEFAULT_INJECTION_TEXT } from '../src/config.js'
import { PROMPT_SECTION_NAME, PROMPT_SECTION_ORDER } from '../src/injector.js'
import { createMockContext } from './helpers.js'

describe('apply', () => {
  it('导出固定插件名', () => {
    expect(name).toBe('dsh-think-zh')
  })
  it('默认配置：注入 + 校验均挂载', () => {
    const ctx = createMockContext()
    apply(ctx)
    expect(ctx.systemPrompt.section).toHaveBeenCalledWith({
      name: PROMPT_SECTION_NAME,
      order: PROMPT_SECTION_ORDER,
      text: DEFAULT_INJECTION_TEXT,
    })
    expect(ctx.handlers['session/event']).toHaveLength(1)
  })
  it('injectPrompt=false 时不注册 section', () => {
    const ctx = createMockContext()
    apply(ctx, { injectPrompt: false })
    expect(ctx.systemPrompt.section).not.toHaveBeenCalled()
    expect(ctx.handlers['session/event']).toHaveLength(1)
  })
  it('verifyResponse=false 时不挂监听', () => {
    const ctx = createMockContext()
    apply(ctx, { verifyResponse: false })
    expect(ctx.handlers['session/event']).toBeUndefined()
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run tests/index.spec.ts`
Expected: FAIL —— `Cannot find module '../src/index.js'`

- [ ] **Step 3: 创建 `src/index.ts` 与 `cordis.patch.yml`**

`src/index.ts`：

```ts
import { resolveConfig, type Config } from './config.js'
import { registerLanguageInjection } from './injector.js'
import type { MinimalContext } from './types.js'
import { installVerifier } from './verifier.js'

export const name = 'dsh-think-zh'

/** 插件入口：按配置挂载注入器与校验器。 */
export function apply(ctx: MinimalContext, config?: Partial<Config>): void {
  const resolved = resolveConfig(config)
  if (resolved.injectPrompt) {
    registerLanguageInjection(ctx, resolved.injectionText)
  }
  if (resolved.verifyResponse) {
    installVerifier(ctx, {
      cjkRatioThreshold: resolved.cjkRatioThreshold,
      remindInSession: resolved.remindInSession,
    })
  }
}
```

`cordis.patch.yml`：

```yaml
# dsh-think-zh bundle patch：向 profile 插入插件配置项。
# 安装方式见 README.zh.md（dsh plugin --profile web add <本目录>）。
- insert:
    - id: dsh-think-zh
      name: 'dsh-think-zh'
      config: {}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run tests/index.spec.ts`
Expected: PASS（4 个用例）

- [ ] **Step 5: 构建并验证产物**

Run: `npm install && npm run build`
Expected: `lib/index.js`、`lib/index.d.ts`、`lib/config.js`、`lib/injector.js`、`lib/verifier.js`、`lib/language.js` 等生成；`node lib/index.js` 不可直接运行（无 main 自执行），改为验证：`node -e "import('./lib/index.js').then(m => console.log(m.name))"` 输出 `dsh-think-zh`

- [ ] **Step 6: 全量测试**

Run: `npx vitest run`
Expected: PASS（33 个用例：13 + 5 + 3 + 8 + 4）

- [ ] **Step 7: 提交**

```bash
git add src/index.ts cordis.patch.yml tests/index.spec.ts package-lock.json
git commit -m "feat: 插件入口 apply 与 cordis.patch.yml，完成可构建交付"
```

---

### Task 6: 安装与使用文档 `README.zh.md`

**Files:**
- Create: `README.zh.md`

**Interfaces:**
- Consumes: 无（纯文档）

- [ ] **Step 1: 创建 `README.zh.md`**

````markdown
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
````

- [ ] **Step 2: 提交**

```bash
git add README.zh.md
git commit -m "docs: 安装/验证/配置/工作原理文档"
```

---

## 自审记录（writing-plans 内建）

- **规格覆盖**：注入（Task 3/5）、校验（Task 4）、配置全部键（Task 2）、错误处理（Task 3 降级、Task 4 try/catch）、测试四项（Task 1/2/4/5 对应 language/config/verifier/index）、文档含限制声明（Task 6）、git 仓库（已完成初始化）、零依赖（Task 1 起全程）、回答与思考分别判定（Task 4）——均有一一对应任务。
- **占位符扫描**：所有步骤含完整代码与预期输出，无 TBD/TODO/「类似 Task N」。
- **类型一致性**：`resolveConfig`/`Config`（Task 2）→ `apply`（Task 5）；`MinimalContext`/`SessionLike`/`SessionEventLike`（Task 3）→ `injector`/`verifier`/`index`；`cjkRatio`（Task 1）→ `assessTurn`（Task 4）；`PROMPT_SECTION_NAME`/`PROMPT_SECTION_ORDER`（Task 3）→ `index.spec`（Task 5）与 README（Task 6）。命名全程一致。

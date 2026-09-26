import { describe, expect, it } from 'vitest'
import { PRETURN_MARK, registerPerTurnNudge } from '../src/preturn.js'
import { DEFAULT_INJECTION_TEXT } from '../src/config.js'
import type { PreStepDecisionLike } from '../src/types.js'
import { createMockContext, type MockContext } from './helpers.js'

/** 取出 registerPerTurnNudge 注册的 handler（断言注册形状后再调用）。 */
function captureHandler(ctx: MockContext): (payload: unknown, next: () => Promise<PreStepDecisionLike>) => Promise<PreStepDecisionLike> {
  expect(ctx.on).toHaveBeenCalledTimes(1)
  expect(ctx.on).toHaveBeenCalledWith('agent/pre-step', expect.any(Function), { prepend: true })
  return (ctx.on.mock.calls[0] as unknown[])[1] as never
}

const TEXT = '语言要求（强制）：思考必须使用简体中文。'

describe('registerPerTurnNudge', () => {
  it('ctx.on 缺失时降级：error 日志、不抛错', () => {
    const ctx = createMockContext()
    delete (ctx as { on?: unknown }).on
    expect(() => registerPerTurnNudge(ctx, TEXT)).not.toThrow()
    expect(ctx.logger.error).toHaveBeenCalled()
  })

  it('handler：给首条用户消息文本块前置指令（含幂等标记）', async () => {
    const ctx = createMockContext()
    registerPerTurnNudge(ctx, TEXT)
    const handler = captureHandler(ctx)
    const decision: PreStepDecisionLike = {
      kind: 'enter',
      messages: [
        { id: 'm1', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: '你好' }] },
      ],
    }
    const out = await handler({}, async () => decision)
    const block = out.messages?.[0]?.content?.[0]
    expect(block?.text).toBe(`[${PRETURN_MARK}] ${TEXT}\n\n你好`)
  })

  it('handler：只注入首条用户消息的首个文本块', async () => {
    const ctx = createMockContext()
    registerPerTurnNudge(ctx, TEXT)
    const handler = captureHandler(ctx)
    const decision: PreStepDecisionLike = {
      kind: 'enter',
      messages: [
        { id: 'm1', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] },
        { id: 'm2', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'c' }] },
      ],
    }
    const out = await handler({}, async () => decision)
    const b0 = out.messages?.[0]?.content?.[0]
    const b1 = out.messages?.[0]?.content?.[1]
    const b2 = out.messages?.[1]?.content?.[0]
    expect(b0?.text).toContain(PRETURN_MARK)
    expect(b1?.text).toBe('b')
    expect(b2?.text).toBe('c')
  })

  it('handler：幂等——已带标记的消息不再注入', async () => {
    const ctx = createMockContext()
    registerPerTurnNudge(ctx, TEXT)
    const handler = captureHandler(ctx)
    const once = `[${PRETURN_MARK}] ${TEXT}\n\n你好`
    const decision: PreStepDecisionLike = {
      kind: 'enter',
      messages: [{ id: 'm1', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: once }] }],
    }
    const out = await handler({}, async () => decision)
    expect(out.messages?.[0]?.content?.[0]?.text).toBe(once)
  })

  it('handler：非用户消息不注入', async () => {
    const ctx = createMockContext()
    registerPerTurnNudge(ctx, TEXT)
    const handler = captureHandler(ctx)
    const decision: PreStepDecisionLike = {
      kind: 'enter',
      messages: [
        { id: 's1', role: 'system', source: { kind: 'plugin' }, content: [{ type: 'text', text: 'reminder' }] },
      ],
    }
    const out = await handler({}, async () => decision)
    expect(out.messages?.[0]?.content?.[0]?.text).toBe('reminder')
  })

  it('handler：aborted 信号直接透传，不改决策', async () => {
    const ctx = createMockContext()
    registerPerTurnNudge(ctx, TEXT)
    const handler = captureHandler(ctx)
    const decision: PreStepDecisionLike = {
      kind: 'enter',
      messages: [{ id: 'm1', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: '你好' }] }],
    }
    const out = await handler({ signal: { aborted: true } }, async () => decision)
    expect(out).toBe(decision)
  })

  it('handler：kind 非 enter 直接透传', async () => {
    const ctx = createMockContext()
    registerPerTurnNudge(ctx, TEXT)
    const handler = captureHandler(ctx)
    const decision: PreStepDecisionLike = { kind: 'block' }
    const out = await handler({}, async () => decision)
    expect(out).toBe(decision)
  })

  it('自定义 injectionText 生效（DEFAULT 之外）', async () => {
    const ctx = createMockContext()
    registerPerTurnNudge(ctx, DEFAULT_INJECTION_TEXT)
    const handler = captureHandler(ctx)
    const decision: PreStepDecisionLike = {
      kind: 'enter',
      messages: [{ id: 'm1', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'x' }] }],
    }
    const out = await handler({}, async () => decision)
    expect(out.messages?.[0]?.content?.[0]?.text).toContain(DEFAULT_INJECTION_TEXT)
  })

  it('配置守卫：injectPerTurn 非布尔回退默认 false', async () => {
    const { resolveConfig } = await import('../src/config.js')
    expect(resolveConfig({ injectPerTurn: null as never }).injectPerTurn).toBe(false)
    expect(resolveConfig({ injectPerTurn: true }).injectPerTurn).toBe(true)
  })
})

import { describe, expect, it, vi } from 'vitest'
import { PRETURN_MARK, registerPerTurnNudge } from '../src/preturn.js'
import { DEFAULT_INJECTION_TEXT, injectionTextFor } from '../src/config.js'
import type { PreStepDecisionLike } from '../src/types.js'
import { createMockContext, type MockContext } from './helpers.js'

/** 取出 registerPerTurnNudge 注册的 handler（断言注册形状后再调用）。 */
function captureHandler(ctx: MockContext): (payload: unknown, next: () => Promise<PreStepDecisionLike>) => Promise<PreStepDecisionLike> {
  expect(ctx.on).toHaveBeenCalledTimes(1)
  expect(ctx.on).toHaveBeenCalledWith('agent/pre-step', expect.any(Function), { prepend: true })
  return (ctx.on.mock.calls[0] as unknown[])[1] as never
}

const TEXT = '语言要求（强制）：思考必须使用简体中文。'

/** 一条最简用户消息决策。 */
function userDecision(text: string): PreStepDecisionLike {
  return {
    kind: 'enter',
    messages: [{ id: 'm1', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text }] }],
  }
}

describe('registerPerTurnNudge', () => {
  it('ctx.on 缺失时降级：error 日志、不抛错', async () => {
    const ctx = createMockContext()
    delete (ctx as { on?: unknown }).on
    expect(() => registerPerTurnNudge(ctx, () => TEXT)).not.toThrow()
    expect(ctx.logger.error).toHaveBeenCalled()
  })

  it('handler：给首条用户消息文本块前置指令（含幂等标记）', async () => {
    const ctx = createMockContext()
    registerPerTurnNudge(ctx, () => TEXT)
    const handler = captureHandler(ctx)
    const out = await handler({}, async () => userDecision('你好'))
    const block = out.messages?.[0]?.content?.[0]
    expect(block?.text).toBe(`[${PRETURN_MARK}] ${TEXT}\n\n你好`)
  })

  it('handler：每轮现读提供者，切换档位后同一 handler 输出新文本', async () => {
    const ctx = createMockContext()
    let current = injectionTextFor('zh')
    registerPerTurnNudge(ctx, () => current)
    const handler = captureHandler(ctx)
    const first = await handler({}, async () => userDecision('你好'))
    expect(first.messages?.[0]?.content?.[0]?.text).toContain(injectionTextFor('zh'))
    current = injectionTextFor('en')
    const second = await handler({}, async () => userDecision('你好'))
    expect(second.messages?.[0]?.content?.[0]?.text).toContain(injectionTextFor('en'))
    expect(second.messages?.[0]?.content?.[0]?.text).not.toContain('思考（reasoning）')
  })

  it('handler：只注入首条用户消息的首个文本块', async () => {
    const ctx = createMockContext()
    registerPerTurnNudge(ctx, () => TEXT)
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

  it('handler：幂等——首条用户消息已带标记时整条决策原样返回', async () => {
    const ctx = createMockContext()
    registerPerTurnNudge(ctx, () => TEXT)
    const handler = captureHandler(ctx)
    const decision = userDecision(`[${PRETURN_MARK}] ${TEXT}\n\n你好`)
    const out = await handler({}, async () => decision)
    expect(out).toBe(decision)
  })

  it('handler：幂等——首块已带标记时不再注入同消息的后续文本块（回归：标记扩散）', async () => {
    const ctx = createMockContext()
    registerPerTurnNudge(ctx, () => TEXT)
    const handler = captureHandler(ctx)
    const decision: PreStepDecisionLike = {
      kind: 'enter',
      messages: [
        {
          id: 'm1',
          role: 'user',
          source: { kind: 'user' },
          content: [
            { type: 'text', text: `[${PRETURN_MARK}] ${TEXT}\n\n你好` },
            { type: 'text', text: 'world' },
          ],
        },
      ],
    }
    const out = await handler({}, async () => decision)
    expect(out).toBe(decision)
    expect(out.messages?.[0]?.content?.[1]?.text).toBe('world')
  })

  it('handler：幂等——首条用户消息已带标记时不顺延到后续用户消息（回归：历史污染）', async () => {
    const ctx = createMockContext()
    registerPerTurnNudge(ctx, () => TEXT)
    const handler = captureHandler(ctx)
    const decision: PreStepDecisionLike = {
      kind: 'enter',
      messages: [
        { id: 'm1', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: `[${PRETURN_MARK}] ${TEXT}\n\n早先的问题` }] },
        { id: 'm2', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: '新一轮的问题' }] },
      ],
    }
    const out = await handler({}, async () => decision)
    expect(out).toBe(decision)
    expect(out.messages?.[1]?.content?.[0]?.text).toBe('新一轮的问题')
  })

  it('handler：首条用户消息无可注入文本块时不向后顺延', async () => {
    const ctx = createMockContext()
    registerPerTurnNudge(ctx, () => TEXT)
    const handler = captureHandler(ctx)
    const decision: PreStepDecisionLike = {
      kind: 'enter',
      messages: [
        { id: 'm1', role: 'user', source: { kind: 'user' }, content: [{ type: 'image' }] },
        { id: 'm2', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: '后一条' }] },
      ],
    }
    const out = await handler({}, async () => decision)
    expect(out).toBe(decision)
  })

  it('handler：非用户消息不注入', async () => {
    const ctx = createMockContext()
    registerPerTurnNudge(ctx, () => TEXT)
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
    registerPerTurnNudge(ctx, () => TEXT)
    const handler = captureHandler(ctx)
    const decision = userDecision('你好')
    const out = await handler({ signal: { aborted: true } }, async () => decision)
    expect(out).toBe(decision)
  })

  it('handler：kind 非 enter 直接透传', async () => {
    const ctx = createMockContext()
    registerPerTurnNudge(ctx, () => TEXT)
    const handler = captureHandler(ctx)
    const decision: PreStepDecisionLike = { kind: 'block' }
    const out = await handler({}, async () => decision)
    expect(out).toBe(decision)
  })

  it('自定义 injectionText 生效（DEFAULT 之外）', async () => {
    const ctx = createMockContext()
    registerPerTurnNudge(ctx, () => DEFAULT_INJECTION_TEXT)
    const handler = captureHandler(ctx)
    const out = await handler({}, async () => userDecision('x'))
    expect(out.messages?.[0]?.content?.[0]?.text).toContain(DEFAULT_INJECTION_TEXT)
  })

  it('配置守卫：injectPerTurn 非布尔回退默认 false', async () => {
    const { resolveConfig } = await import('../src/config.js')
    expect(resolveConfig({ injectPerTurn: null }).injectPerTurn).toBe(false)
    expect(resolveConfig({ injectPerTurn: true }).injectPerTurn).toBe(true)
  })
})

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

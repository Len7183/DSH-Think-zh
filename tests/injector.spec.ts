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

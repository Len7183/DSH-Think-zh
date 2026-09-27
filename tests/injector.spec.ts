import { describe, expect, it, vi } from 'vitest'
import { PROMPT_SECTION_NAME, PROMPT_SECTION_ORDER, registerLanguageInjection } from '../src/injector.js'
import { createMockContext } from './helpers.js'

/** 取出注册时传入的 section spec（断言已注册后使用）。 */
function capturedSpec(ctx: ReturnType<typeof createMockContext>): { name: string; order: number; text: unknown } {
  expect(ctx.systemPrompt.section).toHaveBeenCalledTimes(1)
  return ctx.systemPrompt.section.mock.calls[0][0] as never
}

describe('registerLanguageInjection', () => {
  it('以固定 name/order 与文本提供者注册 system prompt section', () => {
    const ctx = createMockContext()
    registerLanguageInjection(ctx, () => '请用中文')
    expect(ctx.systemPrompt.section).toHaveBeenCalledWith({
      name: PROMPT_SECTION_NAME,
      order: PROMPT_SECTION_ORDER,
      text: expect.any(Function),
    })
  })
  it('注册的是提供者：宿主每次组装现取，设置改完即生效', () => {
    const ctx = createMockContext()
    let current = 'A'
    registerLanguageInjection(ctx, () => current)
    const spec = capturedSpec(ctx)
    expect(spec.text).toBeTypeOf('function')
    expect((spec.text as () => string)()).toBe('A')
    current = 'B'
    expect((spec.text as () => string)()).toBe('B')
  })
  it('systemPrompt 服务缺失时记 error 并降级为不注入（不抛出）', () => {
    const ctx = createMockContext()
    ctx.systemPrompt = { section: undefined as unknown as typeof ctx.systemPrompt.section }
    expect(() => registerLanguageInjection(ctx, () => '请用中文')).not.toThrow()
    expect(ctx.logger.error).toHaveBeenCalled()
    expect(ctx.logger.error.mock.calls[0][0]).toContain('systemPrompt 服务不可用')
  })
  it('注册失败时记 error 并降级为不注入（不抛出）', () => {
    const ctx = createMockContext()
    ctx.systemPrompt.section.mockImplementation(() => { throw new Error('duplicate section') })
    expect(() => registerLanguageInjection(ctx, () => '请用中文')).not.toThrow()
    expect(ctx.logger.error).toHaveBeenCalled()
  })
  it('返回 section 注册的 disposer', () => {
    const ctx = createMockContext()
    const disposer = vi.fn()
    ctx.systemPrompt.section.mockReturnValue(disposer)
    expect(registerLanguageInjection(ctx, () => '请用中文')).toBe(disposer)
  })
})

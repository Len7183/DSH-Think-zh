import { describe, expect, it, vi } from 'vitest'
import {
  PROMPT_SECTION_NAME,
  PROMPT_SECTION_ORDER,
  registerLanguageInjection,
} from '../src/injector.js'
import type { AssembledPromptLike } from '../src/types.js'
import { createMockContext, type MockContext } from './helpers.js'

/** 取出注册时传入的 section spec（断言已注册后使用）。 */
function capturedSpec(ctx: ReturnType<typeof createMockContext>): { name: string; order: number; text: unknown } {
  expect(ctx.systemPrompt.section).toHaveBeenCalledTimes(1)
  return ctx.systemPrompt.section.mock.calls[0][0] as never
}

/** 取出 assemble 置顶兜底处理器。 */
function captureHoist(
  ctx: MockContext,
): (assembly: AssembledPromptLike, context: unknown, next: () => Promise<AssembledPromptLike>) => Promise<AssembledPromptLike> {
  const calls = ctx.on.mock.calls.filter((call) => call[0] === 'system-prompt/assemble')
  expect(calls).toHaveLength(1)
  return calls[0][1] as never
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
  it('order -1000000：小于宿主最小内置段（harness 身份段 -1000），瀑布前排序稳居首位', () => {
    expect(PROMPT_SECTION_ORDER).toBe(-1000000)
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
  it('systemPrompt 服务缺失时记 error 并降级为不注入（不抛出，不注册置顶兜底）', () => {
    const ctx = createMockContext()
    ctx.systemPrompt = { section: undefined as unknown as typeof ctx.systemPrompt.section }
    expect(() => registerLanguageInjection(ctx, () => '请用中文')).not.toThrow()
    expect(ctx.logger.error).toHaveBeenCalled()
    expect(ctx.logger.error.mock.calls[0][0]).toContain('systemPrompt 服务不可用')
    expect(ctx.on).not.toHaveBeenCalled()
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

describe('assemble 置顶兜底', () => {
  it('section 注册成功后注册 system-prompt/assemble 末端重排', () => {
    const ctx = createMockContext()
    registerLanguageInjection(ctx, () => '请用中文')
    expect(ctx.on).toHaveBeenCalledTimes(1)
    expect(ctx.on).toHaveBeenCalledWith('system-prompt/assemble', expect.any(Function))
  })
  it('宿主过老（ctx.on 缺失）时静默跳过：order 已提供置顶保障，不记 error', () => {
    const ctx = createMockContext()
    delete (ctx as { on?: unknown }).on
    expect(() => registerLanguageInjection(ctx, () => '请用中文')).not.toThrow()
    expect(ctx.logger.error).not.toHaveBeenCalled()
    expect(ctx.systemPrompt.section).toHaveBeenCalledTimes(1)
  })
  it('ctx.on 注册抛错时记 error，不影响 section 注册', () => {
    const ctx = createMockContext()
    ctx.on.mockImplementation(() => { throw new Error('waterfall unavailable') })
    expect(() => registerLanguageInjection(ctx, () => '请用中文')).not.toThrow()
    expect(ctx.systemPrompt.section).toHaveBeenCalledTimes(1)
    expect(ctx.logger.error).toHaveBeenCalledWith(expect.stringContaining('置顶兜底失败'))
  })
  it('handler：把本插件 section 重排到首位，其余相对顺序不变', async () => {
    const ctx = createMockContext()
    registerLanguageInjection(ctx, () => '请用中文')
    const hoist = captureHoist(ctx)
    const assembly: AssembledPromptLike = {
      sections: [{ name: 'deployment:persona-prefix' }, { name: PROMPT_SECTION_NAME }, { name: 'harness-identity' }, { name: 'tool:bash' }],
    }
    const out = await hoist(assembly, {}, async () => assembly)
    expect(out.sections?.map((section) => section.name)).toEqual([
      PROMPT_SECTION_NAME,
      'deployment:persona-prefix',
      'harness-identity',
      'tool:bash',
    ])
  })
  it('handler：已在首位时原样透传（幂等，不重排）', async () => {
    const ctx = createMockContext()
    registerLanguageInjection(ctx, () => '请用中文')
    const hoist = captureHoist(ctx)
    const assembly: AssembledPromptLike = { sections: [{ name: PROMPT_SECTION_NAME }, { name: 'deployment:persona-prefix' }] }
    const out = await hoist(assembly, {}, async () => assembly)
    expect(out).toBe(assembly)
  })
  it('handler：sections 中没有本插件 section 时原样透传', async () => {
    const ctx = createMockContext()
    registerLanguageInjection(ctx, () => '请用中文')
    const hoist = captureHoist(ctx)
    const assembly: AssembledPromptLike = { sections: [{ name: 'deployment:persona-prefix' }] }
    const out = await hoist(assembly, {}, async () => assembly)
    expect(out).toBe(assembly)
  })
  it('handler：sections 缺失或非数组时原样透传', async () => {
    const ctx = createMockContext()
    registerLanguageInjection(ctx, () => '请用中文')
    const hoist = captureHoist(ctx)
    const empty = {} as AssembledPromptLike
    expect(await hoist(empty, {}, async () => empty)).toBe(empty)
    const broken = { sections: 'nope' as unknown as AssembledPromptLike['sections'] }
    expect(await hoist(broken, {}, async () => broken)).toBe(broken)
  })
  it('handler：只调整 sections，next 结果的其余字段原样保留', async () => {
    const ctx = createMockContext()
    registerLanguageInjection(ctx, () => '请用中文')
    const hoist = captureHoist(ctx)
    const assembly = {
      sections: [{ name: 'deployment:persona-prefix' }, { name: PROMPT_SECTION_NAME }],
      contexts: [{ name: 'sandbox-policy', text: '...' }],
      tools: [{ name: 'read' }],
    }
    const out = await hoist(assembly, {}, async () => assembly)
    expect(out.sections?.[0]?.name).toBe(PROMPT_SECTION_NAME)
    expect(out.contexts).toBe(assembly.contexts)
    expect(out.tools).toBe(assembly.tools)
  })
  it('handler：重排作用于 next 的下游结果，而非入参 assembly', async () => {
    const ctx = createMockContext()
    registerLanguageInjection(ctx, () => '请用中文')
    const hoist = captureHoist(ctx)
    const input: AssembledPromptLike = { sections: [{ name: PROMPT_SECTION_NAME }, { name: 'deployment:persona-prefix' }] }
    const downstream: AssembledPromptLike = { sections: [{ name: 'injected-by-other' }, { name: PROMPT_SECTION_NAME }] }
    const out = await hoist(input, {}, async () => downstream)
    expect(out.sections?.[0]?.name).toBe(PROMPT_SECTION_NAME)
    expect(out.sections?.map((section) => section.name)).toEqual([PROMPT_SECTION_NAME, 'injected-by-other'])
  })
})

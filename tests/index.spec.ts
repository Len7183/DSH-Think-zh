import { describe, expect, it } from 'vitest'
import { Config as ExportedConfig, apply, inject, name } from '../src/index.js'
import { Config as SourceConfig, DEFAULT_INJECTION_TEXT, injectionTextFor } from '../src/config.js'
import { PROMPT_SECTION_NAME, PROMPT_SECTION_ORDER } from '../src/injector.js'
import { createMockContext } from './helpers.js'

/** 取出 apply 注册的 section spec。 */
function capturedSpec(ctx: ReturnType<typeof createMockContext>): { name: string; order: number; text: () => string } {
  expect(ctx.systemPrompt.section).toHaveBeenCalledTimes(1)
  return ctx.systemPrompt.section.mock.calls[0][0] as never
}

describe('apply', () => {
  it('导出固定插件名', () => {
    expect(name).toBe('dsh-think-zh')
  })
  it('声明 systemPrompt 服务依赖，确保 apply 在服务就绪后执行', () => {
    expect(inject).toEqual(['systemPrompt'])
  })
  it('从包入口导出宿主用的 Config schema（loader 据此把 thinkingLanguage 建为 volatile 字段）', () => {
    expect(ExportedConfig).toBe(SourceConfig)
    const parsed = ExportedConfig({}) as { thinkingLanguage: { get(): string } }
    expect(parsed.thinkingLanguage.get()).toBe('zh')
  })
  it('默认配置：注册注入 section，提供者返回默认指令', () => {
    const ctx = createMockContext()
    apply(ctx)
    const spec = capturedSpec(ctx)
    expect(spec.name).toBe(PROMPT_SECTION_NAME)
    expect(spec.order).toBe(PROMPT_SECTION_ORDER)
    expect(spec.text()).toBe(DEFAULT_INJECTION_TEXT)
  })
  it('thinkingLanguage=en：文本切换为只含回复条款', () => {
    const ctx = createMockContext()
    apply(ctx, { thinkingLanguage: 'en' })
    expect(capturedSpec(ctx).text()).toBe(injectionTextFor('en'))
  })
  it('volatile 引用现读：写入后同一 section 立即反映新档位（不重挂插件）', () => {
    let current = 'zh'
    const ctx = createMockContext()
    apply(ctx, { thinkingLanguage: { get: () => current } })
    const spec = capturedSpec(ctx)
    expect(spec.text()).toBe(injectionTextFor('zh'))
    current = 'en'
    expect(spec.text()).toBe(injectionTextFor('en'))
  })
  it('injectPrompt=false 时不注册 section', () => {
    const ctx = createMockContext()
    apply(ctx, { injectPrompt: false })
    expect(ctx.systemPrompt.section).not.toHaveBeenCalled()
  })
  it('默认配置：不注册 per-turn 注入（静态 section 足够 reasoning 模型）', () => {
    const ctx = createMockContext()
    apply(ctx)
    expect(ctx.on).not.toHaveBeenCalled()
  })
  it('injectPerTurn=true：注册 agent/pre-step 注入（prepend）', () => {
    const ctx = createMockContext()
    apply(ctx, { injectPerTurn: true })
    expect(ctx.on).toHaveBeenCalledTimes(1)
    expect(ctx.on).toHaveBeenCalledWith('agent/pre-step', expect.any(Function), { prepend: true })
  })
})

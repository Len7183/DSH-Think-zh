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
    expect(parsed.thinkingLanguage.get()).toBe('en')
  })
  it('默认配置：注册注入 section，提供者返回默认指令', () => {
    const ctx = createMockContext()
    apply(ctx)
    const spec = capturedSpec(ctx)
    expect(spec.name).toBe(PROMPT_SECTION_NAME)
    expect(spec.order).toBe(PROMPT_SECTION_ORDER)
    expect(spec.text()).toBe(DEFAULT_INJECTION_TEXT)
  })
  it('thinkingLanguage=zh：文本切换为含思考条款的两条指令', () => {
    const ctx = createMockContext()
    apply(ctx, { thinkingLanguage: 'zh' })
    expect(capturedSpec(ctx).text()).toBe(injectionTextFor('zh'))
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
  it('默认配置：注册注入 section 与 assemble 置顶兜底，不注册 per-turn 注入', () => {
    const ctx = createMockContext()
    apply(ctx)
    expect(ctx.systemPrompt.section).toHaveBeenCalledTimes(1)
    expect(ctx.on.mock.calls.map((call) => call[0])).toEqual(['system-prompt/assemble'])
  })
  it('injectPerTurn=true：在置顶兜底之外追加 agent/pre-step 注入（prepend）', () => {
    const ctx = createMockContext()
    apply(ctx, { injectPerTurn: true })
    expect(ctx.on).toHaveBeenCalledTimes(2)
    expect(ctx.on).toHaveBeenCalledWith('agent/pre-step', expect.any(Function), { prepend: true })
    expect(ctx.on).toHaveBeenCalledWith('system-prompt/assemble', expect.any(Function))
  })
  it('injectPerTurn 与 injectPrompt 相互独立：injectPrompt=false 仍可单独启用 per-turn', () => {
    const ctx = createMockContext()
    apply(ctx, { injectPrompt: false, injectPerTurn: true })
    expect(ctx.systemPrompt.section).not.toHaveBeenCalled()
    expect(ctx.on).toHaveBeenCalledTimes(1)
    expect(ctx.on).toHaveBeenCalledWith('agent/pre-step', expect.any(Function), { prepend: true })
  })
})

describe('非法档位告警', () => {
  it('显式非法值回退默认档时 warn 一次，重复出现不再提示', () => {
    const ctx = createMockContext()
    apply(ctx, { thinkingLanguage: 'jp' })
    expect(ctx.logger.warn).toHaveBeenCalledTimes(1)
    expect(String(ctx.logger.warn.mock.calls[0][0])).toContain('jp')
    apply(ctx, { thinkingLanguage: 'jp' })
    expect(ctx.logger.warn).toHaveBeenCalledTimes(1)
  })
  it('不同非法值各自提示一次', () => {
    const ctx = createMockContext()
    apply(ctx, { thinkingLanguage: 'klingon' })
    expect(ctx.logger.warn).toHaveBeenCalledTimes(1)
    expect(String(ctx.logger.warn.mock.calls[0][0])).toContain('klingon')
  })
  it('合法档位、空白值与未设置不告警', () => {
    const ctx = createMockContext()
    apply(ctx, { thinkingLanguage: 'en' })
    apply(ctx, { thinkingLanguage: ' ZH ' })
    apply(ctx, { thinkingLanguage: '   ' })
    apply(ctx)
    expect(ctx.logger.warn).not.toHaveBeenCalled()
  })
  it('volatile 引用现读到非法值同样告警一次', () => {
    const ctx = createMockContext()
    apply(ctx, { thinkingLanguage: { get: () => 'xx' } })
    expect(ctx.logger.warn).toHaveBeenCalledTimes(1)
  })
})

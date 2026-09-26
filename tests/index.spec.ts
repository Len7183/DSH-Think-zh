import { describe, expect, it } from 'vitest'
import { apply, inject, name } from '../src/index.js'
import { DEFAULT_INJECTION_TEXT } from '../src/config.js'
import { PROMPT_SECTION_NAME, PROMPT_SECTION_ORDER } from '../src/injector.js'
import { createMockContext } from './helpers.js'

describe('apply', () => {
  it('导出固定插件名', () => {
    expect(name).toBe('dsh-think-zh')
  })
  it('声明 systemPrompt 服务依赖，确保 apply 在服务就绪后执行', () => {
    expect(inject).toEqual(['systemPrompt'])
  })
  it('默认配置：注册注入 section', () => {
    const ctx = createMockContext()
    apply(ctx)
    expect(ctx.systemPrompt.section).toHaveBeenCalledWith({
      name: PROMPT_SECTION_NAME,
      order: PROMPT_SECTION_ORDER,
      text: DEFAULT_INJECTION_TEXT,
    })
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

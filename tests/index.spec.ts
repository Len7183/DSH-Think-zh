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

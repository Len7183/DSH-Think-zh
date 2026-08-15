import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, DEFAULT_INJECTION_TEXT, resolveConfig } from '../src/config.js'

describe('resolveConfig', () => {
  it('无输入时返回全部默认值', () => {
    expect(resolveConfig()).toEqual(DEFAULT_CONFIG)
  })
  it('合并部分覆盖', () => {
    const resolved = resolveConfig({ cjkRatioThreshold: 0.3 })
    expect(resolved.cjkRatioThreshold).toBe(0.3)
    expect(resolved.injectPrompt).toBe(true) // 未覆盖项保留默认
  })
  it('空白 injectionText 回退为默认指令', () => {
    expect(resolveConfig({ injectionText: '   ' }).injectionText).toBe(DEFAULT_INJECTION_TEXT)
  })
  it('阈值超出 [0,1] 抛 TypeError', () => {
    expect(() => resolveConfig({ cjkRatioThreshold: 1.5 })).toThrow(TypeError)
    expect(() => resolveConfig({ cjkRatioThreshold: -0.1 })).toThrow(TypeError)
    expect(() => resolveConfig({ cjkRatioThreshold: Number.NaN })).toThrow(TypeError)
  })
  it('默认指令同时约束回答与思考', () => {
    expect(DEFAULT_INJECTION_TEXT).toContain('回答')
    expect(DEFAULT_INJECTION_TEXT).toContain('思考')
    expect(DEFAULT_INJECTION_TEXT).toContain('简体中文')
  })
})

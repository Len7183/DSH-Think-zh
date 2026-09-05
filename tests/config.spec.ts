import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, DEFAULT_INJECTION_TEXT, resolveConfig } from '../src/config.js'

describe('resolveConfig', () => {
  it('无输入时返回全部默认值', () => {
    expect(resolveConfig()).toEqual(DEFAULT_CONFIG)
  })
  it('合并部分覆盖，未覆盖项保留默认', () => {
    const resolved = resolveConfig({ injectPrompt: false })
    expect(resolved.injectPrompt).toBe(false)
    expect(resolved.injectionText).toBe(DEFAULT_INJECTION_TEXT)
  })
  it('injectPrompt 为 null/undefined/非布尔时回退默认 true（YAML 空值场景）', () => {
    expect(resolveConfig({ injectPrompt: null as unknown as boolean }).injectPrompt).toBe(true)
    expect(resolveConfig({ injectPrompt: undefined }).injectPrompt).toBe(true)
    expect(resolveConfig({ injectPrompt: 'false' as unknown as boolean }).injectPrompt).toBe(true)
  })
  it('空白 injectionText 回退为默认指令', () => {
    expect(resolveConfig({ injectionText: '   ' }).injectionText).toBe(DEFAULT_INJECTION_TEXT)
  })
  it('injectionText 为 undefined/null/非字符串时不抛错并回退默认', () => {
    expect(resolveConfig({ injectionText: undefined }).injectionText).toBe(DEFAULT_INJECTION_TEXT)
    expect(resolveConfig({ injectionText: null as unknown as string }).injectionText).toBe(DEFAULT_INJECTION_TEXT)
    expect(resolveConfig({ injectionText: 42 as unknown as string }).injectionText).toBe(DEFAULT_INJECTION_TEXT)
  })
  it('自定义 injectionText 去除首尾空白', () => {
    expect(resolveConfig({ injectionText: '  请用中文  ' }).injectionText).toBe('请用中文')
  })
  it('默认指令同时约束思考、回复与保留原文', () => {
    expect(DEFAULT_INJECTION_TEXT).toContain('思考')
    expect(DEFAULT_INJECTION_TEXT).toContain('回复')
    expect(DEFAULT_INJECTION_TEXT).toContain('简体中文')
    expect(DEFAULT_INJECTION_TEXT).toContain('保持原文')
    expect(DEFAULT_INJECTION_TEXT).toContain('必须')
    expect(DEFAULT_INJECTION_TEXT).toContain('提问')
  })
})

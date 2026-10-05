import { describe, expect, it } from 'vitest'
import { readVolatile } from '../src/runtime.js'
import {
  DEFAULT_CONFIG,
  DEFAULT_INJECTION_TEXT,
  DEFAULT_THINKING_LANGUAGE,
  THINKING_LANGUAGES,
  Config,
  injectionTextFor,
  normalizeThinkingLanguage,
  resolveConfig,
} from '../src/config.js'

const ZH_TEXT =
  '语言要求（强制）：\n1. 思考（reasoning）必须使用简体中文。\n2. 回复使用与用户提问相同的语言；无法判断时默认简体中文。代码、标识符、文件路径、命令等保持原文，不翻译。'
const EN_TEXT =
  '语言要求（强制）：\n1. 回复使用与用户提问相同的语言；无法判断时默认简体中文。代码、标识符、文件路径、命令等保持原文，不翻译。'

describe('resolveConfig', () => {
  it('无输入时返回全部默认值', () => {
    expect(resolveConfig()).toEqual(DEFAULT_CONFIG)
  })
  it('合并部分覆盖，未覆盖项保留默认', () => {
    const resolved = resolveConfig({ injectPrompt: false })
    expect(resolved.injectPrompt).toBe(false)
    expect(resolved.injectionText).toBe(DEFAULT_INJECTION_TEXT)
    expect(resolved.thinkingLanguage).toBe(DEFAULT_THINKING_LANGUAGE)
  })
  it('injectPrompt 为 null/undefined/非布尔时回退默认 true（YAML 空值场景）', () => {
    expect(resolveConfig({ injectPrompt: null }).injectPrompt).toBe(true)
    expect(resolveConfig({ injectPrompt: undefined }).injectPrompt).toBe(true)
    expect(resolveConfig({ injectPrompt: 'false' }).injectPrompt).toBe(true)
  })
  it('空白 injectionText 回退为默认指令', () => {
    expect(resolveConfig({ injectionText: '   ' }).injectionText).toBe(DEFAULT_INJECTION_TEXT)
  })
  it('injectionText 为 undefined/null/非字符串时不抛错并回退默认', () => {
    expect(resolveConfig({ injectionText: undefined }).injectionText).toBe(DEFAULT_INJECTION_TEXT)
    expect(resolveConfig({ injectionText: null }).injectionText).toBe(DEFAULT_INJECTION_TEXT)
    expect(resolveConfig({ injectionText: 42 }).injectionText).toBe(DEFAULT_INJECTION_TEXT)
  })
  it('自定义 injectionText 去除首尾空白', () => {
    expect(resolveConfig({ injectionText: '  请用中文  ' }).injectionText).toBe('请用中文')
  })
  it('自定义 injectionText 优先于思考语言档位', () => {
    expect(resolveConfig({ injectionText: '自定义', thinkingLanguage: 'en' }).injectionText).toBe('自定义')
  })
  it('默认指令（默认英文档）只约束回复与保留原文，不含思考条款', () => {
    expect(DEFAULT_INJECTION_TEXT).toContain('回复')
    expect(DEFAULT_INJECTION_TEXT).toContain('保持原文')
    expect(DEFAULT_INJECTION_TEXT).toContain('提问')
    expect(DEFAULT_INJECTION_TEXT).not.toContain('思考')
  })
})

describe('thinkingLanguage', () => {
  it('默认档为 en（1.1.0 起），且档位白名单为 en/zh（默认档在前）', () => {
    expect(DEFAULT_THINKING_LANGUAGE).toBe('en')
    expect(DEFAULT_CONFIG.thinkingLanguage).toBe('en')
    expect([...THINKING_LANGUAGES]).toEqual(['en', 'zh'])
  })
  it('zh 档文本逐字等于两条强制指令', () => {
    expect(injectionTextFor('zh')).toBe(ZH_TEXT)
  })
  it('en 档文本只保留回复条款，重新编号为 1.，且不含思考条款；即默认注入文本', () => {
    expect(injectionTextFor('en')).toBe(EN_TEXT)
    expect(injectionTextFor('en')).not.toContain('思考')
    expect(DEFAULT_INJECTION_TEXT).toBe(EN_TEXT)
  })
  it('无自定义文本时按档位生成', () => {
    expect(resolveConfig({ thinkingLanguage: 'en' }).injectionText).toBe(EN_TEXT)
    expect(resolveConfig({ thinkingLanguage: 'en', injectionText: '   ' }).injectionText).toBe(EN_TEXT)
    expect(resolveConfig({ thinkingLanguage: 'zh' }).injectionText).toBe(ZH_TEXT)
  })
  it('normalizeThinkingLanguage：大小写与首尾空白不敏感，白名单外一律回退默认', () => {
    expect(normalizeThinkingLanguage('zh')).toBe('zh')
    expect(normalizeThinkingLanguage('en')).toBe('en')
    expect(normalizeThinkingLanguage('EN')).toBe('en')
    expect(normalizeThinkingLanguage(' en ')).toBe('en')
    expect(normalizeThinkingLanguage(null)).toBe('en')
    expect(normalizeThinkingLanguage(undefined)).toBe('en')
    expect(normalizeThinkingLanguage('auto')).toBe('en')
    expect(normalizeThinkingLanguage('AUTO')).toBe('en')
    expect(normalizeThinkingLanguage(42)).toBe('en')
    expect(normalizeThinkingLanguage({ get: () => 'zh' })).toBe('en')
  })
  it('resolveConfig 对非法档位不抛错并回退默认', () => {
    expect(resolveConfig({ thinkingLanguage: null }).thinkingLanguage).toBe('en')
    expect(resolveConfig({ thinkingLanguage: 42 }).thinkingLanguage).toBe('en')
    expect(resolveConfig({ thinkingLanguage: 'auto' }).thinkingLanguage).toBe('en')
  })
  it('resolveConfig 解引用 volatile 引用（宿主 schema 解析后的形态）', () => {
    expect(resolveConfig({ thinkingLanguage: { get: () => 'en' } }).thinkingLanguage).toBe('en')
    expect(resolveConfig({ injectPrompt: { get: () => false }, injectPerTurn: { get: () => true } })).toMatchObject({
      injectPrompt: false,
      injectPerTurn: true,
    })
  })
})

describe('宿主 Config schema', () => {
  it('空输入解析出与 DEFAULT_CONFIG 一致的默认值', () => {
    const parsed = Config({})
    expect(parsed.injectPrompt).toBe(DEFAULT_CONFIG.injectPrompt)
    expect(parsed.injectPerTurn).toBe(DEFAULT_CONFIG.injectPerTurn)
    expect(parsed.injectionText).toBe('')
    // volatile 字段（连带默认值）解析为 { get() } 引用，必须解引用后比较
    expect(readVolatile(parsed.thinkingLanguage)).toBe(DEFAULT_CONFIG.thinkingLanguage)
  })
  it('schema 解析结果直接喂给 resolveConfig 也得到默认配置（解引用在内部完成）', () => {
    expect(resolveConfig(Config({}))).toEqual(DEFAULT_CONFIG)
  })
  it('schema 解析出的 volatile 引用被现读：写入后 resolveConfig 立即反映', () => {
    const parsed = Config({ thinkingLanguage: 'en' as never })
    expect(typeof parsed.thinkingLanguage).toBe('object')
    expect(resolveConfig(parsed as never).injectionText).toBe(EN_TEXT)
  })
  it('schema 对非法档位值回退默认（volatile 字段的白名单由运行时归一兜底）', () => {
    expect(resolveConfig(Config({ thinkingLanguage: 'zzz' as never })).thinkingLanguage).toBe('en')
  })
})

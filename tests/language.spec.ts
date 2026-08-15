import { describe, expect, it } from 'vitest'
import { countCjk, countRelevant, cjkRatio } from '../src/language.js'

describe('countCjk', () => {
  it('统计简体中文字符', () => {
    expect(countCjk('你好世界')).toBe(4)
  })
  it('忽略英文与数字', () => {
    expect(countCjk('hello 123 world')).toBe(0)
  })
  it('识别扩展区与兼容区汉字', () => {
    expect(countCjk('\u3400\u4DBF\uF900')).toBe(3) // 扩展A、扩展A末、兼容区
  })
  it('中文全角标点计入中文内容', () => {
    expect(countCjk('你好，世界！')).toBe(6) // 4 汉字 + ，+ ！
  })
  it('日文假名不计入中文', () => {
    expect(countCjk('こんにちは')).toBe(0)
  })
  it('空字符串返回 0', () => {
    expect(countCjk('')).toBe(0)
  })
})

describe('countRelevant', () => {
  it('排除空白字符', () => {
    expect(countRelevant('a b\tc\n d')).toBe(4)
  })
  it('空与纯空白返回 0', () => {
    expect(countRelevant('')).toBe(0)
    expect(countRelevant('  \n\t ')).toBe(0)
  })
})

describe('cjkRatio', () => {
  it('纯中文比例为 1', () => {
    expect(cjkRatio('你好世界')).toBe(1)
  })
  it('中英混合按占比计算', () => {
    expect(cjkRatio('你好 world')).toBeCloseTo(2 / 7, 5) // 你好world 共 7 个非空白字符，其中 2 个 CJK
  })
  it('纯英文为 0', () => {
    expect(cjkRatio('hello world')).toBe(0)
  })
  it('纯代码为 0', () => {
    expect(cjkRatio('const x = foo(1)')).toBe(0)
  })
  it('无可判定字符返回 null（不抛错）', () => {
    expect(cjkRatio('')).toBeNull()
    expect(cjkRatio('   ')).toBeNull()
  })
})

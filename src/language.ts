/**
 * 零依赖 CJK 语言检测纯函数。
 * 设计：只做字符统计，不做分词、不做语义判断；调用方决定阈值语义。
 */

/** 汉字：扩展A区、基本区、兼容区（按 DSH 生态惯例不含日文假名）。 */
const CJK_HAN_RE = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/

/** 中文内容常见全角/中文标点：全角 ASCII、CJK 符号区、中文引号与破折号。 */
const CJK_PUNCT_RE = /[\u3000-\u303F\uFF01-\uFF0F\uFF1A-\uFF20\uFF3B-\uFF40\uFF5B-\uFF65\u2014\u2018\u2019\u201C\u201D\u2026]/

const WHITESPACE_RE = /\s/

/** 统计文本中的 CJK 字符数（汉字 + 中文标点）。 */
export function countCjk(text: string): number {
  let count = 0
  for (const char of text) {
    if (CJK_HAN_RE.test(char) || CJK_PUNCT_RE.test(char)) count += 1
  }
  return count
}

/** 统计非空白字符总数（可作为「有效文本」长度）。 */
export function countRelevant(text: string): number {
  let count = 0
  for (const char of text) {
    if (!WHITESPACE_RE.test(char)) count += 1
  }
  return count
}

/**
 * 有效文本中的 CJK 占比；无可判定字符时返回 `null`（无法判定，调用方不应告警）。
 * @param text - 待检测文本
 */
export function cjkRatio(text: string): number | null {
  const relevant = countRelevant(text)
  if (relevant === 0) return null
  return countCjk(text) / relevant
}

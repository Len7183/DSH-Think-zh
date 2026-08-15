/**
 * dsh-think-zh 配置归一化：合并默认值 + 校验，零依赖。
 */

export interface Config {
  /** 是否向每次请求的 system prompt 注入中文语言指令。 */
  injectPrompt: boolean
  /** 注入的指令文本；空白时回退到 DEFAULT_INJECTION_TEXT。 */
  injectionText: string
}

/** 精简强制指令：思考必用简体中文；回复跟随提问语言（无法判断时默认简体中文）；专业术语保留原文。 */
export const DEFAULT_INJECTION_TEXT = `语言要求（强制）：
1. 思考（reasoning）必须使用简体中文。
2. 回复使用与用户提问相同的语言；无法判断时默认简体中文。代码、标识符、文件路径、命令等保持原文，不翻译。`

export const DEFAULT_CONFIG: Config = {
  injectPrompt: true,
  injectionText: DEFAULT_INJECTION_TEXT,
}

/** 合并默认值并校验；空白/非字符串指令回退默认，非默认字符串去除首尾空白。 */
export function resolveConfig(input?: Partial<Config>): Config {
  const merged: Config = { ...DEFAULT_CONFIG, ...input }
  // injectionText 可能来自 YAML 配置（null/缺省）或非字符串，先做类型守卫再 trim
  const injectionText: unknown = merged.injectionText
  if (typeof injectionText === 'string' && injectionText.trim().length > 0) {
    merged.injectionText = injectionText.trim()
  } else {
    merged.injectionText = DEFAULT_INJECTION_TEXT
  }
  return merged
}

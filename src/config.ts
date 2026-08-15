/**
 * dsh-think-zh 配置归一化：合并默认值 + 校验，零依赖。
 */

export interface Config {
  /** 是否向每次请求的 system prompt 注入中文语言指令。 */
  injectPrompt: boolean
  /** 注入的指令文本；空白时回退到 DEFAULT_INJECTION_TEXT。 */
  injectionText: string
  /** 是否开启响应语言校验。 */
  verifyResponse: boolean
  /** 有效文本中 CJK 占比阈值；低于此值判定为非中文。 */
  cjkRatioThreshold: number
  /** 检测到非中文时是否向会话追加一条中文提醒消息（默认只告警，不干扰对话）。 */
  remindInSession: boolean
}

export const DEFAULT_INJECTION_TEXT = `语言要求（强制）：
- 你的回答（content）必须使用简体中文书写，除非用户明确要求使用其他语言。
- 你的思考过程（reasoning/thinking）也必须使用简体中文。
- 代码标识符、命令、文件名等专业术语保持原文，但注释、日志、提交信息与说明文字一律使用简体中文。`

export const DEFAULT_CONFIG: Config = {
  injectPrompt: true,
  injectionText: DEFAULT_INJECTION_TEXT,
  verifyResponse: true,
  cjkRatioThreshold: 0.5,
  remindInSession: false,
}

/** 合并默认值并校验；非法阈值抛 TypeError，空白指令回退默认。 */
export function resolveConfig(input?: Partial<Config>): Config {
  const merged: Config = { ...DEFAULT_CONFIG, ...input }
  const { cjkRatioThreshold } = merged
  if (typeof cjkRatioThreshold !== 'number'
    || !Number.isFinite(cjkRatioThreshold)
    || cjkRatioThreshold < 0
    || cjkRatioThreshold > 1) {
    throw new TypeError(`dsh-think-zh: cjkRatioThreshold 必须是 [0,1] 内的有限数，收到 ${String(cjkRatioThreshold)}`)
  }
  if (merged.injectionText.trim().length === 0) {
    merged.injectionText = DEFAULT_INJECTION_TEXT
  }
  return merged
}

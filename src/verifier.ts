import { cjkRatio } from './language.js'
import type { MinimalContext, SessionEventLike, SessionLike } from './types.js'

export const REMINDER_MESSAGE = '（自动提醒）请使用简体中文回复；你的回答与思考过程请使用简体中文。继续当前任务。'

export interface TurnAssessment {
  reasoningRatio: number | null
  textRatio: number | null
  reasoningNonZh: boolean
  textNonZh: boolean
}

/**
 * 纯函数：对一个回合的思考/回答文本做语言判定。
 * `cjkRatio` 为 `null`（无可判定字符）时对应项不判为非中文。
 */
export function assessTurn(reasoning: string, text: string, threshold: number): TurnAssessment {
  const reasoningRatio = cjkRatio(reasoning)
  const textRatio = cjkRatio(text)
  return {
    reasoningRatio,
    textRatio,
    reasoningNonZh: reasoningRatio !== null && reasoningRatio < threshold,
    textNonZh: textRatio !== null && textRatio < threshold,
  }
}

interface VerifierConfig {
  cjkRatioThreshold: number
  remindInSession: boolean
}

interface TurnBuffer {
  reasoning: string
  text: string
}

/**
 * 挂载响应校验器：监听 `session/event`，按会话缓冲 `assistant/chunk`，
 * `turn/end` 时判定并告警（可选向会话追加中文提醒）。只读，异常只记日志。
 * @returns 卸载监听与清理缓冲的 disposer。
 */
export function installVerifier(ctx: MinimalContext, config: VerifierConfig): () => void {
  const buffers = new Map<string, TurnBuffer>()

  function appendDelta(session: SessionLike, event: SessionEventLike): void {
    const data = event.data as { chunk?: { type?: string; text?: string } } | null | undefined
    const chunk = data?.chunk
    if (chunk === undefined || chunk === null || typeof chunk !== 'object') return
    if (chunk.type !== 'reasoning-delta' && chunk.type !== 'text-delta') return
    if (typeof chunk.text !== 'string') return
    const buffer = buffers.get(session.id) ?? { reasoning: '', text: '' }
    if (chunk.type === 'reasoning-delta') buffer.reasoning += chunk.text
    else buffer.text += chunk.text
    buffers.set(session.id, buffer)
  }

  function finalizeTurn(session: SessionLike): void {
    const buffer = buffers.get(session.id)
    if (buffer === undefined) return
    buffers.delete(session.id)
    const assessment = assessTurn(buffer.reasoning, buffer.text, config.cjkRatioThreshold)
    if (assessment.reasoningNonZh) {
      ctx.logger.warn(
        `dsh-think-zh: 会话 ${session.id} 的 reasoning（思考）疑似非中文（CJK 占比 ${String(assessment.reasoningRatio)} < ${String(config.cjkRatioThreshold)}）`,
      )
    }
    if (assessment.textNonZh) {
      ctx.logger.warn(
        `dsh-think-zh: 会话 ${session.id} 的 text（回答）疑似非中文（CJK 占比 ${String(assessment.textRatio)} < ${String(config.cjkRatioThreshold)}）`,
      )
    }
    if ((assessment.reasoningNonZh || assessment.textNonZh) && config.remindInSession) {
      try {
        session.append(
          'user/message',
          { role: 'user', content: [{ type: 'text', text: REMINDER_MESSAGE }] },
          { surfaceOp: 'append' },
        )
      } catch (error: unknown) {
        ctx.logger.warn(`dsh-think-zh: 追加中文提醒失败: ${String(error)}`)
      }
    }
  }

  const disposer = ctx.on('session/event', (session: SessionLike, event: SessionEventLike) => {
    try {
      if (event.type === 'assistant/chunk') appendDelta(session, event)
      else if (event.type === 'turn/end') finalizeTurn(session)
    } catch (error: unknown) {
      ctx.logger.warn(`dsh-think-zh: 校验器处理事件异常: ${String(error)}`)
    }
  })

  return () => {
    disposer()
    buffers.clear()
  }
}

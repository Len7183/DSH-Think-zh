/**
 * dsh-think-zh per-turn 用户消息注入（高显著通道）。
 *
 * 动机（2026-09-10 实证，kimi k3-256k）：部分模型对静态 system
 * prompt section 的服从弱（实证 = kimi k3-256k，默认 effort 档、思考已开，
 * 仍从第一步起用英文）；而对话 steering（用户消息通道）可靠重新锚定。因此把同一指令
 * 以用户消息形态每轮前置，作为可选加强（injectPerTurn: true）。
 *
 * 机制 = agent/pre-step 瀑布（prepend）——与宿主事件顺序约定一致：
 * prepend 注册者先于后续处理者看到决策，注入发生在消息进入模型前。
 * 失败不抛出：与 injector.ts 同款降级（error 日志，静默跳过）。
 */
import type { MinimalContext, PreStepDecisionLike } from './types.js'

export const PRETURN_MARK = 'dsh-think-zh/preturn'

/**
 * 注册 per-turn 语言注入：把指令文本前置到每轮第一条用户消息文本块。
 * 幂等标记（PRETURN_MARK）防止多 pre-step 调用重复注入。
 * @returns 无（ctx.on 的返回值与上游 cordis 语义无关，调用方忽略）。
 */
export function registerPerTurnNudge(ctx: MinimalContext, text: string): void {
  if (typeof ctx.on !== 'function') {
    ctx.logger.error('dsh-think-zh: agent/pre-step 瀑布不可用，per-turn 语言指令未注册。宿主可能不提供该瀑布。')
    return
  }
  try {
    ctx.on('agent/pre-step', async (payload, next): Promise<PreStepDecisionLike> => {
      const decision = await next()
      if (!decision || decision.kind !== 'enter' || !Array.isArray(decision.messages) || decision.messages.length === 0) {
        return decision
      }
      if (payload?.signal?.aborted) {
        return decision
      }
      let injected = false
      const messages = decision.messages.map((msg) => {
        if (injected || !msg || msg.source?.kind !== 'user' || !Array.isArray(msg.content)) {
          return msg
        }
        let done = false
        const content = msg.content.map((block) => {
          if (done || !block || block.type !== 'text' || typeof block.text !== 'string' || block.text.includes(PRETURN_MARK)) {
            return block
          }
          done = true
          return { ...block, text: `[${PRETURN_MARK}] ${text}\n\n${block.text}` }
        })
        if (!done) {
          return msg
        }
        injected = true
        return { ...msg, content }
      })
      return injected ? { ...decision, messages } : decision
    }, { prepend: true })
  } catch (error: unknown) {
    ctx.logger.error(`dsh-think-zh: 注册 agent/pre-step 失败: ${String(error)}`)
  }
}

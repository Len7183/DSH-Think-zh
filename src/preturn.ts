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
 * 文本由提供者现读，因此设置页改完的下一轮即生效。
 * 失败不抛出：与 injector.ts 同款降级（error 日志，静默跳过）。
 */
import type { MinimalContext, PreStepDecisionLike } from './types.js'

export const PRETURN_MARK = 'dsh-think-zh/preturn'

/**
 * 注册 per-turn 语言注入：把指令文本前置到每轮第一条用户消息的首个文本块。
 *
 * 只考虑数组中第一条 user 来源消息，绝不向后顺延：该消息首个文本块已带幂等标记前缀
 * （PRETURN_MARK）时整条决策原样返回。此前按「首个未标记文本块」顺延的实现会让
 * 多 pre-step 调用把标记扩散到同消息后续文本块乃至后续用户消息，幂等守卫形同虚设。
 * @param ctx - 宿主上下文。
 * @param text - 每轮现读的指令文本提供者。
 * @returns 无（ctx.on 的返回值与上游 cordis 语义无关，调用方忽略）。
 */
export function registerPerTurnNudge(ctx: MinimalContext, text: () => string): void {
  if (typeof ctx.on !== 'function') {
    ctx.logger.error('dsh-think-zh: agent/pre-step 瀑布不可用，per-turn 语言指令未注册。宿主可能不提供该瀑布。')
    return
  }
  try {
    ctx.on('agent/pre-step', async (payload, next): Promise<PreStepDecisionLike> => {
      // 瀑布契约要求处理器调用 next() 传递决策，不得短路；aborted 只跳过指令改写，
      // 链路行为（含中止语义）交由宿主自查。
      const decision = await next()
      if (!decision || decision.kind !== 'enter' || !Array.isArray(decision.messages) || decision.messages.length === 0) {
        return decision
      }
      if (payload?.signal?.aborted) {
        return decision
      }
      // 宿主消息缺省 source 字段时按 role 回退判定（类型声明两者均可选）。
      const index = decision.messages.findIndex(
        (msg) => !!msg && (msg.source ? msg.source.kind === 'user' : msg.role === 'user'),
      )
      if (index === -1) {
        return decision
      }
      const msg = decision.messages[index]
      if (!msg || !Array.isArray(msg.content)) {
        return decision
      }
      const isText = (block: { type?: string; text?: string } | undefined): block is { type: 'text'; text: string } =>
        !!block && block.type === 'text' && typeof block.text === 'string'
      // 幂等判定收窄为首文本块前缀：现行实现只在首个文本块打标；全文子串匹配会把
      // 用户正文恰好出现标记字样（如粘贴本插件 README）的消息误判为已注入而跳过注入。
      const firstBlock = msg.content[0]
      if (isText(firstBlock) && firstBlock.text.startsWith(`[${PRETURN_MARK}] `)) {
        return decision
      }
      const blockIndex = msg.content.findIndex(isText)
      if (blockIndex === -1) {
        return decision
      }
      const messages = decision.messages.slice()
      messages[index] = {
        ...msg,
        content: msg.content.map((block, i) => {
          if (i !== blockIndex || !isText(block)) return block
          return { ...block, text: `[${PRETURN_MARK}] ${text()}\n\n${block.text}` }
        }),
      }
      return { ...decision, messages }
    }, { prepend: true })
  } catch (error: unknown) {
    ctx.logger.error(`dsh-think-zh: 注册 agent/pre-step 失败: ${String(error)}`)
  }
}

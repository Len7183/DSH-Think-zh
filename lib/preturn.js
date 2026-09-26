export const PRETURN_MARK = 'dsh-think-zh/preturn';
/**
 * 注册 per-turn 语言注入：把指令文本前置到每轮第一条用户消息文本块。
 * 幂等标记（PRETURN_MARK）防止多 pre-step 调用重复注入。
 * @returns 无（ctx.on 的返回值与上游 cordis 语义无关，调用方忽略）。
 */
export function registerPerTurnNudge(ctx, text) {
    if (typeof ctx.on !== 'function') {
        ctx.logger.error('dsh-think-zh: agent/pre-step 瀑布不可用，per-turn 语言指令未注册。宿主可能不提供该瀑布。');
        return;
    }
    try {
        ctx.on('agent/pre-step', async (payload, next) => {
            const decision = await next();
            if (!decision || decision.kind !== 'enter' || !Array.isArray(decision.messages) || decision.messages.length === 0) {
                return decision;
            }
            if (payload?.signal?.aborted) {
                return decision;
            }
            let injected = false;
            const messages = decision.messages.map((msg) => {
                if (injected || !msg || msg.source?.kind !== 'user' || !Array.isArray(msg.content)) {
                    return msg;
                }
                let done = false;
                const content = msg.content.map((block) => {
                    if (done || !block || block.type !== 'text' || typeof block.text !== 'string' || block.text.includes(PRETURN_MARK)) {
                        return block;
                    }
                    done = true;
                    return { ...block, text: `[${PRETURN_MARK}] ${text}\n\n${block.text}` };
                });
                if (!done) {
                    return msg;
                }
                injected = true;
                return { ...msg, content };
            });
            return injected ? { ...decision, messages } : decision;
        }, { prepend: true });
    }
    catch (error) {
        ctx.logger.error(`dsh-think-zh: 注册 agent/pre-step 失败: ${String(error)}`);
    }
}

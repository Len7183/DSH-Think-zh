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
import type { MinimalContext } from './types.js';
export declare const PRETURN_MARK = "dsh-think-zh/preturn";
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
export declare function registerPerTurnNudge(ctx: MinimalContext, text: () => string): void;

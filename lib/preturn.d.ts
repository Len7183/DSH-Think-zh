/**
 * dsh-think-zh per-turn 用户消息注入（高显著通道）。
 *
 * 动机（2026-09-10 实证，kimi k3-256k）：无 reasoning 模型对静态 system
 * prompt section 的服从弱——指令在场、persona 正确渲染，思考仍从第一步起
 * 用英文；而对话 steering（用户消息通道）可靠重新锚定。因此把同一指令
 * 以用户消息形态每轮前置，作为可选加强（injectPerTurn: true）。
 *
 * 机制 = agent/pre-step 瀑布（prepend）——与宿主事件顺序约定一致：
 * prepend 注册者先于后续处理者看到决策，注入发生在消息进入模型前。
 * 失败不抛出：与 injector.ts 同款降级（error 日志，静默跳过）。
 */
import type { MinimalContext } from './types.js';
export declare const PRETURN_MARK = "dsh-think-zh/preturn";
/**
 * 注册 per-turn 语言注入：把指令文本前置到每轮第一条用户消息文本块。
 * 幂等标记（PRETURN_MARK）防止多 pre-step 调用重复注入。
 * @returns 无（ctx.on 的返回值与上游 cordis 语义无关，调用方忽略）。
 */
export declare function registerPerTurnNudge(ctx: MinimalContext, text: string): void;

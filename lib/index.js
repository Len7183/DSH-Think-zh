import { resolveConfig } from './config.js';
import { registerLanguageInjection } from './injector.js';
import { registerPerTurnNudge } from './preturn.js';
export const name = 'dsh-think-zh';
/**
 * 宿主 Loader 只从包入口读取插件契约：`Config` 必须在这里导出，否则 profile patch
 * 中的 config 不会按 schema 解析，`thinkingLanguage` 也不会成为 volatile 引用
 * （设置页写入将无法即时生效）。
 */
export { Config } from './config.js';
/**
 * 声明依赖：等待 host 的 systemPrompt 服务就绪后再 apply。
 * 缺少该声明时 cordis 可能在服务注册前执行 apply，导致 section 注册静默降级（无注入）。
 */
export const inject = ['systemPrompt'];
/** 插件入口：按配置挂载注入器（静态 section + 可选 per-turn 用户消息注入）。 */
export function apply(ctx, config) {
    const resolved = resolveConfig(config);
    // 每次现读：thinkingLanguage 是 volatile 字段，设置页改完的下一份请求即生效。
    const currentText = () => resolveConfig(config).injectionText;
    // 两个通道相互独立：静态注入关掉时，per-turn 仍可单独承担指令投递。
    if (resolved.injectPrompt) {
        registerLanguageInjection(ctx, currentText);
    }
    if (resolved.injectPerTurn) {
        registerPerTurnNudge(ctx, currentText);
    }
}

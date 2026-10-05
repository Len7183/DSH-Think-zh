import { resolveConfig, VOLATILE_SUPPORTED } from './config.js';
import { registerLanguageInjection } from './injector.js';
import { registerPerTurnNudge } from './preturn.js';
import { readVolatile } from './runtime.js';
import { DEFAULT_THINKING_LANGUAGE, THINKING_LANGUAGES } from './config.js';
export const name = 'dsh-think-zh';
/** 已告警过的非法档位值：volatile 现读下同一值每轮都会出现，只提示一次。 */
const warnedThinkingLanguages = new Set();
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
    if (!VOLATILE_SUPPORTED) {
        ctx.logger.warn?.('dsh-think-zh: 宿主 schemastery < 3.18.3，thinkingLanguage 为普通字段，「思考语言」设置改完只随插件重挂生效（静态注入不受影响）');
    }
    warnInvalidThinkingLanguage(ctx, config);
    // 开关只判一次；注入文本在提供者内现读 resolveConfig——thinkingLanguage 是 volatile
    // 字段，设置页改完的下一份请求即生效（两次调用是设计使然而非重复计算）。
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
/**
 * 手写 YAML 的非法档位值（显式提供且不在白名单）静默回退默认档，提示一次帮用户定位。
 * 空白值视作未设置不提示；volatile 读取异常按未设置处理。
 */
function warnInvalidThinkingLanguage(ctx, config) {
    const raw = readVolatile(config?.thinkingLanguage);
    if (typeof raw !== 'string')
        return;
    const normalized = raw.trim().toLowerCase();
    if (normalized === '' || THINKING_LANGUAGES.includes(normalized))
        return;
    if (warnedThinkingLanguages.has(normalized))
        return;
    warnedThinkingLanguages.add(normalized);
    ctx.logger.warn?.(`dsh-think-zh: thinkingLanguage 非法值 "${raw.trim()}"，已回退默认档 ${DEFAULT_THINKING_LANGUAGE}`);
}

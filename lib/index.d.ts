import { type RawConfigInput } from './config.js';
import type { MinimalContext } from './types.js';
export declare const name = "dsh-think-zh";
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
export declare const inject: readonly string[];
/** 插件入口：按配置挂载注入器（静态 section + 可选 per-turn 用户消息注入）。 */
export declare function apply(ctx: MinimalContext, config?: RawConfigInput): void;

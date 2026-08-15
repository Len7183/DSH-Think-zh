import { type Config } from './config.js';
import type { MinimalContext } from './types.js';
export declare const name = "dsh-think-zh";
/**
 * 声明依赖：等待 host 的 systemPrompt 服务就绪后再 apply。
 * 缺少该声明时 cordis 可能在服务注册前执行 apply，导致 section 注册静默降级（无注入）。
 */
export declare const inject: readonly string[];
/** 插件入口：按配置挂载注入器（唯一机制：请求侧指令注入）。 */
export declare function apply(ctx: MinimalContext, config?: Partial<Config>): void;

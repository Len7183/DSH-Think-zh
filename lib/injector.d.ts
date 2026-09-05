import type { MinimalContext } from './types.js';
export declare const PROMPT_SECTION_NAME = "dsh-think-zh/language";
/**
 * DSH 官方稀疏分配约定：persona 为 0、一方工具指引 1000+；第三方插件可用任意有限整数，
 * 同 order 平局按名称 code-unit 序。取 2 落在 persona 与最近一方区段（500）之间的留白区：
 * 位于 persona 之后、全部工具指引之前。
 */
export declare const PROMPT_SECTION_ORDER = 2;
/**
 * 向 host 的 systemPrompt 服务注册中文指令 section。
 *
 * 失败时绝不抛出，但会以 error 级别记录明确诊断：
 * - systemPrompt 服务缺失（多为宿主未加载该服务或插件缺 `inject` 声明）；
 * - section 注册抛错（如名称冲突）。
 * 两路失败都返回空函数 disposer，调用方无需区分。
 * @returns 注册的 disposer（失败时为空函数）。
 */
export declare function registerLanguageInjection(ctx: MinimalContext, text: string): () => void;

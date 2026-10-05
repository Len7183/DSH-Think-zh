import type { MinimalContext } from './types.js';
export declare const PROMPT_SECTION_NAME = "dsh-think-zh/language";
/**
 * DSH 官方稀疏分配约定：第三方插件可用任意有限整数，sections 按 order 升序、平局按名称
 * code-unit 序（comparePromptSections）。宿主最小的内置 section 是 harness 身份段
 * （HARNESS_IDENTITY，order -1000），persona 为 0、工具指引 1000+。取 -1000000 稳居全部
 * 内置段之前：语言要求必须最先出现，落在尾部会被大段工具指引稀释、与其他指令混淆。
 */
export declare const PROMPT_SECTION_ORDER = -1000000;
/**
 * 向 host 的 systemPrompt 服务注册中文指令 section，并注册 assemble 置顶兜底。
 *
 * `text` 以提供者形态注册：宿主在每次组装时调用它（`section.text(context)`），
 * 因此 volatile 配置改完的下一份请求即生效，无需重挂插件或重注册 section。
 * section 注册成功后再注册 `system-prompt/assemble` 末端重排（第二重置顶保障）。
 *
 * 失败时绝不抛出，但会以 error 级别记录明确诊断：
 * - systemPrompt 服务缺失（多为宿主未加载该服务或插件缺 `inject` 声明）；
 * - section 注册抛错（如名称冲突）。
 * 两路失败都返回空函数 disposer，调用方无需区分。
 * @param ctx - 宿主上下文。
 * @param text - 每次组装现读的指令文本提供者。
 * @returns 注册的 disposer（失败时为空函数）。
 */
export declare function registerLanguageInjection(ctx: MinimalContext, text: () => string): () => void;

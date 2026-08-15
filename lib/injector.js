export const PROMPT_SECTION_NAME = 'dsh-think-zh/language';
/** persona 为 0，工具声明 100-199；取 2 保证在 persona 之后、工具之前。 */
export const PROMPT_SECTION_ORDER = 2;
const SECTION_SPEC = {
    name: PROMPT_SECTION_NAME,
    order: PROMPT_SECTION_ORDER,
};
/**
 * 向 host 的 systemPrompt 服务注册中文指令 section。
 *
 * 失败时绝不抛出，但会以 error 级别记录明确诊断：
 * - systemPrompt 服务缺失（多为宿主未加载该服务或插件缺 `inject` 声明）；
 * - section 注册抛错（如名称冲突）。
 * 两路失败都返回空函数 disposer，调用方无需区分。
 * @returns 注册的 disposer（失败时为空函数）。
 */
export function registerLanguageInjection(ctx, text) {
    if (typeof ctx.systemPrompt?.section !== 'function') {
        ctx.logger.error(`dsh-think-zh: systemPrompt 服务不可用，语言指令未注入。请确认插件声明了 inject: ["systemPrompt"] 且宿主已注册该服务。`);
        return () => { };
    }
    try {
        return ctx.systemPrompt.section({ ...SECTION_SPEC, text });
    }
    catch (error) {
        ctx.logger.error(`dsh-think-zh: 注册 system prompt section（${PROMPT_SECTION_NAME}）失败: ${String(error)}`);
        return () => { };
    }
}

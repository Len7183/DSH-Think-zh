export const PROMPT_SECTION_NAME = 'dsh-think-zh/language';
/**
 * DSH 官方稀疏分配约定：第三方插件可用任意有限整数，sections 按 order 升序、平局按名称
 * code-unit 序（comparePromptSections）。宿主最小的内置 section 是 harness 身份段
 * （HARNESS_IDENTITY，order -1000），persona 为 0、工具指引 1000+。取 -1000000 稳居全部
 * 内置段之前：语言要求必须最先出现，落在尾部会被大段工具指引稀释、与其他指令混淆。
 */
export const PROMPT_SECTION_ORDER = -1000000;
const SECTION_SPEC = {
    name: PROMPT_SECTION_NAME,
    order: PROMPT_SECTION_ORDER,
};
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
export function registerLanguageInjection(ctx, text) {
    if (typeof ctx.systemPrompt?.section !== 'function') {
        ctx.logger.error(`dsh-think-zh: systemPrompt 服务不可用，语言指令未注入。请确认插件声明了 inject: ["systemPrompt"] 且宿主已注册该服务。`);
        return () => { };
    }
    try {
        const disposer = ctx.systemPrompt.section({ ...SECTION_SPEC, text });
        registerAssemblyHoist(ctx);
        return disposer;
    }
    catch (error) {
        ctx.logger.error(`dsh-think-zh: 注册 system prompt section（${PROMPT_SECTION_NAME}）失败: ${String(error)}`);
        return () => { };
    }
}
/**
 * 在 `system-prompt/assemble` 瀑布末端把本插件 section 重排到首位。
 *
 * 宿主在瀑布前按 order 排序 sections，瀑布返回的顺序即最终顺序；末端重排兜住
 * 其他插件以更小 order 注册、或在瀑布中改序的情况。重排为非原地（拷贝重建），
 * 兼容冻结数组与共享引用。处理器形状与宿主自带的校验
 * 处理器同款（`await next()` 后修改并返回），找不到目标或已在首位时原样透传。
 * 宿主过老（无瀑布注册面）时静默跳过：order -1000000 已提供置顶保障。
 */
function registerAssemblyHoist(ctx) {
    if (typeof ctx.on !== 'function')
        return;
    try {
        ctx.on('system-prompt/assemble', async (assembly, _context, next) => {
            const assembled = await next();
            const sections = assembled?.sections;
            if (!Array.isArray(sections))
                return assembled;
            const index = sections.findIndex((section) => section?.name === PROMPT_SECTION_NAME);
            // 已在首位（幂等）或被其他插件抑制时不动宿主决策。
            if (index <= 0)
                return assembled;
            const ours = sections[index];
            if (!ours)
                return assembled;
            // 非原地重排：拷贝重建，兼容冻结数组与共享引用（与 preturn 的拷贝姿态一致）。
            return {
                ...assembled,
                sections: [ours, ...sections.slice(0, index), ...sections.slice(index + 1)],
            };
        });
    }
    catch (error) {
        ctx.logger.error(`dsh-think-zh: 注册 system-prompt/assemble 置顶兜底失败: ${String(error)}`);
    }
}

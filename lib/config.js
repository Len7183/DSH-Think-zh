/**
 * dsh-think-zh 配置归一化：合并默认值 + 校验，零依赖。
 */
/** 精简强制指令：思考必用简体中文；回复跟随提问语言（无法判断时默认简体中文）；专业术语保留原文。 */
export const DEFAULT_INJECTION_TEXT = `语言要求（强制）：
1. 思考（reasoning）必须使用简体中文。
2. 回复使用与用户提问相同的语言；无法判断时默认简体中文。代码、标识符、文件路径、命令等保持原文，不翻译。`;
export const DEFAULT_CONFIG = {
    injectPrompt: true,
    injectionText: DEFAULT_INJECTION_TEXT,
};
/** 合并默认值并校验；injectPrompt/injectionText 来自 YAML 时可能为 null 或非预期类型，均回退默认；非默认字符串去除首尾空白。 */
export function resolveConfig(input) {
    const merged = { ...DEFAULT_CONFIG, ...input };
    // 展开合并会以 null/undefined 覆盖默认值（YAML 空值场景），非布尔一律回退默认
    if (typeof merged.injectPrompt !== 'boolean') {
        merged.injectPrompt = DEFAULT_CONFIG.injectPrompt;
    }
    // injectionText 可能来自 YAML 配置（null/缺省）或非字符串，先做类型守卫再 trim
    const injectionText = merged.injectionText;
    if (typeof injectionText === 'string' && injectionText.trim().length > 0) {
        merged.injectionText = injectionText.trim();
    }
    else {
        merged.injectionText = DEFAULT_INJECTION_TEXT;
    }
    return merged;
}

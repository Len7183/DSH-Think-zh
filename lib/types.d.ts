/**
 * dsh-think-zh 使用的最小宿主接口。
 * 只声明本插件实际调用的形状，避免引入 DSH 子包作为构建依赖（零 runtime 依赖）。
 */
/** 注册到 host systemPrompt 服务的 section 形状。 */
export interface PromptSectionLike {
    /** 唯一名称——重复注册会抛错。 */
    readonly name: string;
    /** 组装顺序（升序拼接）；约定 persona 为 0、工具指引 100-199。 */
    readonly order: number;
    /** 注入文本。 */
    readonly text: string;
}
export interface MinimalContext {
    systemPrompt: {
        section(section: PromptSectionLike): () => void;
    };
    logger: {
        warn(...args: unknown[]): void;
        error(...args: unknown[]): void;
    };
}

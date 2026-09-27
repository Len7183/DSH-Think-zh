/**
 * dsh-think-zh 配置归一化：默认值、校验、回退。
 *
 * 导出的 `Config` 是给宿主 Loader 用的 schemastery schema；`thinkingLanguage`
 * 带 `.volatile()` = 设置页改完即时生效、不重挂插件（宿主 schemastery ≥3.18.3）。
 * 纯函数（DEFAULT_CONFIG / resolveConfig）是同一套默认值的第二入口，供测试与
 * 运行时现读使用，两者由单测锁定一致。
 */
import z from '@deepseek-ai/schemastery';
/** 思考语言可选档位；顺序即设置页下拉顺序。 */
export declare const THINKING_LANGUAGES: readonly ["zh", "en"];
export type ThinkingLanguage = (typeof THINKING_LANGUAGES)[number];
/** 默认档：与 1.0 之前的内置文本逐字一致。 */
export declare const DEFAULT_THINKING_LANGUAGE: ThinkingLanguage;
/**
 * 按档位生成强制指令：`zh` 两条款（含思考语言），`en` 只保留回复条款。
 * @param language - 归一化后的档位。
 */
export declare function injectionTextFor(language: ThinkingLanguage): string;
/** 默认注入文本（= `zh` 档文本）。 */
export declare const DEFAULT_INJECTION_TEXT: string;
/** 归一化后的生效配置。 */
export interface ResolvedConfig {
    /** 是否向每次请求的 system prompt 注入语言指令。 */
    injectPrompt: boolean;
    /** 生效的注入文本：自定义文本非空时优先，否则由 `thinkingLanguage` 推导。 */
    injectionText: string;
    /** 是否在每轮请求的用户消息前额外注入（agent/pre-step 瀑布，高显著通道）。 */
    injectPerTurn: boolean;
    /** 思考语言档位。 */
    thinkingLanguage: ThinkingLanguage;
}
export declare const DEFAULT_CONFIG: ResolvedConfig;
/** 宿主 Loader 解析 profile patch 中本条目 config 所用的 schema。 */
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    injectPrompt: z<boolean, boolean, "defined">;
    injectionText: z<string, string, "defined">;
    injectPerTurn: z<boolean, boolean, "defined">;
    thinkingLanguage: z<string, string, "volatile-defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    injectPrompt: z<boolean, boolean, "defined">;
    injectionText: z<string, string, "defined">;
    injectPerTurn: z<boolean, boolean, "defined">;
    thinkingLanguage: z<string, string, "volatile-defined">;
}>>, "plain">;
/** 来自 YAML／宿主的原始配置：字段类型不可信，一律按 unknown 处理。 */
export interface RawConfigInput {
    injectPrompt?: unknown;
    injectionText?: unknown;
    injectPerTurn?: unknown;
    thinkingLanguage?: unknown;
}
/** 白名单归一：非 `'zh' | 'en'` 一律回退默认档（YAML null／错拼不抛错）。 */
export declare function normalizeThinkingLanguage(value: unknown): ThinkingLanguage;
/**
 * 合并默认值并校验：非布尔回退默认；`injectionText` 空白视作未自定义，
 * 此时按 `thinkingLanguage` 生成文本。
 *
 * 输入统一先解 volatile 引用：宿主 schema 解析后，volatile 字段（连带其默认值）
 * 一律是 `{ get() }` 引用，直接当值用会静默回退默认档。
 */
export declare function resolveConfig(input?: RawConfigInput): ResolvedConfig;

/**
 * dsh-think-zh 配置归一化：默认值、校验、回退。
 *
 * 导出的 `Config` 是给宿主 Loader 用的 schemastery schema；`thinkingLanguage`
 * 带 `.volatile()` = 设置页改完即时生效、不重挂插件（宿主 schemastery ≥3.18.3）。
 * 纯函数（DEFAULT_CONFIG / resolveConfig）是同一套默认值的第二入口，供测试与
 * 运行时现读使用，两者由单测锁定一致。
 */
import z from '@deepseek-ai/schemastery';
/** 思考语言可选档位；顺序即设置页下拉顺序（默认档在前）。 */
export declare const THINKING_LANGUAGES: readonly ["en", "zh"];
export type ThinkingLanguage = (typeof THINKING_LANGUAGES)[number];
/** 默认档（1.1.0 起）：默认英文——只注入回复跟随条款，思考语言交还模型。 */
export declare const DEFAULT_THINKING_LANGUAGE: ThinkingLanguage;
/**
 * 按档位生成强制指令：`zh` 两条款（含思考语言），`en` 只保留回复条款。
 * @param language - 归一化后的档位。
 */
export declare function injectionTextFor(language: ThinkingLanguage): string;
/** 默认注入文本（= 默认档 `en` 的文本）。 */
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
/**
 * schemastery 的 `.volatile()` 是 ≥3.18.3 的能力；宿主内置更旧版本时模块加载期直接
 * 调用会在 import 期抛 TypeError、插件整体加载失败（与「静态注入兼容 0.1.0-rc.6」的
 * 承诺冲突）。加载期做特性探测，不支持时字段退化为普通值——仅失去「设置页改完即时
 * 切换」，静态注入不受影响。
 */
export declare const VOLATILE_SUPPORTED: boolean;
/**
 * 对 schema 字段应用 `.volatile()`（宿主支持时）；不支持时原样返回普通字段。
 * @param field - 待修饰的 schema 字段。
 */
export declare function applyVolatile<T>(field: T): T;
/** 宿主 Loader 解析 profile patch 中本条目 config 所用的 schema。 */
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    injectPrompt: z<boolean, boolean, "defined">;
    injectionText: z<string, string, "defined">;
    injectPerTurn: z<boolean, boolean, "defined">;
    thinkingLanguage: z<string, string, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    injectPrompt: z<boolean, boolean, "defined">;
    injectionText: z<string, string, "defined">;
    injectPerTurn: z<boolean, boolean, "defined">;
    thinkingLanguage: z<string, string, "defined">;
}>>, "plain">;
/** 来自 YAML／宿主的原始配置：字段类型不可信，一律按 unknown 处理。 */
export interface RawConfigInput {
    injectPrompt?: unknown;
    injectionText?: unknown;
    injectPerTurn?: unknown;
    thinkingLanguage?: unknown;
}
/**
 * 白名单归一：大小写与首尾空白不敏感（手写 YAML 的 `EN` 按用户意图归为 `en`）；
 * 白名单外一律回退默认档（YAML null／错拼不抛错）。
 */
export declare function normalizeThinkingLanguage(value: unknown): ThinkingLanguage;
/**
 * 合并默认值并校验：非布尔回退默认；`injectionText` 空白视作未自定义，
 * 此时按 `thinkingLanguage` 生成文本。
 *
 * 输入统一先解 volatile 引用：宿主 schema 解析后，volatile 字段（连带其默认值）
 * 一律是 `{ get() }` 引用，直接当值用会静默回退默认档。
 */
export declare function resolveConfig(input?: RawConfigInput): ResolvedConfig;

/**
 * dsh-think-zh 配置归一化：默认值、校验、回退。
 *
 * 导出的 `Config` 是给宿主 Loader 用的 schemastery schema；`thinkingLanguage`
 * 带 `.volatile()` = 设置页改完即时生效、不重挂插件（宿主 schemastery ≥3.18.3）。
 * 纯函数（DEFAULT_CONFIG / resolveConfig）是同一套默认值的第二入口，供测试与
 * 运行时现读使用，两者由单测锁定一致。
 */
import z from '@deepseek-ai/schemastery';
import { readVolatile } from './runtime.js';
/** 思考语言可选档位；顺序即设置页下拉顺序（默认档在前）。 */
export const THINKING_LANGUAGES = ['en', 'zh'];
/** 默认档（1.1.0 起）：默认英文——只注入回复跟随条款，思考语言交还模型。 */
export const DEFAULT_THINKING_LANGUAGE = 'en';
const HEADER = '语言要求（强制）：';
const REPLY_CLAUSE = '回复使用与用户提问相同的语言；无法判断时默认简体中文。代码、标识符、文件路径、命令等保持原文，不翻译。';
/**
 * 按档位生成强制指令：`zh` 两条款（含思考语言），`en` 只保留回复条款。
 * @param language - 归一化后的档位。
 */
export function injectionTextFor(language) {
    return language === 'en'
        ? `${HEADER}\n1. ${REPLY_CLAUSE}`
        : `${HEADER}\n1. 思考（reasoning）必须使用简体中文。\n2. ${REPLY_CLAUSE}`;
}
/** 默认注入文本（= 默认档 `en` 的文本）。 */
export const DEFAULT_INJECTION_TEXT = injectionTextFor(DEFAULT_THINKING_LANGUAGE);
export const DEFAULT_CONFIG = {
    injectPrompt: true,
    injectionText: DEFAULT_INJECTION_TEXT,
    injectPerTurn: false,
    thinkingLanguage: DEFAULT_THINKING_LANGUAGE,
};
/** 宿主 Loader 解析 profile patch 中本条目 config 所用的 schema。 */
export const Config = z.object({
    injectPrompt: z.boolean().default(DEFAULT_CONFIG.injectPrompt),
    injectionText: z.string().default(''),
    injectPerTurn: z.boolean().default(DEFAULT_CONFIG.injectPerTurn),
    thinkingLanguage: z.string().default(DEFAULT_THINKING_LANGUAGE).volatile(),
});
/**
 * 白名单归一：大小写与首尾空白不敏感（手写 YAML 的 `EN` 按用户意图归为 `en`）；
 * 白名单外一律回退默认档（YAML null／错拼不抛错）。
 */
export function normalizeThinkingLanguage(value) {
    const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return THINKING_LANGUAGES.includes(raw) ? raw : DEFAULT_THINKING_LANGUAGE;
}
/**
 * 合并默认值并校验：非布尔回退默认；`injectionText` 空白视作未自定义，
 * 此时按 `thinkingLanguage` 生成文本。
 *
 * 输入统一先解 volatile 引用：宿主 schema 解析后，volatile 字段（连带其默认值）
 * 一律是 `{ get() }` 引用，直接当值用会静默回退默认档。
 */
export function resolveConfig(input) {
    const resolved = {
        injectPrompt: toBoolean(readVolatile(input?.injectPrompt), DEFAULT_CONFIG.injectPrompt),
        injectionText: '',
        injectPerTurn: toBoolean(readVolatile(input?.injectPerTurn), DEFAULT_CONFIG.injectPerTurn),
        thinkingLanguage: normalizeThinkingLanguage(readVolatile(input?.thinkingLanguage)),
    };
    const rawText = readVolatile(input?.injectionText);
    const custom = typeof rawText === 'string' ? rawText.trim() : '';
    resolved.injectionText = custom.length > 0 ? custom : injectionTextFor(resolved.thinkingLanguage);
    return resolved;
}
function toBoolean(value, fallback) {
    return typeof value === 'boolean' ? value : fallback;
}

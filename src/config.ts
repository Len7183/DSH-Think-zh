/**
 * dsh-think-zh 配置归一化：默认值、校验、回退。
 *
 * 导出的 `Config` 是给宿主 Loader 用的 schemastery schema；`thinkingLanguage`
 * 带 `.volatile()` = 设置页改完即时生效、不重挂插件（宿主 schemastery ≥3.18.3）。
 * 纯函数（DEFAULT_CONFIG / resolveConfig）是同一套默认值的第二入口，供测试与
 * 运行时现读使用，两者由单测锁定一致。
 */
import z from '@deepseek-ai/schemastery'
import { readVolatile } from './runtime.js'

/** 思考语言可选档位；顺序即设置页下拉顺序（默认档在前）。 */
export const THINKING_LANGUAGES = ['en', 'zh'] as const
export type ThinkingLanguage = (typeof THINKING_LANGUAGES)[number]
/** 默认档（1.1.0 起）：默认英文——只注入回复跟随条款，思考语言交还模型。 */
export const DEFAULT_THINKING_LANGUAGE: ThinkingLanguage = 'en'

const HEADER = '语言要求（强制，最高优先级）：'
/** 默认英文档只约束回复：跟随最近一条实质提问，工具输出与引用不改变回复语言。 */
const EN_INJECTION_TEXT = `${HEADER}
1. 回复使用与用户提问相同的语言，并跟随其最近一条实质提问；无法判断时默认简体中文。代码、标识符、文件路径、命令与报错原文保持原样，不翻译；工具输出与引用不改变回复语言。`
/**
 * 简体中文档文本（1.1.1 全中文版）：三条中文强制条款（思考语言 + 覆盖范围 + 回复语言）。
 *
 * 2026-10-18 实测（deepseek-flash / reasoningEffort max / 英文提问 / 实际工作区）：
 * 全英文版中文思考 2/10，「英文强制段 + 中文重申」混合版 7/10，本全中文版效果见提交记录。
 * 对静态 section 服从弱的模型仍应叠加 injectPerTurn。
 */
const ZH_INJECTION_TEXT = `${HEADER}
1. 思考（reasoning）必须全程使用简体中文，从第一个字起就是中文，不得出现英文推理，禁止先英文思考再翻译。
2. 分析、计划、工具调用前后的推理、错误排查与自我检查，全部使用简体中文；提问、代码、日志、文件名或工具结果为英文时也不例外。
3. 回复使用与用户提问相同的语言；无法判断时默认简体中文。代码、标识符、文件路径、命令与报错原文保持原样，不翻译。`

/**
 * 按档位生成强制指令：`zh` 为三条中文思考强制，`en` 只保留回复条款（同样中文表述）。
 * @param language - 归一化后的档位。
 */
export function injectionTextFor(language: ThinkingLanguage): string {
  return language === 'en' ? EN_INJECTION_TEXT : ZH_INJECTION_TEXT
}

/** 默认注入文本（= 默认档 `en` 的文本）。 */
export const DEFAULT_INJECTION_TEXT = injectionTextFor(DEFAULT_THINKING_LANGUAGE)

/** 归一化后的生效配置。 */
export interface ResolvedConfig {
  /** 是否向每次请求的 system prompt 注入语言指令。 */
  injectPrompt: boolean
  /** 生效的注入文本：自定义文本非空时优先，否则由 `thinkingLanguage` 推导。 */
  injectionText: string
  /** 是否在每轮请求的用户消息前额外注入（agent/pre-step 瀑布，高显著通道）。 */
  injectPerTurn: boolean
  /** 思考语言档位。 */
  thinkingLanguage: ThinkingLanguage
}

export const DEFAULT_CONFIG: ResolvedConfig = {
  injectPrompt: true,
  injectionText: DEFAULT_INJECTION_TEXT,
  injectPerTurn: false,
  thinkingLanguage: DEFAULT_THINKING_LANGUAGE,
}

/**
 * schemastery 的 `.volatile()` 是 ≥3.18.3 的能力；宿主内置更旧版本时模块加载期直接
 * 调用会在 import 期抛 TypeError、插件整体加载失败（与「静态注入兼容 0.1.0-rc.6」的
 * 承诺冲突）。加载期做特性探测，不支持时字段退化为普通值——仅失去「设置页改完即时
 * 切换」，静态注入不受影响。
 */
export const VOLATILE_SUPPORTED = typeof (z.string() as { volatile?: unknown }).volatile === 'function'

/**
 * 对 schema 字段应用 `.volatile()`（宿主支持时）；不支持时原样返回普通字段。
 * @param field - 待修饰的 schema 字段。
 */
export function applyVolatile<T>(field: T): T {
  if (typeof (field as { volatile?: unknown } | undefined)?.volatile === 'function') {
    return (field as unknown as { volatile: () => T }).volatile()
  }
  return field
}

/** 宿主 Loader 解析 profile patch 中本条目 config 所用的 schema。 */
export const Config = z.object({
  injectPrompt: z.boolean().default(DEFAULT_CONFIG.injectPrompt),
  injectionText: z.string().default(''),
  injectPerTurn: z.boolean().default(DEFAULT_CONFIG.injectPerTurn),
  thinkingLanguage: applyVolatile(z.string().default(DEFAULT_THINKING_LANGUAGE)),
})

/** 来自 YAML／宿主的原始配置：字段类型不可信，一律按 unknown 处理。 */
export interface RawConfigInput {
  injectPrompt?: unknown
  injectionText?: unknown
  injectPerTurn?: unknown
  thinkingLanguage?: unknown
}

/**
 * 白名单归一：大小写与首尾空白不敏感（手写 YAML 的 `EN` 按用户意图归为 `en`）；
 * 白名单外一律回退默认档（YAML null／错拼不抛错）。
 */
export function normalizeThinkingLanguage(value: unknown): ThinkingLanguage {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return (THINKING_LANGUAGES as readonly string[]).includes(raw) ? (raw as ThinkingLanguage) : DEFAULT_THINKING_LANGUAGE
}

/**
 * 合并默认值并校验：非布尔回退默认；`injectionText` 空白视作未自定义，
 * 此时按 `thinkingLanguage` 生成文本。
 *
 * 输入统一先解 volatile 引用：宿主 schema 解析后，volatile 字段（连带其默认值）
 * 一律是 `{ get() }` 引用，直接当值用会静默回退默认档。
 */
export function resolveConfig(input?: RawConfigInput): ResolvedConfig {
  const resolved: ResolvedConfig = {
    injectPrompt: toBoolean(readVolatile(input?.injectPrompt), DEFAULT_CONFIG.injectPrompt),
    injectionText: '',
    injectPerTurn: toBoolean(readVolatile(input?.injectPerTurn), DEFAULT_CONFIG.injectPerTurn),
    thinkingLanguage: normalizeThinkingLanguage(readVolatile(input?.thinkingLanguage)),
  }
  const rawText = readVolatile(input?.injectionText)
  const custom = typeof rawText === 'string' ? rawText.trim() : ''
  resolved.injectionText = custom.length > 0 ? custom : injectionTextFor(resolved.thinkingLanguage)
  return resolved
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

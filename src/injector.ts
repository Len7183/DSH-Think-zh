import type { MinimalContext } from './types.js'

export const PROMPT_SECTION_NAME = 'dsh-think-zh/language'
/** persona 为 0，工具声明 100-199；取 2 保证在 persona 之后、工具之前。 */
export const PROMPT_SECTION_ORDER = 2

/**
 * 向 host 的 systemPrompt 服务注册中文指令 section。
 * 注册失败记 warn 并降级为不注入，绝不抛出（防御式）。
 * @returns 注册的 disposer（失败时为空函数）。
 */
export function registerLanguageInjection(ctx: MinimalContext, text: string): () => void {
  try {
    return ctx.systemPrompt.section({
      name: PROMPT_SECTION_NAME,
      order: PROMPT_SECTION_ORDER,
      text,
    })
  } catch (error: unknown) {
    ctx.logger.warn(`dsh-think-zh: 注册 system prompt section 失败，降级为不注入: ${String(error)}`)
    return () => {}
  }
}

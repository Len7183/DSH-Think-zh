import { resolveConfig, type Config } from './config.js'
import { registerLanguageInjection } from './injector.js'
import type { MinimalContext } from './types.js'

export const name = 'dsh-think-zh'

/** 插件入口：按配置挂载注入器（唯一机制：请求侧指令注入）。 */
export function apply(ctx: MinimalContext, config?: Partial<Config>): void {
  const resolved = resolveConfig(config)
  if (resolved.injectPrompt) {
    registerLanguageInjection(ctx, resolved.injectionText)
  }
}

/**
 * dsh-think-zh 使用的最小宿主接口。
 * 只声明本插件实际调用的形状，避免引入 DSH 子包作为构建依赖（零 runtime 依赖）。
 */

export interface MinimalContext {
  systemPrompt: {
    section(section: { name: string; order: number; text: string }): () => void
  }
  logger: {
    warn(...args: unknown[]): void
  }
}

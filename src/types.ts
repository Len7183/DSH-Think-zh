/**
 * dsh-think-zh 使用的最小宿主接口。
 * 只声明本插件实际调用的形状，避免引入 DSH 子包作为构建依赖（零 runtime 依赖）。
 */

export interface SessionLike {
  readonly id: string
  append(type: string, data: unknown, opts?: unknown): void
}

export interface SessionEventLike {
  type: string
  seq: number
  data: any
}

export interface MinimalContext {
  on(event: string, handler: (session: SessionLike, event: SessionEventLike) => void): () => void
  systemPrompt: {
    section(section: { name: string; order: number; text: string }): () => void
  }
  logger: {
    warn(...args: unknown[]): void
  }
}

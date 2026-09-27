/**
 * dsh-think-zh 使用的最小宿主接口。
 * 只声明本插件实际调用的形状，避免引入 DSH 子包作为构建依赖（零 runtime 依赖）。
 */

/** 注册到 host systemPrompt 服务的 section 形状。 */
export interface PromptSectionLike {
  /** 唯一名称——重复注册会抛错。 */
  readonly name: string
  /** 组装顺序（升序拼接）；约定 persona 为 0、工具指引 1000+。 */
  readonly order: number
  /**
   * 注入文本：字符串，或每次组装现读的提供者。
   * 宿主以 `section.text(context)` 调用提供者（忽略其入参即可）。
   */
  readonly text: string | (() => string)
}

/** agent/pre-step 瀑布（prepend）的最小结构声明——避免引入 dsh-agent 包（零 runtime 依赖）。 */
export interface PreStepPayloadLike {
  signal?: { aborted?: boolean }
}

/** pre-step 决策的最小结构声明。 */
export interface PreStepDecisionLike {
  kind?: string
  messages?: Array<{
    id?: string
    role?: string
    source?: { kind?: string }
    content?: Array<{ type?: string; text?: string }>
  }>
}

export interface MinimalContext {
  systemPrompt: {
    section(section: PromptSectionLike): () => void
  }
  /** host 提供 agent/pre-step 瀑布时注册 per-turn 注入；缺失时降级跳过。 */
  on?: (
    event: 'agent/pre-step',
    handler: (payload: PreStepPayloadLike, next: () => Promise<PreStepDecisionLike>) => Promise<PreStepDecisionLike>,
    opts?: { prepend?: boolean },
  ) => unknown
  logger: {
    error(...args: unknown[]): void
  }
}

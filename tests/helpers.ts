import { vi } from 'vitest'
import type { MinimalContext, SessionEventLike, SessionLike } from '../src/types.js'

export interface MockContext extends MinimalContext {
  handlers: Record<string, Array<(session: SessionLike, event: SessionEventLike) => void>>
  systemPrompt: { section: ReturnType<typeof vi.fn> }
  logger: { warn: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> }
  /** 向某事件名的所有 handler 派发一次事件。 */
  emit(eventName: string, session: SessionLike, event: SessionEventLike): void
}

export function createMockContext(): MockContext {
  const handlers: MockContext['handlers'] = {}
  const ctx = {
    handlers,
    on: (eventName: string, handler: (session: SessionLike, event: SessionEventLike) => void) => {
      ;(handlers[eventName] ??= []).push(handler)
      return () => {
        handlers[eventName] = handlers[eventName].filter((h) => h !== handler)
      }
    },
    systemPrompt: { section: vi.fn(() => vi.fn()) },
    logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
    emit(eventName: string, session: SessionLike, event: SessionEventLike) {
      for (const handler of handlers[eventName] ?? []) handler(session, event)
    },
  }
  return ctx as MockContext
}

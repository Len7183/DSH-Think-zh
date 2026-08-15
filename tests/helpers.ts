import { vi } from 'vitest'
import type { MinimalContext } from '../src/types.js'

export interface MockContext extends MinimalContext {
  systemPrompt: { section: ReturnType<typeof vi.fn> }
  logger: { warn: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> }
}

export function createMockContext(): MockContext {
  const ctx = {
    systemPrompt: { section: vi.fn(() => vi.fn()) },
    logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
  }
  return ctx as MockContext
}

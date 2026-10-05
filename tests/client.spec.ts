import { beforeAll, describe, expect, it, vi } from 'vitest'
import { THINKING_LANGUAGES } from '../src/config.js'

interface ClientModule {
  inject: string[]
  apply(ctx: unknown): void
  THINKING_LANGUAGE_OPTIONS: ReadonlyArray<{ id: string; label: string }>
}

/** 客户端 bundle 以 window.__ModuleLoader__.load 自注册；测试据此捕获 factory。 */
interface LoaderDefinition {
  id: string
  factory(require: (id: string) => unknown): ClientModule
}

let definition: LoaderDefinition
let client: ClientModule

/** 最小 React 替身：模块初始化期只会引用这些成员，测试不渲染组件。 */
const reactStub = {
  createElement: (...args: unknown[]) => ({ type: args[0], args }),
  useState: () => [undefined, () => {}],
  useEffect: () => {},
  useRef: () => ({ current: null }),
  useCallback: (fn: unknown) => fn,
  useSyncExternalStore: () => undefined,
}

beforeAll(async () => {
  const captured: LoaderDefinition[] = []
  ;(globalThis as { window?: unknown }).window = {
    __ModuleLoader__: {
      load: (def: LoaderDefinition) => {
        captured.push(def)
      },
    },
  }
  await import('../client.js')
  expect(captured).toHaveLength(1)
  definition = captured[0]
  client = definition.factory((id: string) => {
    if (id === 'react') return reactStub
    throw new Error(`unexpected require: ${id}`)
  })
})

describe('client bundle', () => {
  it('以包名注册 factory（模块 id 必须等于包名）', () => {
    expect(definition.id).toBe('dsh-think-zh')
  })
  it('只 inject 官方 client 服务，不 require 宿主 Client 包', () => {
    expect(client.inject).toEqual(['slots', 'locale', 'remote', 'configForms'])
  })
})

describe('apply', () => {
  /** 记录注册面的最小 ctx 替身。 */
  function createCtx() {
    const registered: Array<{ options: Record<string, unknown>; component: unknown }> = []
    const injected: string[] = []
    const localeRegistrations: Array<[string, Record<string, Record<string, string>>]> = []
    const effects: string[] = []
    const form = {
      getSnapshot: vi.fn(() => ({ status: 'ready', writable: true, value: { thinkingLanguage: 'zh' } })),
      subscribe: vi.fn(() => () => {}),
      set: vi.fn(async () => true),
    }
    const ctx = {
      configForms: { get: vi.fn(() => form) },
      locale: {
        register: vi.fn((ns: string, dicts: Record<string, Record<string, string>>) => {
          localeRegistrations.push([ns, dicts])
          return () => {}
        }),
      },
      slots: {
        inject: vi.fn((key: string, install: () => unknown) => {
          injected.push(key)
          install()
        }),
        register: vi.fn((options: Record<string, unknown>, component: unknown) => {
          registered.push({ options, component })
          return () => {}
        }),
      },
      effect: vi.fn((fn: () => unknown, label: string) => {
        effects.push(label)
        return fn()
      }),
    }
    return { ctx, registered, injected, localeRegistrations, effects, form }
  }

  it('注册「思考语言」行到通用分区的 item 槽（语言行 0 与外观行 10 之间）', () => {
    const { ctx, registered, injected } = createCtx()
    client.apply(ctx as never)
    expect(injected).toEqual(['settings.general.item'])
    expect(registered).toHaveLength(1)
    expect(registered[0].options).toEqual({
      name: 'settings.general.item',
      id: 'thinking-language',
      order: 5,
      locale: 'settings.thinking-language',
    })
    expect(registered[0].component).toBeTypeOf('function')
  })

  it('按 profile 条目 id 取表单，并注册中英文案字典', () => {
    const { ctx, localeRegistrations } = createCtx()
    client.apply(ctx as never)
    expect(ctx.configForms.get).toHaveBeenCalledWith('dsh-think-zh')
    expect(localeRegistrations).toHaveLength(1)
    const [ns, dicts] = localeRegistrations[0]
    expect(ns).toBe('settings.thinking-language')
    expect(dicts.zh['thinkingLanguage.title']).toBe('思考语言')
    expect(dicts.en['thinkingLanguage.title']).toBe('Thinking language')
  })

  it('中英文案键集一致（en 不得漏键）', () => {
    const { ctx, localeRegistrations } = createCtx()
    client.apply(ctx as never)
    const [, dicts] = localeRegistrations[0]
    expect(Object.keys(dicts.en).sort()).toEqual(Object.keys(dicts.zh).sort())
  })
})

describe('档位表', () => {
  it('id 序列与 host 侧 THINKING_LANGUAGES 完全一致', () => {
    expect(client.THINKING_LANGUAGE_OPTIONS.map((option) => option.id)).toEqual([...THINKING_LANGUAGES])
  })
  it('标签与规格一致，且表已冻结', () => {
    expect(client.THINKING_LANGUAGE_OPTIONS.map((option) => option.label)).toEqual(['默认英文', '简体中文'])
    expect(Object.isFrozen(client.THINKING_LANGUAGE_OPTIONS)).toBe(true)
  })
})

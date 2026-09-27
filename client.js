/**
 * dsh-think-zh — Client 半（Web）
 *
 * 在「设置 → 通用」注册「思考语言」行：标记与样式复刻相邻的「语言」行
 * （dsh-client-locale 的 LanguageRow），类名换成本插件前缀，颜色/圆角只用
 * `--dsw-alias-*` token。取值走官方 settings 服务（ctx.configForms），写入 profile
 * 条目 config 的 volatile 字段，因此改完即时生效、不重挂插件。
 *
 * 约束：本文件是宿主直接装载的零构建产物（window.__ModuleLoader__.load），只
 * require 平台表内的 'react'；不 require 任何 Harness Client 包（含
 * dsh-client-ui-primitives），控件按插件开发规范的 UI 规则自绘。
 */
window.__ModuleLoader__.load({
  id: 'dsh-think-zh',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useRef, useState, useSyncExternalStore } = React

    /** 设置命名空间 = 本插件在 profile 里的条目 id。 */
    const NAMESPACE = 'dsh-think-zh'
    /** 承载档位的 volatile 字段名。 */
    const FIELD = 'thinkingLanguage'
    /** 本插件设置行文案的 locale 命名空间。 */
    const LOCALE_NS = 'settings.thinking-language'
    const STYLE_ID = 'dsh-think-zh-settings-css'
    const MENU_GAP = 4
    const VIEWPORT_MARGIN = 12

    /**
     * 档位表。id 序列必须与 host 侧 src/config.ts 的 THINKING_LANGUAGES 一致，
     * 由 tests/client.spec.ts 锁定；标签是固定文案（同「语言」行的 中文/English）。
     */
    const THINKING_LANGUAGE_OPTIONS = Object.freeze([
      Object.freeze({ id: 'zh', label: '简体中文' }),
      Object.freeze({ id: 'en', label: '默认英文' }),
    ])
    const DEFAULT_ID = THINKING_LANGUAGE_OPTIONS[0].id

    /** zh 是键集真源，en 必须同键集。 */
    const DICT = {
      zh: {
        'thinkingLanguage.title': '思考语言',
        'thinkingLanguage.saveFailed': '保存失败，请重试',
      },
      en: {
        'thinkingLanguage.title': 'Thinking language',
        'thinkingLanguage.saveFailed': 'Save failed, retry',
      },
    }
    /** locale 服务缺失时的回退标题。 */
    const FALLBACK_TITLE = DICT.zh['thinkingLanguage.title']

    /** 复刻 dsh-client-locale LanguageRow 的行样式（只保留 --dsw-alias-* token）。 */
    const CSS = [
      '.dtz-row{border-bottom:.5px solid var(--dsw-alias-border-l2);align-items:center;gap:8px;padding:16px 0;display:flex}',
      '.dtz-rowText{flex-direction:column;flex:1;gap:4px;min-width:0;padding-right:48px;display:flex}',
      '.dtz-title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px}',
      '.dtz-hint{color:var(--dsw-alias-label-primary);opacity:.6;font-size:12px;line-height:18px}',
      '.dtz-control{position:relative;display:flex}',
      '.dtz-selector{border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-module-platform);height:36px;font:inherit;color:var(--dsw-alias-label-primary);cursor:pointer;border:none;align-items:center;gap:12px;padding:0 14px;font-size:14px;line-height:22px;display:inline-flex}',
      '.dtz-selector:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.dtz-selector:disabled{cursor:default;opacity:.5}',
      '.dtz-chevron{flex:none}',
      '.dtz-menu{position:fixed;z-index:1000;min-width:140px;padding:4px;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-module-platform);box-shadow:0 6px 20px rgba(0,0,0,.18);display:flex;flex-direction:column;gap:2px}',
      '.dtz-item{display:flex;align-items:center;justify-content:space-between;gap:12px;height:32px;padding:0 10px;border:none;border-radius:var(--dsw-radius-md);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;line-height:22px;text-align:left;cursor:pointer}',
      '.dtz-item:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.dtz-item:disabled{cursor:default;opacity:.5}',
      '.dtz-item:focus-visible{outline:2px solid var(--dsw-alias-text-accent);outline-offset:-2px}',
      '.dtz-item[aria-checked="true"]{font-weight:500}',
    ].join('')

    const CHEVRON_D = 'M4 6L7.29289 9.29289C7.68342 9.68342 8.31658 9.68342 8.70711 9.29289L12 6'
    const CHECK_D = 'M2.25 8.5L5.49732 11.7473C5.90519 12.1552 6.57263 12.1344 6.95426 11.7018L13.75 4'

    /** 语言行的 chevron 图标（path 取自宿主 primitives，避免跨包 require）。 */
    function chevron() {
      return h(
        'svg',
        { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', strokeWidth: 1, 'aria-hidden': true, className: 'dtz-chevron' },
        h('path', { d: CHEVRON_D, stroke: 'currentColor' }),
      )
    }

    /** 选中项勾标。 */
    function check() {
      return h(
        'svg',
        { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', strokeWidth: 1, 'aria-hidden': true },
        h('path', { d: CHECK_D, stroke: 'currentColor' }),
      )
    }

    /** 注入行样式（幂等：同一标签只插一次）。 */
    function ensureStyles() {
      if (typeof document === 'undefined') return
      if (document.querySelector('style[data-plugin-css="' + STYLE_ID + '"]') !== null) return
      const tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-think-zh'
      tag.dataset.pluginCss = STYLE_ID
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    /**
     * 取生效档位：宿主文档里的值必须落在档位表内，否则（未设置/非法）回退默认档。
     * @param snapshot - configForms 快照。
     */
    function pickId(snapshot) {
      const value = snapshot !== undefined && snapshot !== null ? snapshot.value : undefined
      const raw = value !== null && typeof value === 'object' ? value[FIELD] : undefined
      return THINKING_LANGUAGE_OPTIONS.some((option) => option.id === raw) ? raw : DEFAULT_ID
    }

    /**
     * 渲染「思考语言」行。
     * @param props - slot props（含 locale 绑定后的 t）与闭包传入的 form。
     */
    function ThinkingLanguageRow({ form, t }) {
      const subscribe = useCallback((onChange) => form.subscribe(onChange), [form])
      const getSnapshot = useCallback(() => form.getSnapshot(), [form])
      const snapshot = useSyncExternalStore(subscribe, getSnapshot)

      const [open, setOpen] = useState(false)
      const [pending, setPending] = useState(false)
      const [failed, setFailed] = useState(false)
      const [position, setPosition] = useState(null)
      const controlRef = useRef(null)
      const triggerRef = useRef(null)
      const menuRef = useRef(null)

      const activeId = pickId(snapshot)
      const activeLabel = (THINKING_LANGUAGE_OPTIONS.find((option) => option.id === activeId) ?? THINKING_LANGUAGE_OPTIONS[0]).label
      const writable = snapshot !== undefined && snapshot !== null && snapshot.writable === true
      const disabled = pending || !writable
      const title = typeof t === 'function' ? t('thinkingLanguage.title') : FALLBACK_TITLE
      const failedText = typeof t === 'function' ? t('thinkingLanguage.saveFailed') : DICT.zh['thinkingLanguage.saveFailed']

      // 打开时按触发器位置定位：fixed + 视口夹取，避免设置内容栏裁剪。
      useEffect(() => {
        if (!open) {
          setPosition(null)
          return
        }
        const rect = triggerRef.current?.getBoundingClientRect()
        if (rect === undefined) return
        setPosition({
          top: Math.round(rect.bottom + MENU_GAP),
          right: Math.max(VIEWPORT_MARGIN, Math.round(window.innerWidth - rect.right)),
        })
      }, [open])

      // Escape 关闭并回焦触发器；点在行外/菜单外也关闭。
      useEffect(() => {
        if (!open) return undefined
        const onKeyDown = (event) => {
          if (event.key !== 'Escape') return
          event.stopPropagation()
          setOpen(false)
          triggerRef.current?.focus()
        }
        const onPointerDown = (event) => {
          const target = event.target
          if (controlRef.current?.contains(target) === true || menuRef.current?.contains(target) === true) return
          setOpen(false)
        }
        document.addEventListener('keydown', onKeyDown, true)
        document.addEventListener('pointerdown', onPointerDown, true)
        return () => {
          document.removeEventListener('keydown', onKeyDown, true)
          document.removeEventListener('pointerdown', onPointerDown, true)
        }
      }, [open])

      /** 菜单内方向键遍历（Enter/Space 由 button 自身处理）。 */
      const onMenuKeyDown = (event) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
        event.preventDefault()
        const rows = menuRef.current?.querySelectorAll('button[role="menuitemradio"]')
        if (rows === undefined || rows.length === 0) return
        const current = Array.prototype.indexOf.call(rows, document.activeElement)
        const step = event.key === 'ArrowDown' ? 1 : -1
        const next = current === -1 ? 0 : (current + step + rows.length) % rows.length
        rows[next].focus()
      }

      /** 提交选择：写 volatile 字段；被拒绝时回读并提示重试。 */
      const select = async (id) => {
        triggerRef.current?.focus()
        setOpen(false)
        if (id === activeId || disabled) return
        setPending(true)
        setFailed(false)
        try {
          const accepted = await form.set(FIELD, id)
          if (accepted !== true) setFailed(true)
        } catch {
          setFailed(true)
        } finally {
          setPending(false)
        }
      }

      const items = THINKING_LANGUAGE_OPTIONS.map((option) =>
        h(
          'button',
          {
            key: option.id,
            type: 'button',
            role: 'menuitemradio',
            'aria-checked': option.id === activeId,
            className: 'dtz-item',
            disabled,
            onClick: () => void select(option.id),
          },
          h('span', null, option.label),
          option.id === activeId ? check() : null,
        ),
      )

      return h(
        'div',
        { className: 'dtz-row' },
        h(
          'div',
          { className: 'dtz-rowText' },
          h('div', { className: 'dtz-title' }, title),
          failed ? h('div', { className: 'dtz-hint' }, failedText) : null,
        ),
        h(
          'div',
          { className: 'dtz-control', ref: controlRef },
          h(
            'button',
            {
              ref: triggerRef,
              type: 'button',
              className: 'dtz-selector',
              disabled,
              'aria-haspopup': 'menu',
              'aria-expanded': open,
              onClick: () => setOpen((value) => !value),
            },
            activeLabel,
            chevron(),
          ),
          open
            ? h(
                'div',
                {
                  ref: menuRef,
                  className: 'dtz-menu',
                  role: 'menu',
                  onKeyDown: onMenuKeyDown,
                  style:
                    position === null
                      ? { visibility: 'hidden', top: 0, right: VIEWPORT_MARGIN }
                      : { top: position.top, right: position.right },
                },
                items,
              )
            : null,
        ),
      )
    }

    return {
      inject: ['slots', 'locale', 'remote', 'configForms'],
      /**
       * 注册设置行与字典。
       * @param ctx - client cordis 上下文。
       */
      apply(ctx) {
        ctx.effect(() => {
          ensureStyles()
          return () => {
            if (typeof document === 'undefined') return
            document.querySelector('style[data-plugin-css="' + STYLE_ID + '"]')?.remove()
          }
        }, 'dsh-think-zh: settings row styles')
        const form = ctx.configForms.get(NAMESPACE)
        ctx.effect(() => ctx.locale.register(LOCALE_NS, DICT), 'dsh-think-zh: dictionary')
        /** 组件身份在 apply 期固定（form 经闭包注入，避免每次渲染重挂）。 */
        const Row = (props) => h(ThinkingLanguageRow, { ...props, form })
        ctx.slots.inject('settings.general.item', () =>
          ctx.slots.register(
            { name: 'settings.general.item', id: 'thinking-language', order: 5, locale: LOCALE_NS },
            Row,
          ),
        )
      },
      /** 档位表的导出面：供单测锁定与 host 侧一致。 */
      THINKING_LANGUAGE_OPTIONS,
    }
  },
})

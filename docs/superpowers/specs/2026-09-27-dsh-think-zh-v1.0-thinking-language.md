# dsh-think-zh 1.0 设计说明：思考语言设置项

日期：2026-09-27
状态：已批准并实现（1.0.0）

## 目标

在 Web GUI 的「设置 → 通用」增加一行「思考语言」，样式与相邻的「语言」行一致，选择后即时生效、
随 profile 持久化。两档（用户定稿）：

- `简体中文`（默认）：
  ```
  语言要求（强制）：
  1. 思考（reasoning）必须使用简体中文。
  2. 回复使用与用户提问相同的语言；无法判断时默认简体中文。代码、标识符、文件路径、命令等保持原文，不翻译。
  ```
- `默认英文`：
  ```
  语言要求（强制）：
  1. 回复使用与用户提问相同的语言；无法判断时默认简体中文。代码、标识符、文件路径、命令等保持原文，不翻译。
  ```

## 宿主事实（本机 DSH 0.1.7-rc.2 / schemastery 3.18.4，逐条读安装产物源码得出）

| 事实 | 出处 |
|---|---|
| 通用分区的行来自 list 槽 `settings.general.item` | `dsh-client-ui-settings-general/lib/client.js:1173`、`:634` |
| 现有 order：语言 0、外观 10、字号 11、代码工作工具 15、版本 100 | locale `client.js:1553`；ui-theme `client.js:1603/1618`；ui-settings-general `client.js:953/963` |
| 「语言」行的标记与 CSS 可整段复刻（`.row/.rowText/.title/.selector/.chevron`） | locale `client.js:1027`、`:1056-1097` |
| `ctx.systemPrompt.section()` 的 `text` 可为函数，每次组装求值 | `dsh-system-prompt/lib/index.js:342` |
| `.volatile()` 字段（**连默认值**）解析为 `{ get(), [Symbol(cosmokit.volatile.write)] }` 引用 | schemastery `src/index.ts:769`、`:480-483`；单测实证（`tests/config.spec.ts`） |
| Client 表单：`ctx.configForms.get(entryId)` → `getSnapshot()/{status,value,revision,writable,mode}`、`subscribe()`、`set(field,value)` | `dsh-client-ui-settings/lib/client.js:1086-1194`、`:1309` |
| Client bundle 形如 `window.__ModuleLoader__.load({ id: '<包名>', factory(require) })`，`require('react')` 在平台表内 | 官方模板 `templates/decoration/client.js`；`@vlln/dsh-navbar/lib/client.js` |
| 不要 `require('@deepseek-ai/dsh-client-ui-primitives')`，自绘并复刻宿主控件 | `skills/cordis-plugin-development/references/practices.md:35` |

## Host 半设计

- `src/config.ts`：导出宿主用 schema
  `Config = z.object({ injectPrompt, injectionText, injectPerTurn, thinkingLanguage: z.string().default('zh').volatile() })`；
  纯函数 `resolveConfig` 是运行时入口，内部对每个字段先 `readVolatile` 再归一 —— 解引用收在一处，
  调用方不可能漏掉（这是实现期发现的关键点：schema 解析后 volatile 字段永不是裸值）。
- `src/runtime.ts`：`readVolatile(ref)`，兼容 `{ get() }` 与裸值，异常回退 `undefined`。
- `src/injector.ts` / `src/preturn.ts`：接收文本提供者 `() => string`，宿主每次组装/每轮现读。
- `src/index.ts`：`apply` 只解析一次用于开关判断；注入文本每次现读 `resolveConfig(config)`。

## Client 半设计

`client.js`（包根，零构建，`window.__ModuleLoader__.load`）：

- `inject: ['slots', 'locale', 'remote', 'configForms']`，只 `require('react')`。
- `ctx.slots.inject('settings.general.item', …)` 注册 `{ id: 'thinking-language', order: 5, locale: 'settings.thinking-language' }`。
- 组件用 `useSyncExternalStore(form.subscribe, form.getSnapshot)` 订阅；`form.set('thinkingLanguage', id)` 写入；
  写入中禁用、失败提示重试；`snapshot.writable !== true` 时禁用。
- 下拉自绘：`aria-haspopup/aria-expanded`、`role="menu"`、`role="menuitemradio" aria-checked`、
  Escape 关闭并回焦、点击外部关闭、方向键遍历、`position: fixed` + 视口夹取（避免设置内容栏裁剪）。
- 图标 path 取自宿主 primitives 的实现（chevron / check），避免跨包 require。

## 数据流

```
下拉选择 → form.set('thinkingLanguage', id)
        → remote.settings.mutate('dsh-think-zh', [{op:'set',path:['thinkingLanguage'],value:id}], revision)
        → config-editor 校验并写 profile 的 cordis.patch.yml → Loader 更新条目 config
        → volatile 引用变化（插件不重挂）
        → 下个模型步骤 systemPrompt.assemble() 调 section.text() → 现读 → 新文本
```

## 边界与失败模式

- 档位非法/缺失 → 归一 `zh`；volatile 读取异常 → `undefined` → `zh`。
- `injectionText` 非空 → 整段用户自定义文本优先，档位被忽略（向后兼容）。
- `configForms` 不可用（非 loopback / 远程浏览器）→ `writable !== true` → 控件禁用，显示当前档。
- 写入被更高层 patch 覆盖 → `set` 返回 false → 回读快照并提示重试。
- 停用插件 → slot 条目、`<style>`、locale 字典随对应 ctx 注册回收。

## 测试与验收

- 单测 49 例（config / injector / preturn / index / client），含「volatile 引用现读使同一 section 换文本」。
- 端到端：安装进 profile → 设置页出现该行 → 切档 → 核对 patch 中 `thinkingLanguage` → 轨迹视图确认 section 文本变化。

## 实现期真机验证（2026-09-27）

用宿主安装目录里的真实 cordis 4.0.4 + `dsh-system-prompt` 加载构建产物 `lib/index.js`，
走 Loader 等价路径（原始 config → 插件导出的 `Config` schema 解析出 volatile 引用 → 写入该引用 → 重新组装）：

| 检查 | 结果 |
|---|---|
| 插件 fiber | `state=2`（ACTIVE），config 由 schema 解析为 4 个字段 |
| `thinkingLanguage` 类型 | volatile 引用（带 `Symbol(cosmokit.volatile.write)`），`get()='zh'` |
| 初始组装 | section `dsh-think-zh/language` = zh 档两条 |
| 写入 `en`（**未重挂插件**） | 同一 section 的下一次组装 = 仅回复条款 |
| 切回 `zh` | 两条回归 |
| 写入非法值 `zzz` | 回退 zh 档文本 |

结论：从「宿主设置写入」到「system prompt 文本变化」的机制链在真实宿主上闭合。
未覆盖部分：GUI 交互与 profile patch 落盘（需安装进 profile 后实测）。


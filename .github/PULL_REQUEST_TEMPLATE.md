## 改动内容

<!-- 一句话：改了什么、为什么。涉及行为变化请写明对现有用户的影响。 -->

## 自检清单

- [ ] 改过 `src/` 后重新跑了 `npm run build`，并把 `lib/` 产物一并提交 —— GitHub 安装方式直接消费包内 `lib/`，产物缺失或落后于源码会让 Harness 启动失败或加载旧逻辑
- [ ] 若改动涉及 host 与 client 的共享常量（档位表、字段名 `thinkingLanguage`、section 名、order），`client.js` 与 `src/` 两侧已同步（`tests/client.spec.ts` 锁定该一致性）
- [ ] 若改了 `src/config.ts` 的 `Config` schema，确认 `Config` 仍从包入口 `src/index.ts` 再导出 —— Loader 只读入口契约，漏导出会让设置写入静默失效
- [ ] `npm run typecheck`、`npm test` 本地全绿
- [ ] `CHANGELOG.md` 已记录本次变更（新版本段落或 Unreleased）
- [ ] 未提交本机绝对路径、token、或 profile 私有配置

## 关联 issue

<!-- 无则删除本节 -->

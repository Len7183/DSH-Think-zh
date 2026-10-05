import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['lib/', 'coverage/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // client.js 是浏览器全局脚本（window.__ModuleLoader__.load 自注册）。
    files: ['client.js'],
    languageOptions: { globals: { ...globals.browser, __ModuleLoader__: 'readonly' } },
  },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // client.js 内的 React hooks 与 tests 中的 React 替身都按 hooks 规则检查。
    files: ['client.js', 'tests/**/*.ts'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
)

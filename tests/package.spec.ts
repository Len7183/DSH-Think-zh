import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

interface Pkg {
  version: string
  scripts: Record<string, string | undefined>
  files: string[]
}

/** package.json 契约：安装方式（git-hosted）与打包清单依赖这些字段，漂移即安装事故。 */
const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
) as Pkg

describe('package.json 安装契约', () => {
  it('版本为 1.1.0', () => {
    expect(pkg.version).toBe('1.1.0')
  })
  it('不含 prepare 脚本：git 安装不触发构建，pnpm 不再要求 allowBuilds 白名单（Issues #3/#4）', () => {
    expect(pkg.scripts.prepare).toBeUndefined()
    expect(pkg.scripts.prepublish).toBeUndefined()
    expect(pkg.scripts.postinstall).toBeUndefined()
  })
  it('client.js 声明为唯一副作用文件（顶层 window.__ModuleLoader__.load 注册）', () => {
    expect(pkg.sideEffects).toEqual(['./client.js'])
  })
  it('打包清单包含安装所需的全部文件', () => {
    expect(pkg.files).toEqual(expect.arrayContaining(['lib', 'client.js', 'cordis.patch.yml', 'README.md']))
  })
})

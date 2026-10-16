import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * 令牌层静态自查
 * ------------------------------------------------------------------
 * 1. 全仓库 var(--ui-*) 引用集合 ⊆ tokens.css 定义集合——差集必须为空。
 *    上一次的缺陷正是 --ui-text-tertiary 被 5 个组件引用却没人定义。
 * 2. 除 tokens.css 外，不允许出现硬编码十六进制颜色与 font-size:Npx。
 * ------------------------------------------------------------------
 */

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const SRC = join(ROOT, 'src')
const TOKENS = join(SRC, 'styles', 'tokens.css')

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.(vue|css|js)$/.test(name)) out.push(full)
  }
  return out
}

const files = [...walk(SRC), join(ROOT, 'index.html')]

function collect(source, regex) {
  const set = new Set()
  for (const match of source.matchAll(regex)) set.add(match[1])
  return set
}

/** tokens.css 里的定义：行首 `--ui-x:` */
const definitions = collect(readFileSync(TOKENS, 'utf8'), /^\s*(--ui-[A-Za-z0-9-]+)\s*:/gm)

/** 全仓库的引用：var(--ui-x) */
const references = new Set()
for (const file of files) {
  for (const name of collect(readFileSync(file, 'utf8'), /var\(\s*(--ui-[A-Za-z0-9-]+)/g)) {
    references.add(name)
  }
}

describe('设计令牌', () => {
  it('引用集合 ⊆ 定义集合（差集为空）', () => {
    const missing = [...references].filter((name) => !definitions.has(name)).sort()
    console.log(`[tokens] 定义 ${definitions.size} 个 / 引用 ${references.size} 个 / 未定义引用 ${missing.length} 个`)
    expect(missing).toEqual([])
  })

  it('文本层级统一命名已定义，旧名保留为别名', () => {
    for (const name of [
      '--ui-text-primary',
      '--ui-text-secondary',
      '--ui-text-tertiary',
      '--ui-text-caption',
      '--ui-text-dimmed',
      '--ui-text-inverted',
    ]) {
      expect(definitions.has(name)).toBe(true)
    }

    const css = readFileSync(TOKENS, 'utf8')
    expect(css).toContain('--ui-text-label-primary: var(--ui-text-primary)')
    expect(css).toContain('--ui-text-label-secondary: var(--ui-text-secondary)')
    expect(css).toContain('--ui-text-label-tertiary: var(--ui-text-tertiary)')
  })

  it('除 tokens.css 外无硬编码颜色与 px 字号', () => {
    const offenders = []
    for (const file of files) {
      if (file === TOKENS) continue
      // 移植的粒子特效（particleOrb.js）自带十六进制调色板，属第三方视觉素材，不计入令牌纪律
      if (file.endsWith('particleOrb.js')) continue
      const source = readFileSync(file, 'utf8')
      const hex = collect(source, /(#[0-9a-fA-F]{3,8})\b/g)
      const fontPx = [...source.matchAll(/font-size\s*:\s*([\d.]+px)/g)].map((m) => m[1])
      if (hex.size || fontPx.length) {
        offenders.push(`${relative(ROOT, file)}: hex=${[...hex].join(',')} fontPx=${fontPx.join(',')}`)
      }
    }
    expect(offenders).toEqual([])
  })
})

import { describe, it, expect } from 'vitest'
import { classifyIntent, matchIntent } from '../src/lib/dispatchDemo.js'

/**
 * batch 6c · 动作词门槛（台账「发现①」）
 * ------------------------------------------------------------------
 * 台账原文的复现句：只按关键词/项目信号判定时，「讲两句毕设答辩的注意事项」
 * 会被判成**委托**并派发演示卡片，而用户要的是一段真实回答。
 * batch 6c 把「动作词」变成前置于关键词与项目信号的门槛。
 *
 * 本文件把该行为钉死：负例（提问类）不得再派发，正例（委托类）不得回归。
 */

/** 负例：都应交给「织流」真实回答（fallback），本文件不 emit 任何帧 */
const NEGATIVE = [
  '讲两句毕设答辩的注意事项', // 台账原文（实测曾被误派发）
  '毕设答辩要注意什么',
  '毕业设计一般要多久', // 含团队关键词「毕业设计」，但没有动作词
  '毕设',
  '我想了解一下学习方法', // 有「想」，但完全不像项目
  '你好',
  '这个平台怎么用',
]

/** 正例：[句子, 期望判定, 说明] */
const POSITIVE = [
  ['我想做软件开发毕设', 'route'],
  ['我要做毕业设计', 'route'],
  ['帮我随便做个系统', 'confirm'],
  ['我想做个网站', 'confirm'],
  ['帮我搭一个平台', 'confirm'],
]

describe('batch 6c · 意图判定（发现① 动作词门槛）', () => {
  it('负例：提问类一律 fallback，不再误派发', () => {
    for (const text of NEGATIVE) expect(classifyIntent(text), text).toBe('fallback')
  })

  it('正例：route / confirm 行为未回归', () => {
    for (const [text, want] of POSITIVE) expect(classifyIntent(text), text).toBe(want)
  })

  it('门槛确实前置：项目信号单独出现时不得派发', () => {
    const signals = ['系统', '开发', '设计', '毕设', '项目', '平台', '网站', '小程序', '软件', '课程设计', '毕业设计']
    for (const signal of signals) {
      expect(classifyIntent(`关于${signal}`), `关于${signal}`).toBe('fallback')
    }
  })

  it('对照：旧判据（只看关键词）对该句确实会命中——证明这是真修复而非巧合', () => {
    expect(matchIntent('讲两句毕设答辩的注意事项')).toBe('毕设')
    expect(classifyIntent('讲两句毕设答辩的注意事项')).toBe('fallback')
  })
})

/**
 * groupConversations 单元测试（设计评审 P0-3）
 * ------------------------------------------------------------------
 * 分桶规则：今天 / 近 7 天 / 更早；关键词过滤标题；组内倒序；空组去掉；缺日期归「更早」。
 */
import { describe, expect, it } from 'vitest'
import { groupConversations } from '@/lib/conversationGroups'

const now = Date.now()
const iso = (offsetDays) => new Date(now - offsetDays * 86400000).toISOString()

describe('lib/groupConversations', () => {
  it('按今天 / 近 7 天 / 更早分桶，顺序固定', () => {
    const groups = groupConversations([
      { id: 'a', title: '今天的会话', createdAt: iso(0) },
      { id: 'b', title: '三天前', createdAt: iso(3) },
      { id: 'c', title: '更早', createdAt: iso(30) },
    ])
    expect(groups.map((g) => g.key)).toEqual(['today', 'week', 'earlier'])
    expect(groups.map((g) => g.label)).toEqual(['今天', '近 7 天', '更早'])
  })

  it('组内按时间倒序', () => {
    const groups = groupConversations([
      { id: 'a', title: '旧', createdAt: new Date(now - 3600000).toISOString() },
      { id: 'b', title: '新', createdAt: iso(0) },
    ])
    const today = groups.find((g) => g.key === 'today')
    expect(today.items.map((i) => i.id)).toEqual(['b', 'a'])
  })

  it('标题关键词过滤 + 空组自动去掉', () => {
    const groups = groupConversations(
      [
        { id: 'a', title: '开题报告讨论', createdAt: iso(0) },
        { id: 'b', title: '数据库设计', createdAt: iso(30) },
      ],
      '开题',
    )
    expect(groups.length).toBe(1)
    expect(groups[0].items.map((i) => i.id)).toEqual(['a'])
  })

  it('搜索无命中 → 空数组（供侧栏显示「没有匹配」）', () => {
    expect(groupConversations([{ id: 'a', title: '开题', createdAt: iso(0) }], 'zzz')).toEqual([])
  })

  it('日期缺失/非法归「更早」兜底，不崩', () => {
    const groups = groupConversations([
      { id: 'a', title: '无日期' },
      { id: 'b', title: '坏日期', createdAt: 'not-a-date' },
    ])
    expect(groups.map((g) => g.key)).toEqual(['earlier'])
    expect(groups[0].items.length).toBe(2)
  })
})

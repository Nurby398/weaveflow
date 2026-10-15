/**
 * 契约「值漂移」（缺陷 C）的前端解析测试（设计评审 P0-6）
 * ------------------------------------------------------------------
 * 后端 contract-validator 只在传入 expectedInherited 时返回 valueDrift[]，
 * 前端负责把它规范化成人能读的清单；本测试钉住解析与文案。
 */
import { describe, expect, it } from 'vitest'
import { describeValueDrift, hasContractIssues, normalizeContractDetails, pickContractFailure } from '@/lib/contract'

describe('lib/contract · valueDrift', () => {
  it('normalizeContractDetails 解析 valueDrift 条目', () => {
    const details = normalizeContractDetails({
      ok: false,
      valueDrift: [{ field: 'topic_name', expected: '校园二手交易平台', actual: '二手平台' }],
    })
    expect(details.valueDrift).toEqual([{ field: 'topic_name', expected: '校园二手交易平台', actual: '二手平台' }])
  })

  it('describeValueDrift 产出人话（标量与数组）', () => {
    expect(describeValueDrift({ field: 'topic_name', expected: 'A', actual: 'B' })).toBe(
      'topic_name 应沿用上游 A，实际是 B',
    )
    expect(describeValueDrift({ field: 'tags', expected: ['a', 'b'], actual: ['a'] })).toBe(
      'tags 应沿用上游 ["a","b"]，实际是 ["a"]',
    )
  })

  it('只有 valueDrift 也算「有内容可列」', () => {
    const details = normalizeContractDetails({ ok: false, valueDrift: [{ field: 'x', expected: 1, actual: 2 }] })
    expect(hasContractIssues(details)).toBe(true)
  })

  it('pickContractFailure 透传 valueDrift', () => {
    const failure = pickContractFailure({
      data: {
        error: {
          code: 'CONTRACT_INVALID',
          message: 'm',
          details: { ok: false, valueDrift: [{ field: 'f', expected: 1, actual: 2 }] },
        },
      },
    })
    expect(failure.valueDrift.length).toBe(1)
    expect(failure.valueDrift[0].field).toBe('f')
  })
})

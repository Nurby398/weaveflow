import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setUnauthorizedHandler } from '@/api/request'
import { pipelineApi } from '@/api'
import { setToken } from '@/utils/auth'
import {
  formatIndex,
  hasContractIssues,
  normalizeContractDetails,
  pickContractFailure,
  retryHint,
} from '@/lib/contract'

/** Node 环境没有 localStorage，补一个最小实现（auth.js 会用到） */
function createStorageMock() {
  const store = new Map()
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  }
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** 后端 422 的真实形状 */
const CONTRACT_INVALID_BODY = {
  error: {
    code: 'CONTRACT_INVALID',
    message: '契约校验未通过：缺失字段：scenario',
    details: {
      ok: false,
      missing: ['scenario'],
      extra: [],
      orderIssues: [{ field: 'techStack', expectedIndex: 2, actualIndex: 4, occupiedBy: 'timeline' }],
      typeIssues: [{ field: 'milestones', expected: 'array', actual: 'string' }],
      retryAllowed: true,
      maxRetries: 1,
    },
  },
}

describe('api/pipeline', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorageMock())
    setToken('tk')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    setUnauthorizedHandler(null)
  })

  it('start 命中 /pipeline/:teamId/start 并解出 run', async () => {
    // 真后端 201 形状：{ run, stage }，首阶段会话 id 在 stage.conversationId
    const fetchMock = vi.fn(async () =>
      jsonResponse({ run: { id: 'run-1' }, stage: { stageNo: 0, conversationId: 'conv-1' } }, 201),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await pipelineApi.start('team-1')

    expect(fetchMock.mock.calls[0][0]).toBe('/api/pipeline/team-1/start')
    expect(result.run.id).toBe('run-1')
    expect(result.stage.conversationId).toBe('conv-1')
  })

  it('get 把与 run 平级的 stages 归一化进 run', async () => {
    // 真后端形状：stages 在顶层，与 run 平级（不是 run.stages）
    const fetchMock = vi.fn(async () => jsonResponse({ run: { id: 'run-1' }, stages: [{ stageNo: 0 }] }))
    vi.stubGlobal('fetch', fetchMock)

    const run = await pipelineApi.get('run-1')

    expect(fetchMock.mock.calls[0][0]).toBe('/api/pipeline/run-1')
    expect(run.id).toBe('run-1')
    expect(run.stages).toHaveLength(1)
  })

  /**
   * 回归防线：advance 无请求体。一旦带上 content-type: application/json，
   * Fastify 会以 400 FST_ERR_CTP_EMPTY_JSON_BODY 拒绝，422 契约详情永远拿不到。
   */
  it('advance 只带 Authorization，不带 body 与 Content-Type', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ run: { id: 'run-1' }, conversationId: 'conv-2' }))
    vi.stubGlobal('fetch', fetchMock)

    await pipelineApi.advance('run-1')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/pipeline/run-1/advance')
    expect(init.method).toBe('POST')
    expect(init.body).toBeUndefined()
    expect(init.headers['Content-Type']).toBeUndefined()
    expect(init.headers.Authorization).toBe('Bearer tk')
  })

  it('advance 收到 422 时，异常里带着完整契约详情', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(CONTRACT_INVALID_BODY, 422)),
    )

    const failure = await pipelineApi.advance('run-1').catch((error) => {
      expect(error.status).toBe(422)
      return pickContractFailure(error)
    })

    expect(failure.code).toBe('CONTRACT_INVALID')
    expect(failure.missing).toEqual(['scenario'])
    expect(failure.retryAllowed).toBe(true)
  })
})

describe('lib/contract', () => {
  it('details 规范化成四个清单 + 重试预算', () => {
    const failure = pickContractFailure({ data: CONTRACT_INVALID_BODY, status: 422 })

    expect(failure.message).toBe('契约校验未通过：缺失字段：scenario')
    expect(failure.ok).toBe(false)
    expect(failure.missing).toEqual(['scenario'])
    expect(failure.extra).toEqual([])
    expect(failure.orderIssues).toEqual([
      { field: 'techStack', expectedIndex: 2, actualIndex: 4, occupiedBy: 'timeline' },
    ])
    expect(failure.typeIssues).toEqual([{ field: 'milestones', expected: 'array', actual: 'string' }])
    expect(failure.maxRetries).toBe(1)
  })

  it('顺序问题的字段名走别名兜底，缺字段只降级不抛错', () => {
    const details = normalizeContractDetails({
      ok: false,
      orderIssues: [{ fieldName: 'a', expectedPosition: 1, actualPosition: 3, takenBy: 'b' }, { field: 'c' }, 'd'],
      retryAllowed: false,
      maxRetries: 0,
      missing: null,
    })

    expect(details.orderIssues[0]).toEqual({ field: 'a', expectedIndex: 1, actualIndex: 3, occupiedBy: 'b' })
    expect(details.orderIssues[1]).toEqual({ field: 'c', expectedIndex: null, actualIndex: null, occupiedBy: '' })
    expect(details.orderIssues[2].field).toBe('d')
    expect(details.missing).toEqual([])
  })

  it('非契约失败（404 / 网络）返回 null，页面走普通错误提示', () => {
    expect(pickContractFailure({ status: 404, data: { message: '流水线不存在' } })).toBeNull()
    expect(pickContractFailure(new TypeError('网络异常'))).toBeNull()
    expect(pickContractFailure(null)).toBeNull()
  })

  it('重试预算文案：还能重试几次 / 已用尽', () => {
    expect(retryHint({ retryAllowed: true, maxRetries: 1 })).toBe('还可以重试 1 次')
    expect(retryHint({ retryAllowed: false, maxRetries: 0 })).toBe('重试预算已用尽')
    expect(retryHint(null)).toBe('尚未提交校验')
  })

  it('hasContractIssues 覆盖四种清单与「未通过但清单为空」', () => {
    expect(hasContractIssues(null)).toBe(false)
    expect(hasContractIssues(normalizeContractDetails({ ok: true }))).toBe(false)
    expect(hasContractIssues(normalizeContractDetails({ ok: false }))).toBe(true)
    expect(hasContractIssues(normalizeContractDetails({ missing: ['a'] }))).toBe(true)
    expect(hasContractIssues(normalizeContractDetails({ orderIssues: [{ field: 'a' }] }))).toBe(true)
  })

  it('序号展示：缺失时给出占位符而不是 NaN', () => {
    expect(formatIndex(2)).toBe('第 2 位')
    expect(formatIndex(null)).toBe('第 — 位')
  })
})

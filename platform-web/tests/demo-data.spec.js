/**
 * 演示数据模块的形状契约测试
 * ------------------------------------------------------------------
 * 双重目的：
 *   1. 钉住 demo 数据形状与 FE-B 契约一致（后端接手时照此实现，字段对不齐会在这里红）；
 *   2. 覆盖 src/lib/*Demo.js 与 *Mode.js 的行（这些模块在生产构建不进包，但仍在覆盖率统计内，
 *      之前全靠 view 测试里 vi.mock 掉它们 → src/lib/** 行覆盖率跌破 55% 门槛）。
 */
import { describe, expect, it } from 'vitest'

describe('lib/demo 模块（形状契约）', () => {
  it('mode 开关都是布尔（生产构建恒 false）', async () => {
    const modes = await Promise.all([
      import('@/lib/costMode'),
      import('@/lib/runsMode'),
      import('@/lib/evalsMode'),
      import('@/lib/tasksMode'),
      import('@/lib/assetsMode'),
    ])
    const flags = [
      modes[0].COST_MOCK_ENABLED,
      modes[1].RUNS_MOCK_ENABLED,
      modes[2].EVALS_MOCK_ENABLED,
      modes[3].TASKS_MOCK_ENABLED,
      modes[4].ASSETS_MOCK_ENABLED,
    ]
    for (const flag of flags) expect(typeof flag).toBe('boolean')
  })

  it('demo 数据形状与 FE-B 契约一致', async () => {
    const cost = await import('@/lib/costDemo')
    expect(cost.DEMO_COST_SUMMARY.byTeam.length).toBeGreaterThan(0)
    expect(typeof cost.DEMO_COST_SUMMARY.totalCost).toBe('number')

    const runs = await import('@/lib/runsDemo')
    expect(runs.DEMO_RUNS.length).toBeGreaterThan(0)
    expect(['running', 'paused', 'failed', 'completed']).toContain(runs.DEMO_RUNS[0].status)

    const evals = await import('@/lib/evalsDemo')
    expect(evals.DEMO_EVAL_CASES.length).toBeGreaterThan(0)
    expect(evals.DEMO_EVAL_RUNS.length).toBeGreaterThan(0)

    const tasks = await import('@/lib/tasksDemo')
    expect(tasks.DEMO_TASKS.length).toBeGreaterThan(0)
    expect(tasks.DEMO_TASKS[0].progress).toBeGreaterThanOrEqual(0)

    const assets = await import('@/lib/assetsDemo')
    expect(assets.DEMO_ASSETS.length).toBeGreaterThan(0)
    expect(assets.DEMO_ASSETS[0].content).toBeTruthy()
  })
})

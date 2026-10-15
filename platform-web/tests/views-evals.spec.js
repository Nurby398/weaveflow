// @vitest-environment happy-dom
/**
 * Evals（评测）组件测试（Paperclip 参照 · §C1）
 * ------------------------------------------------------------------
 * 三条路径：mock 渲染演示数据（用例 + 跑分 + 分数徽标）/ 接口 404 占位 / 真实渲染。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import Evals from '@/views/Evals.vue'

const { cases, runs } = vi.hoisted(() => ({ cases: vi.fn(), runs: vi.fn() }))
const { flag } = vi.hoisted(() => ({ flag: { value: false } }))
vi.mock('@/api', () => ({ evalsApi: { cases, runs, run: vi.fn() }, logApiError: () => {}, toFriendlyError: () => '' }))
vi.mock('@/lib/evalsMode', () => ({
  get EVALS_MOCK_ENABLED() {
    return flag.value
  },
}))

async function mountEvals() {
  const wrapper = mount(Evals, { global: { plugins: [ElementPlus] } })
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve, 20))
  return wrapper
}

describe('views/Evals', () => {
  beforeEach(() => {
    cases.mockReset()
    runs.mockReset()
    flag.value = false
  })

  it('mock 模式：渲染演示用例与跑分（含分数徽标）', async () => {
    flag.value = true
    const wrapper = await mountEvals()

    expect(wrapper.text()).toContain('演示数据')
    expect(wrapper.text()).toContain('选题可行性判断')
    expect(wrapper.text()).toContain('①毕设选题与立项顾问')
    expect(wrapper.text()).toContain('88 分')
    expect(cases).not.toHaveBeenCalled()
    expect(runs).not.toHaveBeenCalled()
  })

  it('接口 404：显示「评测接口未就绪」占位', async () => {
    cases.mockRejectedValue({ status: 404 })
    runs.mockRejectedValue({ status: 404 })
    const wrapper = await mountEvals()

    expect(wrapper.text()).toContain('评测接口未就绪')
  })

  it('真实渲染：用例与跑分来自接口，无演示徽标', async () => {
    cases.mockResolvedValue([{ caseId: 'c1', name: '用例A', input: '输入A', expectedKeyPoints: [] }])
    runs.mockResolvedValue([
      {
        runId: 'r1',
        caseId: 'c1',
        caseName: '用例A',
        agentName: '智能体A',
        score: 60,
        durationMs: 100,
        tokensIn: 10,
        tokensOut: 5,
        createdAt: '2026-10-15T09:00:00Z',
      },
    ])
    const wrapper = await mountEvals()

    expect(wrapper.text()).not.toContain('演示数据')
    expect(wrapper.text()).toContain('用例A')
    expect(wrapper.text()).toContain('60 分')
  })
})

// @vitest-environment happy-dom
/**
 * Cost（成本面板）组件测试（Paperclip 参照 · §D1）
 * ------------------------------------------------------------------
 * 两条路径：
 *   1. `VITE_MOCK_COST=true` → 渲染演示数据（带「演示数据」徽标 + 总费用 + 按项目明细）；
 *   2. 关闭且真实接口 404（FE-B19 未就绪）→ 显示「成本接口未就绪」占位，不崩。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import Cost from '@/views/Cost.vue'

const { summary } = vi.hoisted(() => ({ summary: vi.fn() }))
const { flag } = vi.hoisted(() => ({ flag: { value: false } }))
vi.mock('@/api', () => ({
  costApi: { summary },
  logApiError: () => {},
  toFriendlyError: (error) => error?.message || '出错了',
}))
// 开关抽成模块后用 getter 暴露：Cost.vue 在 load() 里才读它，测试可逐用例切换
vi.mock('@/lib/costMode', () => ({
  get COST_MOCK_ENABLED() {
    return flag.value
  },
}))

async function mountCost() {
  const wrapper = mount(Cost, { global: { plugins: [ElementPlus] } })
  await flushPromises()
  // 动态 import('@/lib/costDemo') 的 chunk 加载需要真实宏任务，flushPromises 盖不住
  await new Promise((resolve) => setTimeout(resolve, 20))
  return wrapper
}

describe('views/Cost', () => {
  beforeEach(() => {
    summary.mockReset()
    flag.value = false
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('mock 模式：渲染演示数据（徽标 + 总费用 + 按项目明细）', async () => {
    flag.value = true
    const wrapper = await mountCost()

    expect(wrapper.text()).toContain('演示数据')
    expect(wrapper.text()).toContain('42.35 CNY')
    expect(wrapper.text()).toContain('毕业设计流水线（我的）')
    expect(wrapper.text()).toContain('毕业设计流水线(真实)')
    // mock 模式不调用真实接口
    expect(summary).not.toHaveBeenCalled()
  })

  it('非 mock 且接口 404：显示「成本接口未就绪」占位，不崩', async () => {
    summary.mockRejectedValue({ status: 404, message: 'Not Found' })
    const wrapper = await mountCost()

    expect(wrapper.text()).toContain('成本接口未就绪')
    expect(summary).toHaveBeenCalledTimes(1)
  })

  it('非 mock 且接口正常：渲染真实汇总（不出现演示徽标）', async () => {
    summary.mockResolvedValue({
      currency: 'CNY',
      totalCost: 10,
      totalTokensIn: 1000,
      totalTokensOut: 500,
      budget: 100,
      budgetUsedRatio: 0.1,
      byTeam: [
        { teamId: 't', teamName: '团队A', isPlatform: false, cost: 10, tokensIn: 1000, tokensOut: 500, runs: 1 },
      ],
    })
    const wrapper = await mountCost()

    expect(wrapper.text()).not.toContain('演示数据')
    expect(wrapper.text()).toContain('10.00 CNY')
    expect(wrapper.text()).toContain('团队A')
  })
})

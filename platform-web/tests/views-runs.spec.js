// @vitest-environment happy-dom
/**
 * Runs（运行历史）组件测试（Paperclip 参照 · §D2 运行历史）
 * ------------------------------------------------------------------
 * 三条路径：mock 渲染演示数据 / 接口 404 占位 / 真实渲染（含状态徽标与失败原因）。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import Runs from '@/views/Runs.vue'

const { list } = vi.hoisted(() => ({ list: vi.fn() }))
const { flag } = vi.hoisted(() => ({ flag: { value: false } }))
const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/api', () => ({ runsApi: { list }, logApiError: () => {}, toFriendlyError: () => '' }))
vi.mock('@/lib/runsMode', () => ({
  get RUNS_MOCK_ENABLED() {
    return flag.value
  },
}))
vi.mock('@/lib/runsDemo', () => ({
  DEMO_RUNS: [
    {
      runId: 'run-1001',
      teamId: 'team-1',
      teamName: '毕业设计流水线（我的）',
      isPlatform: false,
      status: 'running',
      currentStage: 1,
      stageCount: 5,
      startedAt: '2026-10-15T09:20:00Z',
      updatedAt: '2026-10-15T10:05:00Z',
      failure: null,
    },
    {
      runId: 'run-1002',
      teamId: 'team-2',
      teamName: '毕业设计流水线(真实)',
      isPlatform: true,
      status: 'failed',
      currentStage: 3,
      stageCount: 5,
      startedAt: '2026-10-14T14:00:00Z',
      updatedAt: '2026-10-14T14:32:00Z',
      failure: '阶段 4 契约校验未通过：缺失字段 topic_name',
    },
    {
      runId: 'run-1003',
      teamId: 'team-1',
      teamName: '毕业设计流水线（我的）',
      isPlatform: false,
      status: 'completed',
      currentStage: 5,
      stageCount: 5,
      startedAt: '2026-10-13T08:00:00Z',
      updatedAt: '2026-10-13T11:10:00Z',
      failure: null,
    },
  ],
}))

async function mountRuns() {
  const wrapper = mount(Runs, { global: { plugins: [ElementPlus] } })
  await flushPromises()
  return wrapper
}

describe('views/Runs', () => {
  beforeEach(() => {
    list.mockReset()
    flag.value = false
  })

  it('mock 模式：渲染演示数据（徽标 + 状态 + 失败原因）', async () => {
    flag.value = true
    const wrapper = await mountRuns()

    expect(wrapper.text()).toContain('演示数据')
    expect(wrapper.text()).toContain('毕业设计流水线（我的）')
    expect(wrapper.text()).toContain('运行中')
    expect(wrapper.text()).toContain('失败')
    expect(wrapper.text()).toContain('已完成')
    expect(wrapper.text()).toContain('缺失字段 topic_name')
    expect(list).not.toHaveBeenCalled()
  })

  it('接口 404：显示「运行历史接口未就绪」占位', async () => {
    list.mockRejectedValue({ status: 404, message: 'Not Found' })
    const wrapper = await mountRuns()

    expect(wrapper.text()).toContain('运行历史接口未就绪')
    expect(list).toHaveBeenCalledTimes(1)
  })

  it('真实渲染：状态徽标与阶段进度正确，点行跳详情', async () => {
    list.mockResolvedValue([
      {
        runId: 'run-9',
        teamId: 'team-1',
        teamName: '团队A',
        isPlatform: false,
        status: 'completed',
        currentStage: 4,
        stageCount: 5,
        startedAt: '2026-10-15T08:00:00Z',
        updatedAt: '2026-10-15T09:00:00Z',
        failure: null,
      },
    ])
    const wrapper = await mountRuns()

    expect(wrapper.text()).not.toContain('演示数据')
    expect(wrapper.text()).toContain('已完成')
    expect(wrapper.text()).toContain('阶段 5/5')

    await wrapper.find('.runs__row').trigger('click')
    expect(push).toHaveBeenCalledWith('/pipeline/run-9')
  })
})

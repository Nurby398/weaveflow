// @vitest-environment happy-dom
/**
 * Tasks（任务中心）组件测试（EvoFlow 参照 · §E8）
 * ------------------------------------------------------------------
 * 三条路径：mock 渲染演示数据 / 接口 404 占位 / 真实渲染 + 操作降级提示。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import Tasks from '@/views/Tasks.vue'

const { list, pause, resume, cancel } = vi.hoisted(() => ({
  list: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  cancel: vi.fn(),
}))
const { flag } = vi.hoisted(() => ({ flag: { value: false } }))
const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/api', () => ({
  tasksApi: { list, pause, resume, cancel },
  logApiError: () => {},
  toFriendlyError: (error) => error?.message || '',
}))
vi.mock('@/composables/useToast', () => ({ useToast: () => toast }))
vi.mock('@/lib/tasksMode', () => ({
  get TASKS_MOCK_ENABLED() {
    return flag.value
  },
}))
vi.mock('@/lib/tasksDemo', () => ({
  DEMO_TASKS: [
    {
      id: 'task-1',
      title: '毕设流水线',
      teamId: 'team-1',
      teamName: '团队A',
      status: 'running',
      progress: 40,
      currentStage: 2,
      startedAt: '2026-10-15T09:00:00Z',
      updatedAt: '2026-10-15T10:00:00Z',
    },
    {
      id: 'task-2',
      title: '跑批任务',
      teamId: 'team-1',
      teamName: '团队A',
      status: 'paused',
      progress: 60,
      currentStage: 3,
      startedAt: '2026-10-14T09:00:00Z',
      updatedAt: '2026-10-14T10:00:00Z',
    },
  ],
}))

async function mountTasks() {
  const wrapper = mount(Tasks, { global: { plugins: [ElementPlus] } })
  await flushPromises()
  return wrapper
}

describe('views/Tasks', () => {
  beforeEach(() => {
    list.mockReset()
    pause.mockReset()
    resume.mockReset()
    cancel.mockReset()
    flag.value = false
  })

  it('mock 模式：渲染演示数据（状态徽标 + 进度 + 操作按钮）', async () => {
    flag.value = true
    const wrapper = await mountTasks()

    expect(wrapper.text()).toContain('演示数据')
    expect(wrapper.text()).toContain('毕设流水线')
    expect(wrapper.text()).toContain('运行中')
    expect(wrapper.text()).toContain('已暂停')
    expect(wrapper.text()).toContain('40%')
    expect(list).not.toHaveBeenCalled()
  })

  it('接口 404：显示「任务中心接口未就绪」占位', async () => {
    list.mockRejectedValue({ status: 404 })
    const wrapper = await mountTasks()
    expect(wrapper.text()).toContain('任务中心接口未就绪')
  })

  it('真实渲染 + 操作：暂停调用 tasksApi.pause，404 时降级提示', async () => {
    list.mockResolvedValue([
      {
        id: 't1',
        title: '真实任务',
        teamId: 'x',
        teamName: 'T',
        status: 'running',
        progress: 10,
        currentStage: 1,
        startedAt: '2026-10-15T09:00:00Z',
        updatedAt: '2026-10-15T09:01:00Z',
      },
    ])
    const wrapper = await mountTasks()
    expect(wrapper.text()).not.toContain('演示数据')
    expect(wrapper.text()).toContain('真实任务')

    pause.mockRejectedValue({ status: 404 })
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('暂停'))
      .trigger('click')
    await flushPromises()
    expect(pause).toHaveBeenCalledWith('t1')
    expect(toast.info).toHaveBeenCalled()
  })
})

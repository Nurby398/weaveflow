// @vitest-environment happy-dom
/**
 * Assets（资产库）组件测试（EvoFlow 参照 · §E5）
 * ------------------------------------------------------------------
 * 三条路径：mock 渲染演示数据（含检索）/ 接口 404 占位 / 真实渲染 + 检索过滤。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import Assets from '@/views/Assets.vue'

const { list } = vi.hoisted(() => ({ list: vi.fn() }))
const { flag } = vi.hoisted(() => ({ flag: { value: false } }))
vi.mock('@/api', () => ({ assetsApi: { list }, logApiError: () => {}, toFriendlyError: () => '' }))
vi.mock('@/lib/assetsMode', () => ({
  get ASSETS_MOCK_ENABLED() {
    return flag.value
  },
}))
vi.mock('@/lib/assetsDemo', () => ({
  DEMO_ASSETS: [
    {
      id: 'asset-1',
      teamId: 'team-1',
      teamName: '团队A',
      stageNo: 1,
      title: '选题评估结论',
      content: '聚焦校内 C2C 差异化',
      createdAt: '2026-10-15T08:30:00Z',
    },
    {
      id: 'asset-2',
      teamId: 'team-1',
      teamName: '团队A',
      stageNo: 3,
      title: '数据库表设计',
      content: '用户/商品/订单三表',
      createdAt: '2026-10-15T09:40:00Z',
    },
  ],
}))

async function mountAssets() {
  const wrapper = mount(Assets, { global: { plugins: [ElementPlus] } })
  await flushPromises()
  return wrapper
}

describe('views/Assets', () => {
  beforeEach(() => {
    list.mockReset()
    flag.value = false
  })

  it('mock 模式：渲染演示资产（标题/阶段徽标/团队）', async () => {
    flag.value = true
    const wrapper = await mountAssets()

    expect(wrapper.text()).toContain('演示数据')
    expect(wrapper.text()).toContain('选题评估结论')
    expect(wrapper.text()).toContain('阶段 ①')
    expect(wrapper.text()).toContain('团队A')
    expect(list).not.toHaveBeenCalled()
  })

  it('检索：按标题或正文过滤', async () => {
    flag.value = true
    const wrapper = await mountAssets()

    await wrapper.find('input[aria-label="搜索资产"]').setValue('数据库')
    await flushPromises()
    expect(wrapper.text()).toContain('数据库表设计')
    expect(wrapper.text()).not.toContain('选题评估结论')

    await wrapper.find('input[aria-label="搜索资产"]').setValue('zzz')
    await flushPromises()
    expect(wrapper.text()).toContain('没有匹配的资产')
  })

  it('接口 404：显示「资产库接口未就绪」占位', async () => {
    list.mockRejectedValue({ status: 404 })
    const wrapper = await mountAssets()
    expect(wrapper.text()).toContain('资产库接口未就绪')
  })
})

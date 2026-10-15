// @vitest-environment happy-dom
/**
 * 三态组件测试（设计评审 P0-7）：LoadingState / ErrorState
 * ------------------------------------------------------------------
 * 空态继续用已有 Empty（15 个文件在用的 EmptyState），这里只测新增的两个。
 */
import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import LoadingState from '@/components/ui/LoadingState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'

describe('ui/LoadingState', () => {
  it('按 rows 渲染占位行，带无障碍 status', () => {
    const wrapper = mount(LoadingState, { global: { plugins: [ElementPlus] }, props: { rows: 4 } })
    expect(wrapper.findAll('.loading-state__row').length).toBe(4)
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
  })
})

describe('ui/ErrorState', () => {
  it('渲染标题/描述/重试按钮', () => {
    const wrapper = mount(ErrorState, {
      global: { plugins: [ElementPlus] },
      props: { title: '加载失败', description: '网络错误' },
    })
    expect(wrapper.text()).toContain('加载失败')
    expect(wrapper.text()).toContain('网络错误')
    expect(wrapper.text()).toContain('重试')
  })

  it('点重试 → 宿主收到 retry', async () => {
    const Parent = defineComponent({
      components: { ErrorState },
      data: () => ({ retried: false }),
      template: "<ErrorState title='x' @retry='retried = true' />",
    })
    const wrapper = mount(Parent, { global: { plugins: [ElementPlus] } })
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('重试'))
      .trigger('click')
    expect(wrapper.vm.retried).toBe(true)
  })
})

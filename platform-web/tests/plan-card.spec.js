// @vitest-environment happy-dom
/**
 * PlanCard 组件测试（EvoFlow 参照 · §E1 计划卡）
 * ------------------------------------------------------------------
 * 钉住：渲染计划阶段 + 用户意图回显；确认/取消事件能到达宿主。
 * 注：VTU 的 wrapper.emitted() 在此组件上拿不到事件（实测为已知怪癖），
 *     故用父组件 harness 断言事件真的到达宿主，这也是更贴近真实用法的写法。
 */
import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import PlanCard from '@/components/PlanCard.vue'

const STAGES = [
  { agentName: '①毕设选题与立项顾问' },
  { agentName: '②需求分析与开题工程师' },
  { agentName: '③架构与数据库设计工程师' },
]

function mountHarness(content = 'x') {
  const Parent = defineComponent({
    components: { PlanCard },
    data: () => ({ got: '' }),
    template: "<PlanCard :content='content' :stages='stages' @confirm=\"got='confirm'\" @cancel=\"got='cancel'\" />",
    props: { content: String, stages: Array },
  })
  return mount(Parent, { global: { plugins: [ElementPlus] }, props: { content, stages: STAGES } })
}

describe('components/PlanCard', () => {
  it('渲染计划阶段与意图回显', () => {
    const wrapper = mountHarness('我想做软件开发毕设')
    expect(wrapper.text()).toContain('3 个阶段')
    expect(wrapper.text()).toContain('①毕设选题与立项顾问')
    expect(wrapper.text()).toContain('③架构与数据库设计工程师')
    expect(wrapper.text()).toContain('我想做软件开发毕设')
  })

  it('点「确认并启动」→ 宿主收到 confirm', async () => {
    const wrapper = mountHarness()
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('确认并启动'))
      .trigger('click')
    expect(wrapper.vm.got).toBe('confirm')
  })

  it('点「取消」→ 宿主收到 cancel', async () => {
    const wrapper = mountHarness()
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('取消'))
      .trigger('click')
    expect(wrapper.vm.got).toBe('cancel')
  })
})

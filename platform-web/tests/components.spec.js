// @vitest-environment happy-dom
/**
 * 组件测试 · 第一批（Wave 1 起点）
 * ------------------------------------------------------------------
 * 目的有两个：
 *   1. 验证「组件测试」这条能力在本仓可用（@vue/test-utils + happy-dom + ElementPlus）；
 *   2. 钉住对外**行为契约**，而不是实现细节 —— 这样后续重构才有安全网。
 *
 * 本文件覆盖：
 *   · ui/Badge —— 平台徽标依赖它的 tone 语义（tone 拼进类名，样式由 tokens 提供）
 *   · components/FeedbackModal —— 两条真实业务契约：
 *       a) 内容太短 → 前端就拦下，**不发请求**；
 *       b) 后端还没上线（404）→ 必须显示「反馈通道正在建设中」，不能让用户以为是自己的错。
 *         这正是 `docs/前端驱动-后端待实现清单-v1.md` 的 FE-B03，接口就绪前靠这条降级。
 *
 * 说明：默认 environment 是 node（见 vite.config.js 的 test.environment），
 *      组件测试按文件用 `// @vitest-environment happy-dom` 覆盖，不影响既有 6 份单测。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import Badge from '@/components/ui/Badge.vue'
import FeedbackModal from '@/components/FeedbackModal.vue'

const { createFeedback } = vi.hoisted(() => ({ createFeedback: vi.fn() }))

vi.mock('@/api', () => ({
  feedbackApi: { create: createFeedback },
}))

const mountOptions = { global: { plugins: [ElementPlus] } }

describe('ui/Badge（平台徽标的基座）', () => {
  it('tone / size 拼进类名，缺省是 neutral', () => {
    const primary = mount(Badge, {
      ...mountOptions,
      props: { tone: 'primary', size: 'sm' },
      slots: { default: '平台' },
    })
    expect(primary.classes()).toContain('ui-badge--primary')
    expect(primary.classes()).toContain('ui-badge--sm')
    expect(primary.text()).toContain('平台')

    const fallback = mount(Badge, { ...mountOptions, slots: { default: 'x' } })
    expect(fallback.classes()).toContain('ui-badge--neutral')
  })

  it('dot 渲染圆点，且对读屏隐藏（纯装饰）', () => {
    const wrapper = mount(Badge, {
      ...mountOptions,
      props: { dot: true },
      slots: { default: 'ok' },
    })
    const dot = wrapper.find('.ui-badge__dot')
    expect(dot.exists()).toBe(true)
    expect(dot.attributes('aria-hidden')).toBe('true')
  })
})

describe('components/FeedbackModal（FE-B03 的降级契约）', () => {
  beforeEach(() => {
    createFeedback.mockReset()
  })

  /** Modal 内部 Teleport 到 body，所以挂到 document.body 上用原生选择器查节点。 */
  const mounted = []
  function mountModal() {
    const wrapper = mount(FeedbackModal, {
      ...mountOptions,
      props: { modelValue: true },
      attachTo: document.body,
    })
    mounted.push(wrapper)
    return wrapper
  }
  const q = (selector) => new DOMWrapper(document.querySelector(selector))

  afterEach(() => {
    while (mounted.length) mounted.pop().unmount()
    document.body.innerHTML = ''
  })

  it('内容太短：前端拦下并提示，不发请求', async () => {
    mountModal()
    await q('textarea[aria-label="反馈内容"]').setValue('短')
    await q('form').trigger('submit')

    const alert = q('[role="alert"]')
    expect(alert.exists()).toBe(true)
    expect(alert.text()).toContain('请至少填写')
    expect(createFeedback).not.toHaveBeenCalled()
  })

  it('后端未实现（404）：提示「建设中」而不是「提交失败」', async () => {
    createFeedback.mockRejectedValueOnce({ status: 404, message: 'Not Found' })
    mountModal()
    await q('textarea[aria-label="反馈内容"]').setValue('这是一条足够长的反馈内容，用于验证降级提示是否出现。')
    await q('form').trigger('submit')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(createFeedback).toHaveBeenCalledTimes(1)
    const alert = q('[role="alert"]')
    expect(alert.exists()).toBe(true)
    expect(alert.text()).toContain('反馈通道正在建设中')
    // 反例：不能把「后端没上线」说成用户的错
    expect(alert.text()).not.toContain('提交失败')
  })
})

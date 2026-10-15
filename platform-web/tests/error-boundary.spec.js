// @vitest-environment happy-dom
/**
 * ErrorBoundary 组件测试（Wave 2 · W2-1）
 * ------------------------------------------------------------------
 * 这条测试的意义：**白屏是"没有测试"才会发生的事故**。
 * 钉住：子树抛错时（a）页面不空白，（b）出现可读兜底 + 编号，（c）「重试」能恢复渲染。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import ElementPlus from 'element-plus'
import ErrorBoundary from '@/components/ui/ErrorBoundary.vue'

/** 受控「会炸」的子组件：boom 为 true 时渲染即抛错 */
const Bomb = defineComponent({
  name: 'Bomb',
  props: { boom: { type: Boolean, default: true } },
  setup(props) {
    return () => {
      if (props.boom) throw new Error('渲染炸了')
      return '安全内容'
    }
  },
})

afterEach(() => {
  vi.restoreAllMocks()
})

// Vue 会把被边界接住的错误打到 console.error，测试里静音（否则输出很吵）
const silence = () => vi.spyOn(console, 'error').mockImplementation(() => {})

/**
 * ⚠️ 关键时序：Vue 在子树渲染抛错的**当帧会中止渲染**，边界只能记录错误；
 * 兜底 UI 要等下一次渲染（nextTick）才出现 —— 少了这一步断言会看到空 DOM。
 */
async function mountBoundary(options) {
  const wrapper = mount(ErrorBoundary, { global: { plugins: [ElementPlus] }, ...options })
  await nextTick()
  return wrapper
}

describe('ui/ErrorBoundary', () => {
  it('子树抛错：不白屏，显示兜底卡片 + 错误编号', async () => {
    silence()
    const wrapper = await mountBoundary({ slots: { default: Bomb } })

    const alert = wrapper.find('[role="alert"]')
    expect(alert.exists()).toBe(true)
    expect(alert.text()).toContain('这一部分加载失败了')
    expect(alert.text()).toContain('编号')
    expect(alert.text()).toMatch(/编号 [0-9a-f]{8}/)
    expect(alert.text()).toContain('渲染炸了')
  })

  it('支持自定义标题（外层/内层两层兜底用不同文案）', async () => {
    silence()
    const wrapper = await mountBoundary({
      props: { title: '页面加载失败了' },
      slots: { default: Bomb },
    })
    expect(wrapper.find('[role="alert"]').text()).toContain('页面加载失败了')
  })

  it('点「重试」后重新渲染子树：子组件恢复正常时内容回来', async () => {
    silence()
    const boom = ref(true)
    const Controlled = defineComponent({
      name: 'Controlled',
      setup() {
        return () =>
          boom.value
            ? (() => {
                throw new Error('第一次炸')
              })()
            : '安全内容'
      },
    })

    const wrapper = await mountBoundary({ slots: { default: Controlled } })
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)

    // 修好之后点重试
    boom.value = false
    const buttons = wrapper.findAll('button')
    await buttons[0].trigger('click')
    await nextTick()

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('安全内容')
  })

  it('正常子树原样透传（边界不该影响正常路径）', async () => {
    const wrapper = await mountBoundary({ slots: { default: '<p class="ok">一切正常</p>' } })
    expect(wrapper.find('.ok').text()).toBe('一切正常')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })
})

// @vitest-environment happy-dom
/**
 * Chat.vue 冒烟测试（P1-1 · 拆前先补测试网的第一步）
 * ------------------------------------------------------------------
 * 2600 行的核心屏此前没有任何视图测试。本文件先立「能挂载 + 关键结构在」的回归底线：
 *   1. 已登录空态：会话栏 + 新建对话 + 搜索框在（此时没有会话，输入区本就该不渲染）；
 *   2. 打开一条会话后：输入区出现。
 * 后续拆分时逐块加断言。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ElementPlus from 'element-plus'
import Chat from '@/views/Chat.vue'
import { useUserStore } from '@/store/user'

const push = vi.fn()
const routeState = { params: {}, query: {} }
const { listConversations, listMessages, listAgents } = vi.hoisted(() => ({
  listConversations: vi.fn(),
  listMessages: vi.fn(),
  listAgents: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
  useRoute: () => routeState,
}))
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }),
}))
vi.mock('@/composables/useAuthGuard', () => ({ useAuthGuard: () => ({ requireLogin: () => true }) }))
vi.mock('@/api/stream', () => ({ createSSEStream: vi.fn() }))
vi.mock('@/api', () => ({
  agentApi: { list: listAgents },
  conversationApi: {
    list: listConversations,
    create: vi.fn().mockResolvedValue({ id: 'c1' }),
    messages: listMessages,
  },
  attachmentRawUrl: (id) => `/attachments/${id}`,
  uploadAttachment: vi.fn(),
  logApiError: () => {},
  toFriendlyError: (error) => error?.message || '出错了',
}))

async function mountChat(options = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useUserStore()
  if (options.token !== false) store.token = 'test-token'
  const wrapper = mount(Chat, { global: { plugins: [ElementPlus, pinia] } })
  await flushPromises()
  return wrapper
}

describe('views/Chat 冒烟（P1 测试网）', () => {
  beforeEach(() => {
    push.mockReset()
    routeState.params = {}
    routeState.query = {}
    listConversations.mockReset().mockResolvedValue([])
    listMessages.mockReset().mockResolvedValue([])
    listAgents.mockReset().mockResolvedValue([])
  })

  it('已登录空态：会话栏 + 新建对话 + 搜索框在，且不崩', async () => {
    const wrapper = await mountChat()
    expect(wrapper.find('.chat__rail').exists()).toBe(true)
    expect(wrapper.text()).toContain('新建对话')
    expect(wrapper.find('input[aria-label="搜索会话"]').exists()).toBe(true)
  })

  it('有一条会话时：会话行渲染 + 搜索过滤', async () => {
    listConversations.mockResolvedValue([
      { id: 'c1', title: '测试会话', agentDefId: 'a1', createdAt: new Date().toISOString() },
    ])
    const wrapper = await mountChat()
    expect(wrapper.text()).toContain('测试会话')

    await wrapper.find('input[aria-label="搜索会话"]').setValue('不存在')
    await flushPromises()
    expect(wrapper.text()).toContain('没有匹配的会话')
  })

  it('未登录态：显示登录后加载会话', async () => {
    const wrapper = await mountChat({ token: false })
    expect(wrapper.text()).toContain('登录后加载会话')
  })

  it('带路由会话 id：bootChat 自动打开并渲染消息流', async () => {
    routeState.params = { conversationId: 'c1' }
    listAgents.mockResolvedValue([{ id: 'a1', name: '测试智能体', stageNo: 1, sourceType: 'self_hosted' }])
    listConversations.mockResolvedValue([
      { id: 'c1', title: '测试会话', agentDefId: 'a1', createdAt: new Date().toISOString() },
    ])
    listMessages.mockResolvedValue([
      {
        id: 'm1',
        role: 'user',
        content: '帮我整理开题报告',
        createdAt: new Date().toISOString(),
        tokensIn: 0,
        tokensOut: 0,
      },
      {
        id: 'm2',
        role: 'assistant',
        content: '好的，这是开题报告提纲',
        createdAt: new Date().toISOString(),
        tokensIn: 10,
        tokensOut: 20,
      },
    ])
    const wrapper = await mountChat()
    expect(wrapper.text()).toContain('帮我整理开题报告')
    expect(wrapper.text()).toContain('好的，这是开题报告提纲')
  })
})

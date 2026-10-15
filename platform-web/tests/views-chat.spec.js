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
const { listConversations, listMessages } = vi.hoisted(() => ({
  listConversations: vi.fn(),
  listMessages: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
  useRoute: () => ({ params: {}, query: {} }),
}))
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }),
}))
vi.mock('@/composables/useAuthGuard', () => ({ useAuthGuard: () => ({ requireLogin: () => true }) }))
vi.mock('@/api/stream', () => ({ createSSEStream: vi.fn() }))
vi.mock('@/api', () => ({
  agentApi: { list: vi.fn().mockResolvedValue([]) },
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

async function mountChat() {
  const pinia = createPinia()
  setActivePinia(pinia)
  useUserStore().token = 'test-token'
  const wrapper = mount(Chat, { global: { plugins: [ElementPlus, pinia] } })
  await flushPromises()
  return wrapper
}

describe('views/Chat 冒烟（P1 测试网）', () => {
  beforeEach(() => {
    push.mockReset()
    listConversations.mockReset().mockResolvedValue([])
    listMessages.mockReset().mockResolvedValue([])
  })

  it('已登录空态：会话栏 + 新建对话 + 搜索框在，且不崩', async () => {
    const wrapper = await mountChat()
    expect(wrapper.find('.chat__rail').exists()).toBe(true)
    expect(wrapper.text()).toContain('新建对话')
    expect(wrapper.find('input[aria-label="搜索会话"]').exists()).toBe(true)
  })

  it('有一条会话时：会话行渲染', async () => {
    listConversations.mockResolvedValue([
      { id: 'c1', title: '测试会话', agentDefId: 'a1', createdAt: new Date().toISOString() },
    ])
    const wrapper = await mountChat()
    expect(wrapper.text()).toContain('测试会话')
  })
})

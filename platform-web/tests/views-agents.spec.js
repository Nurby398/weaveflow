// @vitest-environment happy-dom
/**
 * 视图级组件测试 · Agents.vue 的「平台只读态」
 * ------------------------------------------------------------------
 * 这是平台公共资源改造（D18–D24）在 UI 侧的**唯一防线**：
 *   · 平台智能体必须能看见（任何账号都能用）；
 *   · 但选中它时**不能出现任何写入口**（没有保存/删除按钮、表单 inert）；
 *   · 自己的私有智能体必须照旧可写 —— 别把"只读"做成了"人人只读"。
 *
 * 依赖面用 mock 隔离：@/api（三个 list）、useToast、useAuthGuard；pinia 用真 store 注入登录态。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ElementPlus from 'element-plus'
import Agents from '@/views/Agents.vue'
import { useUserStore } from '@/store/user'

const { listAgents, listProviders, listDocs } = vi.hoisted(() => ({
  listAgents: vi.fn(),
  listProviders: vi.fn(),
  listDocs: vi.fn(),
}))

vi.mock('@/api', () => ({
  agentApi: {
    list: listAgents,
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    removeExternal: vi.fn(),
    testExternal: vi.fn(),
  },
  providerApi: { list: listProviders },
  knowledgeApi: { list: listDocs },
  logApiError: () => {},
  toFriendlyError: (error) => error?.message || '出错了',
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }),
}))

vi.mock('@/composables/useAuthGuard', () => ({
  useAuthGuard: () => ({ requireLogin: () => true }),
}))

/** 平台公共智能体（user_id IS NULL）——真库里的「织流」就是这个形态 */
const platformAgent = {
  id: 'plat-0001',
  isPlatform: true,
  name: '织流',
  icon: null,
  teamId: null,
  stageNo: null,
  systemPrompt: null,
  providerCredId: null,
  model: null,
  knowledgeDocIds: [],
  outputSchema: null,
  sort: 0,
  sourceType: 'external',
  externalBaseUrl: 'https://hidden.example.com',
  externalAgentId: 'app-1',
  externalTokenHint: 'app****mnop',
  createdAt: '2026-10-14T06:00:00.000Z',
}

/** 自己的私有智能体——必须照旧可写（私有隔离是纯增量语义） */
const privateAgent = {
  ...platformAgent,
  id: 'priv-0002',
  isPlatform: false,
  name: '我的私有智能体',
  sourceType: 'self_hosted',
  externalBaseUrl: null,
  externalAgentId: null,
  externalTokenHint: null,
  model: 'gpt-4o-mini',
}

async function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useUserStore()
  store.token = 'test-token' // loggedIn 是 token 派生的 getter

  const wrapper = mount(Agents, { global: { plugins: [ElementPlus, pinia] } })
  await flushPromises()
  return wrapper
}

const buttonTexts = (wrapper) => wrapper.findAll('button').map((node) => node.text())
const hasButton = (wrapper, text) => buttonTexts(wrapper).some((t) => t.includes(text))

describe('views/Agents —— 平台公共资源的只读态', () => {
  beforeEach(() => {
    listAgents.mockReset().mockResolvedValue([platformAgent, privateAgent])
    listProviders.mockReset().mockResolvedValue([])
    listDocs.mockReset().mockResolvedValue([])
  })

  it('平台智能体与私有智能体同列可见，且只有平台那条带「平台」徽标', async () => {
    const wrapper = await mountView()
    const items = wrapper.findAll('.agents__item')

    expect(items).toHaveLength(2)
    expect(wrapper.text()).toContain('织流')
    expect(wrapper.text()).toContain('我的私有智能体')

    const platformItem = items.find((node) => node.text().includes('织流'))
    const privateItem = items.find((node) => node.text().includes('我的私有智能体'))
    expect(platformItem.text()).toContain('平台')
    expect(privateItem.text()).not.toContain('平台')
  })

  it('选中平台智能体：显示只读徽标、无写按钮、表单不可交互', async () => {
    const wrapper = await mountView()

    // 列表第一个是平台智能体 → 默认选中它
    expect(wrapper.text()).toContain('平台公共 · 只读')
    expect(hasButton(wrapper, '保存')).toBe(false)
    expect(hasButton(wrapper, '删除')).toBe(false)

    const form = wrapper.find('.agents__form')
    expect(form.exists()).toBe(true)
    expect(form.element.hasAttribute('inert')).toBe(true)
  })

  it('切到私有智能体：写入口必须回来（不能因平台只读而把私有资源也锁死）', async () => {
    const wrapper = await mountView()
    const privateItem = wrapper.findAll('.agents__item').find((node) => node.text().includes('我的私有智能体'))

    await privateItem.trigger('click')
    await flushPromises()

    expect(wrapper.text()).not.toContain('平台公共 · 只读')
    expect(hasButton(wrapper, '保存')).toBe(true)
    expect(hasButton(wrapper, '删除')).toBe(true)
    expect(wrapper.find('.agents__form').element.hasAttribute('inert')).toBe(false)
  })
})

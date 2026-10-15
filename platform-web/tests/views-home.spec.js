// @vitest-environment happy-dom
/**
 * Home（工作台）组件测试 —— 为「项目卡片流」重构先钉住现有行为
 * ------------------------------------------------------------------
 * 钉住四点（重构后必须继续成立）：
 *   1. 团队分组：团队下的智能体聚合进该组，未归属的进「未分组」，isPlatform 透传；
 *   2. 平台徽标：平台团队带「平台公共」、平台智能体卡片带「平台」；
 *   3. 点智能体卡片 → 先建会话再跳 /chat/:id（openAgent）；
 *   4. 点「启动流水线」→ 调 pipelineApi.start 后跳 /pipeline/:runId。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ElementPlus from 'element-plus'
import Home from '@/views/Home.vue'
import { useUserStore } from '@/store/user'

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }),
}))
vi.mock('@/composables/useAuthGuard', () => ({ useAuthGuard: () => ({ requireLogin: () => true }) }))

const { listTeams, listAgents, createConversation, startPipeline } = vi.hoisted(() => ({
  listTeams: vi.fn(),
  listAgents: vi.fn(),
  createConversation: vi.fn(),
  startPipeline: vi.fn(),
}))
vi.mock('@/api', () => ({
  teamApi: { list: listTeams },
  agentApi: { list: listAgents },
  conversationApi: { create: createConversation },
  pipelineApi: { start: startPipeline },
  logApiError: () => {},
  toFriendlyError: (error) => error?.message || '出错了',
}))

const platformTeam = { id: 'team-1', name: '毕业设计流水线', description: null, isPlatform: true, agents: [] }
const platformAgent = {
  id: 'agent-1',
  teamId: 'team-1',
  name: '需求分析与开题工程师',
  isPlatform: true,
  stageNo: 1,
  sort: 10,
  sourceType: 'external',
  systemPrompt: null,
  icon: null,
  createdAt: '2026-10-14T06:00:00Z',
}
const privateAgent = {
  ...platformAgent,
  id: 'agent-2',
  teamId: null,
  name: '我的私有智能体',
  isPlatform: false,
  stageNo: 2,
  sort: 20,
  sourceType: 'self_hosted',
  systemPrompt: '私有智能体的提示词',
}

async function mountHome() {
  const pinia = createPinia()
  setActivePinia(pinia)
  useUserStore().token = 'test-token'
  const wrapper = mount(Home, { global: { plugins: [ElementPlus, pinia] } })
  await flushPromises()
  return wrapper
}

describe('views/Home —— 工作台现状（重构前的行为基线）', () => {
  beforeEach(() => {
    push.mockReset()
    listTeams.mockReset().mockResolvedValue([platformTeam])
    listAgents.mockReset().mockResolvedValue([platformAgent, privateAgent])
    createConversation.mockReset().mockResolvedValue({ id: 'conv-1' })
    startPipeline.mockReset().mockResolvedValue({ run: { id: 'run-1' } })
  })

  it('分组正确：团队一组 + 未分组，isPlatform 透传', async () => {
    const wrapper = await mountHome()
    const blocks = wrapper.findAll('.team-block')
    expect(blocks.length).toBe(2)
    const teamBlock = blocks.find((b) => b.text().includes('毕业设计流水线'))
    expect(teamBlock.text()).toContain('平台公共')
    expect(teamBlock.findAll('.agent-card').length).toBe(1)
    const looseBlock = blocks.find((b) => b.text().includes('未分组'))
    expect(looseBlock.findAll('.agent-card').length).toBe(1)
  })

  it('平台智能体卡片带「平台」徽标，私有卡片不带', async () => {
    const wrapper = await mountHome()
    const platformCard = wrapper.findAll('.agent-card').find((c) => c.text().includes('需求分析与开题工程师'))
    const privateCard = wrapper.findAll('.agent-card').find((c) => c.text().includes('我的私有智能体'))
    expect(platformCard.text()).toContain('平台')
    expect(privateCard.text()).not.toContain('平台')
  })

  it('点智能体卡片 → 先建会话再跳 /chat/:id', async () => {
    const wrapper = await mountHome()
    await wrapper
      .findAll('.agent-card')
      .find((c) => c.text().includes('需求分析与开题工程师'))
      .trigger('click')
    await flushPromises()
    expect(createConversation).toHaveBeenCalledWith({ agentDefId: 'agent-1', title: '需求分析与开题工程师' })
    expect(push).toHaveBeenCalledWith('/chat/conv-1')
  })

  it('点「启动流水线」→ pipelineApi.start 后跳 /pipeline/:runId', async () => {
    const wrapper = await mountHome()
    const button = wrapper.findAll('button').find((b) => b.text().includes('启动流水线'))
    await button.trigger('click')
    await flushPromises()
    expect(startPipeline).toHaveBeenCalledWith('team-1')
    expect(push).toHaveBeenCalledWith('/pipeline/run-1')
  })

  it('项目卡片流：每张项目卡带阶段数徽标，头部分览带「平台」计数', async () => {
    const wrapper = await mountHome()
    const teamBlock = wrapper.findAll('.team-block').find((b) => b.text().includes('毕业设计流水线'))
    expect(teamBlock.text()).toContain('阶段 1')
    const looseBlock = wrapper.findAll('.team-block').find((b) => b.text().includes('未分组'))
    expect(looseBlock.text()).toContain('阶段 1')

    const stats = wrapper.findAll('.workbench__stat')
    const platformStat = stats.find((s) => s.text().includes('平台'))
    expect(platformStat).toBeTruthy()
    expect(platformStat.text()).toContain('1')
  })
})

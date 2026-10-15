// @vitest-environment happy-dom
/**
 * TeamTemplateWizard 组件测试（Paperclip 参照 · §C2 团队模板）
 * ------------------------------------------------------------------
 * 钉住三件事：
 *   1. 密钥没填全 → **不发任何请求**（不能创建一堆半成品）；
 *   2. 填全 → 恰好创建 1 团队 + 5 外部智能体，且每个智能体的 payload 关键字段正确；
 *   3. 成功后通知宿主（emit created）并显示完成态。
 *
 * 模板为什么是"预填 + 收 key"而不是静默全自动：外部智能体 appKey 明文只进不出，
 * 平台公共智能体又只读 —— 见组件头部注释。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import TeamTemplateWizard from '@/components/TeamTemplateWizard.vue'

const { createTeam, createAgent } = vi.hoisted(() => ({ createTeam: vi.fn(), createAgent: vi.fn() }))

vi.mock('@/api', () => ({
  teamApi: { create: createTeam },
  agentApi: { create: createAgent },
  logApiError: () => {},
  toFriendlyError: (error) => error?.message || '出错了',
}))

const q = (selector) => new DOMWrapper(document.querySelector(selector))

function mountWizard() {
  const wrapper = mount(TeamTemplateWizard, {
    global: { plugins: [ElementPlus] },
    props: { modelValue: true },
    attachTo: document.body,
  })
  return wrapper
}

async function fillAll() {
  for (const stage of [
    '①毕设选题与立项顾问',
    '②需求分析与开题工程师',
    '③架构与数据库设计工程师',
    '④代码开发与测试工程师',
    '⑤毕业论文规范工程师',
  ]) {
    await q(`input[aria-label="${stage} 上游 id"]`).setValue(`${stage} 的 id`)
    await q(`input[aria-label="${stage} appKey"]`).setValue(`key-${stage.slice(0, 1)}`)
  }
}

/** Modal 走 Teleport，按钮都在 body 上 */
async function clickByText(text) {
  const button = [...document.querySelectorAll('button')].find((node) => node.textContent.includes(text))
  await new DOMWrapper(button).trigger('click')
}

describe('TeamTemplateWizard', () => {
  beforeEach(() => {
    createTeam.mockReset()
    createAgent.mockReset()
    createTeam.mockResolvedValue({ id: 'team-1', name: '我的毕设流水线' })
    createAgent.mockResolvedValue({ id: 'agent-x' })
    document.body.innerHTML = ''
  })

  it('密钥没填全：不发请求，并提示缺什么', async () => {
    mountWizard()
    await clickByText('创建')
    await flushPromises()

    expect(createTeam).not.toHaveBeenCalled()
    expect(createAgent).not.toHaveBeenCalled()
    expect(document.querySelector('[role="alert"]').textContent).toContain('还缺')
  })

  it('填全：创建 1 团队 + 5 外部智能体，payload 关键字段正确', async () => {
    mountWizard()
    await fillAll()
    await clickByText('创建')
    await flushPromises()

    expect(createTeam).toHaveBeenCalledTimes(1)
    expect(createTeam.mock.calls[0][0]).toMatchObject({ name: '我的毕设流水线' })

    expect(createAgent).toHaveBeenCalledTimes(5)
    const payloads = createAgent.mock.calls.map((call) => call[0])
    // 阶段号 1..5 且顺序正确
    expect(payloads.map((p) => p.stageNo)).toEqual([1, 2, 3, 4, 5])
    // 都是外部智能体、挂在模板团队下、来源 external
    for (const p of payloads) {
      expect(p).toMatchObject({ teamId: 'team-1', sourceType: 'external', providerCredId: null, model: null })
      expect(p.externalAgentId).toBeTruthy()
      expect(p.externalToken).toBeTruthy()
      expect(p.externalBaseUrl).toBe('https://your-agent.example.com')
    }

    // 完成态（宿主 Teams.vue 监听 @created="load()" 刷新列表；此处用可观察的完成文案断言）
    expect(document.body.textContent).toContain('已创建团队与 5 个智能体')
  })
})

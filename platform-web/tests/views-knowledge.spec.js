// @vitest-environment happy-dom
/**
 * Knowledge（知识库管理页）组件测试（设计评审 P0-4）
 * ------------------------------------------------------------------
 * 后端接口早已就绪，此处只钉前端行为：
 *   1. 列表：平台文档带「平台」徽标且只读（无删除按钮），我的文档可删；
 *   2. 新建：name/content 必填校验 + 调 knowledgeApi.create；
 *   3. 删除：确认后调 knowledgeApi.remove。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import Knowledge from '@/views/Knowledge.vue'

const { list, create, remove } = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), remove: vi.fn() }))
const toast = { success: vi.fn(), error: vi.fn() }
vi.mock('@/api', () => ({
  knowledgeApi: { list, create, remove },
  logApiError: () => {},
  toFriendlyError: (error) => error?.message || '出错了',
}))
vi.mock('@/composables/useToast', () => ({ useToast: () => toast }))

const PLATFORM_DOC = {
  id: 'k1',
  name: '毕业论文格式规范.txt',
  bytes: 184_320,
  isPlatform: true,
  createdAt: '2026-10-01T00:00:00Z',
}
const MINE_DOC = {
  id: 'k2',
  name: '我的开题资料.txt',
  bytes: 24_880,
  isPlatform: false,
  createdAt: '2026-10-10T00:00:00Z',
}

async function mountKnowledge() {
  const wrapper = mount(Knowledge, { global: { plugins: [ElementPlus] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

async function clickByText(text) {
  const button = [...document.querySelectorAll('button')].find((node) => node.textContent.includes(text))
  await new DOMWrapper(button).trigger('click')
}

describe('views/Knowledge', () => {
  beforeEach(() => {
    list.mockReset().mockResolvedValue([PLATFORM_DOC, MINE_DOC])
    create.mockReset().mockResolvedValue({ id: 'k3' })
    remove.mockReset().mockResolvedValue(undefined)
    toast.success.mockReset()
    document.body.innerHTML = ''
  })

  it('列表：平台文档带徽标且只读，我的文档有删除按钮', async () => {
    const wrapper = await mountKnowledge()
    expect(wrapper.text()).toContain('毕业论文格式规范.txt')
    expect(wrapper.text()).toContain('平台')
    expect(wrapper.text()).toContain('只读')
    expect(wrapper.text()).toContain('我的开题资料.txt')
    // 平台文档没有「删除」，我的文档有
    const deleteButtons = [...document.querySelectorAll('button')].filter((b) => b.textContent.includes('删除'))
    expect(deleteButtons.length).toBe(1)
    expect(wrapper.text()).toContain('180 KB')
  })

  it('新建：校验通过后调 knowledgeApi.create 并刷新列表', async () => {
    await mountKnowledge()
    await clickByText('新建文档') // Empty 态无内容时用这个；有内容时点页头按钮
    await flushPromises()

    // 先空提交 → 校验提示，不发请求
    await clickByText('创建')
    await flushPromises()
    expect(create).not.toHaveBeenCalled()

    await new DOMWrapper(document.querySelector('input[aria-label="文档名"]')).setValue('开题规范')
    await new DOMWrapper(document.querySelector('textarea[aria-label="正文"]')).setValue('这是一段要注入的资料')
    await clickByText('创建')
    await flushPromises()

    expect(create).toHaveBeenCalledWith({ name: '开题规范', content: '这是一段要注入的资料' })
    expect(list).toHaveBeenCalledTimes(2) // 初始 + 创建后刷新
    expect(toast.success).toHaveBeenCalled()
  })

  it('删除：确认后调 knowledgeApi.remove', async () => {
    await mountKnowledge()
    await clickByText('删除')
    await flushPromises()
    await clickByText('确认删除')
    await flushPromises()
    expect(remove).toHaveBeenCalledWith('k2')
  })
})

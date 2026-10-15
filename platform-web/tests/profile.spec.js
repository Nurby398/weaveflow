// @vitest-environment happy-dom
/**
 * Profile（个人中心可编辑）组件测试（设计评审 P0-8）
 * ------------------------------------------------------------------
 * 钉住：昵称保存成功更新 store / 404 降级提示 / 改密码空表单不发请求。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ElementPlus from 'element-plus'
import Profile from '@/views/Profile.vue'
import { useUserStore } from '@/store/user'

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }
vi.mock('@/composables/useToast', () => ({ useToast: () => toast }))

const { updateProfile, changePassword, logoutAll } = vi.hoisted(() => ({
  updateProfile: vi.fn(),
  changePassword: vi.fn(),
  logoutAll: vi.fn(),
}))
vi.mock('@/api', () => ({
  userApi: { updateProfile, changePassword, logoutAll, getProfile: vi.fn() },
  logApiError: () => {},
  toFriendlyError: (error) => error?.message || '出错了',
}))

async function mountProfile() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useUserStore()
  store.token = 'test-token'
  store.userInfo = { id: 'u1', nickname: '旧昵称', role: 'user' }
  const wrapper = mount(Profile, { global: { plugins: [ElementPlus, pinia] } })
  return { wrapper, store }
}

describe('views/Profile', () => {
  beforeEach(() => {
    updateProfile.mockReset()
    changePassword.mockReset()
    logoutAll.mockReset()
    push.mockReset()
  })

  it('保存昵称成功 → 调 updateProfile 并更新 store', async () => {
    updateProfile.mockResolvedValue({ id: 'u1', nickname: '新昵称' })
    const { wrapper, store } = await mountProfile()

    await wrapper.find('input[aria-label="昵称"]').setValue('新昵称')
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('保存昵称'))
      .trigger('click')
    await flushPromises()

    expect(updateProfile).toHaveBeenCalledWith({ nickname: '新昵称' })
    expect(store.userInfo.nickname).toBe('新昵称')
    expect(toast.success).toHaveBeenCalled()
  })

  it('保存昵称 404 → 降级提示「FE-B12 未就绪」', async () => {
    updateProfile.mockRejectedValue({ status: 404 })
    const { wrapper } = await mountProfile()

    await wrapper.find('input[aria-label="昵称"]').setValue('新昵称')
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('保存昵称'))
      .trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('FE-B12 未就绪')
  })

  it('改密码空表单 → 不发请求并提示', async () => {
    const { wrapper } = await mountProfile()
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('修改密码'))
      .trigger('click')
    await flushPromises()
    expect(changePassword).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('请填写当前密码与新密码')
  })
})

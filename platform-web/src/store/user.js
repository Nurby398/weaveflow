/**
 * 用户登录态 Store
 * 只保留状态与动作骨架：真实登录一律调用 api/index.js 的 authApi，不做任何本地 mock。
 * 同时再导出 isLoggedIn，保持与 ai-code-education 的引用路径兼容。
 */
import { defineStore } from 'pinia'
import { authApi, userApi } from '@/api'
import { clearAuth, getStoredUser, getToken, isLoggedIn, setRefreshToken, setStoredUser, setToken } from '@/utils/auth'
import { reportEvent } from '@/lib/telemetry'

export { isLoggedIn }

/** /auth/login 返回 { accessToken, refreshToken, user }；包裹层适配已收敛在 api/index.js */
function pickSession(result) {
  const payload = result ?? {}
  return {
    token: payload.accessToken || payload.token || '',
    refreshToken: payload.refreshToken || '',
    userInfo: payload.user || payload.userInfo || null,
  }
}

export const useUserStore = defineStore('user', {
  state: () => ({
    token: getToken(),
    userInfo: getStoredUser(),
    loading: false,
  }),

  getters: {
    loggedIn: (state) => !!state.token,
    role: (state) => state.userInfo?.role || '',
    displayName: (state) => state.userInfo?.nickname || state.userInfo?.username || '未登录',
  },

  actions: {
    /** 登录：调用真实后端接口 */
    async login(payload) {
      this.loading = true
      try {
        const result = await authApi.login(payload)
        const { token, refreshToken, userInfo } = pickSession(result)
        if (!token) throw new Error('登录响应中缺少 token')
        this.setSession(token, userInfo, refreshToken)
        // 埋点（W2-6）：登录漏斗事件；端点未配置时零网络请求
        reportEvent('login', { userId: userInfo?.id ?? null })
        return result
      } finally {
        this.loading = false
      }
    },

    /** 注册：后端 /auth/register 同样返回令牌对，注册成功即进入登录态 */
    async register(payload) {
      this.loading = true
      try {
        const result = await authApi.register(payload)
        const { token, refreshToken, userInfo } = pickSession(result)
        if (!token) throw new Error('注册响应中缺少 token')
        this.setSession(token, userInfo, refreshToken)
        return result
      } finally {
        this.loading = false
      }
    },

    /** 写入登录态（refreshToken 传 undefined 表示「本次不修改」，保持既有两参调用兼容） */
    setSession(token, userInfo, refreshToken) {
      this.token = token || ''
      setToken(this.token)
      if (refreshToken !== undefined) setRefreshToken(refreshToken)
      if (userInfo) {
        this.userInfo = userInfo
        setStoredUser(userInfo)
      }
    },

    /** 拉取当前用户信息 */
    async fetchProfile() {
      const info = await userApi.getProfile()
      if (info) {
        this.userInfo = info
        setStoredUser(info)
      }
      return this.userInfo
    },

    /** 退出登录：后端未提供 /auth/logout，直接清空本地登录态 */
    async logout() {
      this.reset()
    },

    /** 清空本地登录态 */
    reset() {
      clearAuth()
      this.token = ''
      this.userInfo = null
    },
  },
})

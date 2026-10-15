/**
 * 登录凭证存取工具
 * 逻辑与 ai-code-education/src/utils/auth.js 保持一致，仅调整 storage key 前缀与注释。
 * 既有对外 API 完全不变：getToken / setToken / removeToken / getStoredUser / setStoredUser / clearAuth / isLoggedIn
 * 2026-10-14 新增（纯加法）：getRefreshToken / setRefreshToken / removeRefreshToken —— 供 401 静默续期使用
 */

const TOKEN_KEY = 'platform_token'
const USER_KEY = 'platform_user'
const REFRESH_KEY = 'platform_refresh'

/* ------------------------------ token ------------------------------ */

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY)
}

/* --------------------------- refresh token --------------------------- */

/**
 * refresh token 与 access token 分开存。
 * 原因：access token 只有 15 分钟，过期后由 client.js 用它静默换新（refresh 有效期 30 天），
 * 否则用户每 15 分钟就会被踢回登录页。
 */
export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY) || ''
}

export function setRefreshToken(token) {
  if (token) localStorage.setItem(REFRESH_KEY, token)
  else localStorage.removeItem(REFRESH_KEY)
}

export function removeRefreshToken() {
  localStorage.removeItem(REFRESH_KEY)
}

/* ---------------------------- 用户信息 ---------------------------- */

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    // 本地数据被破坏时直接丢弃，避免阻塞应用启动
    localStorage.removeItem(USER_KEY)
    return null
  }
}

export function setStoredUser(userInfo) {
  localStorage.setItem(USER_KEY, JSON.stringify(userInfo || {}))
}

export function removeStoredUser() {
  localStorage.removeItem(USER_KEY)
}

/* ------------------------------ 组合 ------------------------------ */

/** 是否已登录（当前以是否存在 token 作为唯一判定依据） */
export function isLoggedIn() {
  return !!getToken()
}

/** 清空本地登录态 */
export function clearAuth() {
  removeToken()
  removeRefreshToken()
  removeStoredUser()
}

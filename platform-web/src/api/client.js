/**
 * Axios 客户端（JSON 请求的唯一出口）
 * ------------------------------------------------------------------
 * 本文件把「HTTP 客户端」从裸 fetch 换成 axios，同时保持调用方看到的
 * 请求形态与错误形态与改造前完全一致（tests/api.spec.js 与 tests/pipeline.spec.js
 * 断言的就是这套形态）：
 *
 * 1. 适配器（adapter）是 axios 官方扩展点，这里实现一个 fetch 适配器：
 *    - 浏览器里 fetch 与 axios 内置 xhr/http 适配器能力等价，但它在测试环境
 *      （node）下可被 stub，且不需要为相对路径套 Request 对象（内置 fetch 适配器
 *      要求绝对 URL，相对 baseURL 会直接失败）；
 *    - 请求仍然以 `fetch(url, init)` 发出，init 里的 method / headers / body
 *      与改造前逐字一致：没有请求体的 POST / DELETE 不带 Content-Type
 *      （Fastify 见到 application/json 会以 FST_ERR_CTP_EMPTY_JSON_BODY 回 400）。
 * 2. 请求拦截器负责注入 Authorization；响应拦截器负责 401 钩子与中断类错误归一。
 * 3. validateStatus 恒真：HTTP 状态码由 request() 自己判定并抛出，与改造前一致
 *    （错误对象带 status / data / message，见 src/api/index.js 的 toFriendlyError）。
 * ------------------------------------------------------------------
 */
import axios, { AxiosError } from 'axios'
import { getRefreshToken, getToken, setRefreshToken, setToken } from '@/utils/auth'

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'
export const TIMEOUT = 15000

/* ============================ 401 钩子 ============================ */

/** 401 处理钩子（request.js / stream.js / 附件上传共用同一份状态） */
let unauthorizedHandler = null

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === 'function' ? handler : null
}

/** 触发 401 钩子 */
export function triggerUnauthorized(response) {
  if (unauthorizedHandler) unauthorizedHandler(response)
}

/* ============================== 工具 ============================== */

/** 判断是否为 FormData（SSR / 测试环境下可能不存在） */
export function isFormData(data) {
  return typeof FormData !== 'undefined' && data instanceof FormData
}

/** 绝对 URL 判定（与 axios 内部 isAbsoluteURL 同义） */
function isAbsoluteURL(url) {
  return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url)
}

/** 拼出最终地址：baseURL + url + 序列化后的 params（与改造前的模板字符串逐字一致） */
export function buildUrl(config) {
  const url = config.url || ''
  const base = config.baseURL || ''
  const full = isAbsoluteURL(url) ? url : `${base}${url}`

  if (!config.params) return full

  const search =
    typeof config.paramsSerializer === 'function'
      ? config.paramsSerializer(config.params)
      : new URLSearchParams(config.params).toString()

  if (!search) return full
  return `${full}${full.includes('?') ? '&' : '?'}${search}`
}

/** AxiosHeaders → 普通对象，丢掉空值（fetch 的 init.headers 需要一个朴素对象） */
function plainHeaders(headers) {
  const source = typeof headers?.toJSON === 'function' ? headers.toJSON() : { ...(headers || {}) }
  const out = {}
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined || value === null) continue
    out[key] = value
  }
  return out
}

/* ============================ 响应体解析 ============================ */

/**
 * 与改造前一致：空体 → null；JSON → 对象；非 JSON（如网关 HTML 错误页）→ 原文。
 */
export function parseBody(text) {
  if (typeof text !== 'string' || text === '') return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/* ============================= 适配器 ============================= */

/**
 * fetch 适配器：把 axios 的 config 变成一次 fetch 调用。
 * 超时与外部 signal 的联动沿用改造前的 AbortController 方案。
 */
async function fetchAdapter(config) {
  const method = String(config.method || 'GET').toUpperCase()
  const controller = new AbortController()
  const timeout = config.timeout ?? TIMEOUT
  const timer = timeout > 0 ? setTimeout(() => controller.abort(), timeout) : null

  const external = config.signal
  if (external) {
    if (external.aborted) controller.abort()
    else external.addEventListener('abort', () => controller.abort(), { once: true })
  }

  try {
    const response = await fetch(buildUrl(config), {
      method,
      headers: plainHeaders(config.headers),
      body: config.data === undefined ? undefined : config.data,
      signal: controller.signal,
    })

    // 响应体在这里一次性读成文本，JSON 解析交给 transformResponse
    const text = await response.text()

    return {
      data: text,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      config,
      request: response,
    }
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/* ============================ 错误归一 ============================ */

/**
 * 中断类错误归一成 AbortError：
 * 改造前超时/中断都是 fetch 抛出的 DOMException(AbortError)，
 * toFriendlyError() 依赖 name === 'AbortError' 判定「请求已中断」。
 */
function normalizeTransportError(error) {
  const canceled =
    error?.name === 'CanceledError' ||
    error?.code === AxiosError.ERR_CANCELED ||
    error?.code === AxiosError.ETIMEDOUT ||
    error?.code === AxiosError.ECONNABORTED

  if (!canceled) return error

  const aborted = new Error('请求已中断')
  aborted.name = 'AbortError'
  aborted.aborted = true
  return aborted
}

/* ============================= 实例 ============================= */

export const service = axios.create({
  baseURL: BASE_URL,
  timeout: TIMEOUT,
  adapter: fetchAdapter,
  // 状态码交给 request() 判定，axios 不因 4xx/5xx 抛错
  validateStatus: () => true,
  // 响应体解析沿用改造前的容错策略（空体 null / 非 JSON 原文）
  transformResponse: [parseBody],
})

service.interceptors.request.use((config) => {
  const token = getToken()
  if (token && !config.headers.has('Authorization')) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  return config
})

service.interceptors.response.use(
  // 401 不在这里直接清登录态：交给 request.js / stream.js 先尝试静默续期，
  // 续期失败才由 handleUnauthorized() 唤起登录弹窗。
  // （改造前在这里无条件 triggerUnauthorized，导致 access token 一过 15 分钟就把用户踢下线。）
  (response) => response,
  (error) => Promise.reject(normalizeTransportError(error)),
)

/* ========================= 401 静默续期 ========================= */

/**
 * 单飞（single-flight）：并发多个 401 只发起一次刷新，其余等待同一个 Promise。
 * 成功返回新的 accessToken，失败（无 refresh token / 后端拒绝 / 网络异常）返回 null。
 */
let refreshPromise = null

export function refreshSession() {
  if (refreshPromise) return refreshPromise

  const refreshToken = getRefreshToken()
  if (!refreshToken) return Promise.resolve(null)

  refreshPromise = (async () => {
    try {
      const response = await service.request({
        url: '/auth/refresh',
        method: 'POST',
        data: JSON.stringify({ refreshToken }),
        headers: { 'Content-Type': 'application/json' },
        timeout: TIMEOUT,
      })
      const payload = response.data
      if (response.status >= 200 && response.status < 300 && payload && payload.accessToken) {
        setToken(payload.accessToken)
        // 后端采用轮换策略：新 refresh token 一并写回
        if (payload.refreshToken) setRefreshToken(payload.refreshToken)
        return payload.accessToken
      }
      return null
    } catch {
      // 网络异常同样视为续期失败，由调用方决定是否登出
      return null
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

/**
 * 统一的 401 处理入口（axios 路径与 SSE 路径共用）：
 * - 续期成功 → 返回 true，调用方原样重放一次请求；
 * - 续期失败 → 清登录态 + 唤起登录弹窗，返回 false。
 */
export async function handleUnauthorized(response) {
  const token = await refreshSession()
  if (token) return true
  triggerUnauthorized(response)
  return false
}

export default service

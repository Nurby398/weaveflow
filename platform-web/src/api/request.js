/**
 * 统一请求封装（axios + fetch 适配器）
 * 保留 ai-code-education 的骨架签名：http.get/post/put/delete + request(url, options)
 *
 * 客户端本身（axios 实例 / fetch 适配器 / 拦截器）在 ./client.js。本文件只负责业务语义：
 * 1. multipart 分支：FormData 不参与 JSON.stringify，也不手动设置 Content-Type（boundary 由浏览器生成）；
 * 2. 401 处理钩子：由 main.js 注入「清登录态 + 唤起登录弹窗」，request 与 stream 共用；
 * 3. 非 JSON 响应容错：网关返回 HTML 错误页时不再抛 JSON 解析异常；
 * 4. omitContentType：允许「无 body 的 POST」完全不发 Content-Type（见下方注释）。
 *
 * SSE 流式仍走 fetch（axios 不支持 ReadableStream 增量读取），见 ./stream.js。
 */
import service, { handleUnauthorized, isFormData, setUnauthorizedHandler, triggerUnauthorized } from './client'

const TIMEOUT = 15000

// 保持既有对外 API：这几处从 request.js 转出，调用点（main.js / api/index.js / stream.js）无需改动
export { isFormData, setUnauthorizedHandler, triggerUnauthorized, handleUnauthorized }

/**
 * 发起请求
 * @param {string} url 接口路径（不含 BASE_URL，由 axios 实例的 baseURL 拼接）
 * @param {{ method?: string, data?: any, params?: object, headers?: object, timeout?: number, signal?: AbortSignal, omitContentType?: boolean }} options
 * @returns {Promise<any>} 后端返回的 JSON 数据（非 JSON 时原样返回文本）
 */
export async function request(url, options = {}) {
  const { method = 'GET', data, params, headers = {}, timeout = TIMEOUT, signal, omitContentType = false } = options

  const multipart = isFormData(data)
  // 本请求是否真的带请求体：GET 一律没有，其余方法看 data 是否为空
  const hasBody = method !== 'GET' && data != null

  /**
   * multipart 必须交给浏览器生成 boundary，手动设置会导致后端解析失败。
   * 无 body 的非 GET 请求也不能声明 application/json：Fastify 见到该 content-type 就会
   * 尝试解析请求体，空 body 直接以 400（FST_ERR_CTP_EMPTY_JSON_BODY）拒绝，请求进不到业务处理。
   * 受影响的是「无参数 POST / DELETE」（如 provider 连通性测试、解绑外部接入、各种删除），
   * 它们此前统一回 400，调用方永远看不到真实结论。GET 不受该约束，保持原样。
   * 值为 null 表示「删除该请求头」——axios 的 headers 合并把 null 当移除，只有这样
   * 才能压掉 axios 对无 body 的 POST 默认加上的 application/x-www-form-urlencoded。
   */
  const contentType = multipart || omitContentType || !(hasBody || method === 'GET') ? null : 'application/json'

  const response = await service.request({
    url,
    method,
    params,
    // 请求体在进入 axios 之前就序列化好，与实际发出的字节完全一致
    data: hasBody ? (multipart ? data : JSON.stringify(data)) : undefined,
    headers: {
      'Content-Type': contentType,
      ...headers,
    },
    timeout,
    signal,
  })

  /**
   * 401 处理：先用 refresh token 静默续期（access token 只有 15 分钟），
   * 续期成功就原样重放一次（__retried 防无限循环）；失败才判定登录失效。
   */
  if (response.status === 401) {
    if (options.__retried) {
      triggerUnauthorized(response)
    } else if (await handleUnauthorized(response)) {
      return request(url, { ...options, __retried: true })
    }
  }

  if (response.status >= 200 && response.status < 300) return response.data

  const payload = response.data
  const message =
    (payload && typeof payload === 'object' && (payload.message || payload.msg)) || `请求失败（${response.status}）`
  const error = new Error(message)
  error.status = response.status
  error.data = payload
  throw error
}

/** 常用请求方法快捷方式 */
export const http = {
  get: (url, params, options) => request(url, { ...options, method: 'GET', params }),
  post: (url, data, options) => request(url, { ...options, method: 'POST', data }),
  put: (url, data, options) => request(url, { ...options, method: 'PUT', data }),
  delete: (url, params, options) => request(url, { ...options, method: 'DELETE', params }),
  /** 文件上传：传 FormData */
  upload: (url, formData, options) => request(url, { ...options, method: 'POST', data: formData }),
  patch: (url, data, options) => request(url, { ...options, method: 'PATCH', data }),
}

export default http

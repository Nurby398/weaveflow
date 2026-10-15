/**
 * 接口层（唯一对接点）
 * ------------------------------------------------------------------
 * 1. 后端当前返回「裸对象」（如 { agents: [] } / { agent: {...} }），
 *    但包裹层尚未最终确认，因此所有响应包裹适配集中在本文件顶部的 unwrap()，
 *    页面只拿业务数据，不散落 `res.data.data` 之类的猜测。
 * 2. 错误提示统一走 toFriendlyError()：后端原文只进 console，不直接弹给用户。
 * 3. 附件上传走 XMLHttpRequest（fetch 无法提供上传进度）。
 * ------------------------------------------------------------------
 */
import http, { triggerUnauthorized } from './request'
import { getToken } from '@/utils/auth'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

/* ============================ 响应适配 ============================ */

/**
 * 取出业务负载。
 * - 裸对象：原样返回；
 * - 未来若改为 { code, data } / { success, data } 包裹层：这里一次性兼容。
 */
export function unwrap(result) {
  if (result && typeof result === 'object' && !Array.isArray(result) && 'data' in result) {
    if ('code' in result || 'success' in result) return result.data
  }
  return result
}

/** 列表接口：{ <key>: [...] } → [] */
async function fetchList(promise, key) {
  const data = unwrap(await promise)
  return Array.isArray(data?.[key]) ? data[key] : []
}

/** 单体接口：{ <key>: {...} } → 对象（缺失时回落到整个负载） */
async function fetchOne(promise, key) {
  const data = unwrap(await promise)
  if (data && typeof data === 'object' && data[key] !== undefined) return data[key]
  return data ?? null
}

/* ============================ 错误提示 ============================ */

const STATUS_TEXT = {
  400: '提交的内容不合法，请检查后重试',
  401: '登录已过期，请重新登录',
  403: '没有访问权限',
  404: '目标不存在或已被删除',
  409: '数据已被占用，请刷新后重试',
  413: '文件过大，请更换更小的文件',
  415: '不支持该文件类型',
  429: '操作过于频繁，请稍后再试',
}

/**
 * 把任意异常转成可展示给用户的中文提示。
 * 后端返回的原文（可能含内部细节）只写进 console，不进入 UI。
 */
export function toFriendlyError(error) {
  if (!error) return '操作失败，请稍后重试'
  if (error.name === 'AbortError' || error.aborted) return '请求已中断'
  if (error.status) {
    if (STATUS_TEXT[error.status]) return STATUS_TEXT[error.status]
    if (error.status >= 500) return '服务暂时不可用，请稍后重试'
  }
  // fetch 在断网 / 跨域失败时抛 TypeError
  if (error instanceof TypeError) return '网络异常，请检查网络后重试'
  return '操作失败，请稍后重试'
}

/** 后端原文只保留在控制台，便于排查 */
export function logApiError(error, scope = 'api') {
  const detail = error?.data?.message || error?.data?.msg || error?.message
  if (detail) console.warn(`[${scope}]`, detail, error?.status ?? '')
}

/* ============================== 认证 ============================== */

export const authApi = {
  /** → { accessToken, refreshToken, user } */
  login: (data) => http.post('/auth/login', data).then(unwrap),
  register: (data) => http.post('/auth/register', data).then(unwrap),
  refresh: (refreshToken) => http.post('/auth/refresh', { refreshToken }).then(unwrap),
}

export const userApi = {
  /** GET /api/me → 用户对象 */
  getProfile: () => fetchOne(http.get('/me'), 'user'),
}

/* =========================== Provider =========================== */

export const providerApi = {
  /** 列表（apiKey 只返回掩码 apiKeyHint） */
  list: () => fetchList(http.get('/providers'), 'providers'),
  create: (data) => fetchOne(http.post('/providers', data), 'provider'),
  remove: (id) => http.delete(`/providers/${id}`),
  /** 连通性测试 → { providerId, ok, status, latencyMs, modelCount, error? } */
  test: (id) => http.post(`/providers/${id}/test`).then(unwrap),
}

/* ============================ 知识库 ============================ */

export const knowledgeApi = {
  /** 列表不带正文 */
  list: () => fetchList(http.get('/knowledge'), 'knowledge'),
  create: (data) => fetchOne(http.post('/knowledge', data), 'knowledge'),
  remove: (id) => http.delete(`/knowledge/${id}`),
}

/* ============================= 智能体 ============================= */

export const agentApi = {
  list: () => fetchList(http.get('/agents'), 'agents'),
  /**
   * 新建 / 修改。
   * 外部接入字段：sourceType('self_hosted' | 'external')、externalBaseUrl、
   * externalAgentId、externalToken（明文进、掩码出；省略该键即「不修改」）。
   */
  create: (data) => fetchOne(http.post('/agents', data), 'agent'),
  update: (id, patch) => fetchOne(http.patch(`/agents/${id}`, patch), 'agent'),
  remove: (id) => http.delete(`/agents/${id}`),
  /** 解绑外部接入 */
  removeExternal: (id) => http.delete(`/agents/${id}/external`),
  /** 外部智能体连通性测试 → { ok, status, latencyMs, error? } */
  testExternal: (id) => http.post(`/agents/${id}/external/test`).then(unwrap),
}

/* ============================== 团队 ============================== */

export const teamApi = {
  /** 列表项已内联 agents */
  list: () => fetchList(http.get('/teams'), 'teams'),
  create: (data) => fetchOne(http.post('/teams', data), 'team'),
  update: (id, patch) => fetchOne(http.patch(`/teams/${id}`, patch), 'team'),
  remove: (id) => http.delete(`/teams/${id}`),
}

/* ============================== 会话 ============================== */

export const conversationApi = {
  list: () => fetchList(http.get('/conversations'), 'conversations'),
  /** 必须提供 agentDefId，或 teamId + stageNo */
  create: (data) => fetchOne(http.post('/conversations', data), 'conversation'),
  /** 改名 → 200 { conversation }，与 create 同形，统一由 fetchOne 取 */
  rename: (id, title) => fetchOne(http.patch(`/conversations/${id}`, { title }), 'conversation'),
  /** 删除 → 204 空体（request() 对空响应体返回 null，不解析 JSON） */
  remove: (id) => http.delete(`/conversations/${id}`),
  messages: (id) => fetchList(http.get(`/conversations/${id}/messages`), 'messages'),
}

/* ============================== 流水线 ============================== */

export const pipelineApi = {
  /** 启动流水线 → 201 { run, stage }；首阶段会话 id 在 stage.conversationId */
  start: (teamId) => http.post(`/pipeline/${teamId}/start`).then(unwrap),
  /**
   * 读取运行详情。真后端把 stages 与 run **平级**返回：
   *   { run: { id, teamId, currentStage, status, stageCount, createdAt }, stages: [...] }
   * 页面只消费 run.stages，因此这里把平级的 stages 并进 run，保持单一数据源。
   */
  get: async (runId) => {
    const data = unwrap(await http.get(`/pipeline/${runId}`))
    const run = data?.run ?? null
    if (!run || typeof run !== 'object') return null
    return { ...run, stages: Array.isArray(data?.stages) ? data.stages : [] }
  },
  /**
   * 确认本阶段产出并流转 → 200 成功；契约未通过时后端回 422 CONTRACT_INVALID。
   * 必须 omitContentType：本接口没有请求体，一旦带上 content-type: application/json，
   * Fastify 会把它当成「空的 JSON body」直接回 400，调用方永远看不到契约详情。
   */
  advance: (runId) => http.post(`/pipeline/${runId}/advance`, undefined, { omitContentType: true }).then(unwrap),
}

/* ============================== 意见反馈 ============================== */

/**
 * 意见反馈（登录页「Contact us」入口）
 * ------------------------------------------------------------------
 * ⚠️ 这是**匿名接口**：入口在登录页，调用时通常没有 token，所以：
 *   1. 请求层不会附带 Authorization（没 token 就不带，见 api/client.js 的请求拦截器）；
 *   2. 后端必须把该路由放进**鉴权白名单**，并配限流 + 验证码防滥用
 *      （验证码用 Redis 存 —— 见 docs/平台开发进度与交接.md §5.1 D16）。
 *
 * 后端实现计划：落库 `feedback` 表 + 通过 QQ 邮箱 SMTP 发通知给管理员。
 * 后端就绪前，调用会拿到 404，页面会显示「反馈通道正在建设中」（见 FeedbackModal.vue）。
 */
export const feedbackApi = {
  /**
   * 提交反馈
   * @param {{ type: string, content: string, contact?: string }} payload
   * @returns {Promise<any>} 后端返回体（约定含 id 或 ok）
   */
  create: (payload) => http.post('/feedback', payload).then(unwrap),
}

/* ============================== 成本 ============================== */

/**
 * 成本面板（Paperclip 参照 · 支出追踪）
 * ------------------------------------------------------------------
 * 后端接口 FE-B19 未就绪：`GET /api/usage/summary` 现为 404。
 * 契约（见 docs/前端驱动-后端待实现清单-v1.md）：
 *   summary = { currency, totalCost, totalTokensIn, totalTokensOut, budget, budgetUsedRatio, byTeam[] }
 * byTeam[] = { teamId, teamName, isPlatform, cost, tokensIn, tokensOut, runs }
 * 前端在 `VITE_MOCK_COST` 开启时走 lib/costDemo.js 的演示数据；关闭时走真实接口。
 */
export const costApi = {
  summary: () => fetchOne(http.get('/usage/summary'), 'summary'),
}

/* ============================== 运行历史 ============================== */

/**
 * 运行历史（Paperclip 参照 · 运行历史 & 追踪）
 * ------------------------------------------------------------------
 * 后端接口 FE-B11 未就绪：`GET /api/pipeline/runs` 现为 404。
 * 契约：runs[] = { runId, teamId, teamName, isPlatform, status, currentStage, stageCount,
 *                  startedAt, updatedAt, failure }
 * 前端在 `VITE_MOCK_RUNS` 开启时走 lib/runsDemo.js；关闭时走真实接口。
 */
export const runsApi = {
  list: () => fetchList(http.get('/pipeline/runs'), 'runs'),
}

/* ============================== 评测 ============================== */

/**
 * 评测（Paperclip 参照 · Evals）
 * ------------------------------------------------------------------
 * 后端接口 FE-B20 未就绪：`GET /api/evals/cases` / `POST /api/evals/run` 现为 404。
 * 契约：cases[] = { caseId, name, input, expectedKeyPoints[] }
 *       runs[]  = { runId, caseId, caseName, agentName, score, durationMs, tokensIn, tokensOut, createdAt }
 * 前端在 `VITE_MOCK_EVALS` 开启时走 lib/evalsDemo.js；关闭时走真实接口。
 */
export const evalsApi = {
  cases: () => fetchList(http.get('/evals/cases'), 'cases'),
  runs: () => fetchList(http.get('/evals/runs'), 'runs'),
  run: (payload) => fetchOne(http.post('/evals/run', payload), 'run'),
}

/* ============================== 附件 ============================== */

/**
 * 上传附件（XHR，带真实进度）
 * @param {File} file
 * @param {{ conversationId?: string, onProgress?: (ratio: number) => void }} options
 * @returns {Promise<{ id, filename, mime, bytes, hasText } | null>}
 */
export function uploadAttachment(file, options = {}) {
  const { conversationId = '', onProgress } = options

  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append('file', file)

    const query = conversationId ? `?conversationId=${encodeURIComponent(conversationId)}` : ''
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${BASE_URL}/attachments${query}`)

    const token = getToken()
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total)
    }

    xhr.onload = () => {
      let body = null
      try {
        body = JSON.parse(xhr.responseText || 'null')
      } catch {
        body = null
      }
      if (xhr.status === 401) triggerUnauthorized(xhr)
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1)
        resolve(unwrap(body)?.attachment ?? null)
        return
      }
      const error = new Error('上传失败')
      error.status = xhr.status
      error.data = body
      reject(error)
    }

    xhr.onerror = () => reject(new TypeError('网络异常'))
    xhr.send(form)
  })
}

/** 附件原文件地址（预览） */
export function attachmentRawUrl(id) {
  return `${BASE_URL}/attachments/${id}/raw`
}

export default {
  authApi,
  userApi,
  providerApi,
  knowledgeApi,
  agentApi,
  teamApi,
  conversationApi,
  pipelineApi,
  uploadAttachment,
  attachmentRawUrl,
}

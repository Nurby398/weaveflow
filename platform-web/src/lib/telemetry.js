/**
 * 前端可观测性（Wave 2 · W2-5 的起步）
 * ------------------------------------------------------------------
 * 现状与目标：
 *   · 现在页面里**零全局错误处理**：一个渲染异常就是白屏，用户只能看到空白；
 *   · 这里先做"能兜住 + 能留痕 + 能上报（可选）"，不引入任何第三方 SDK。
 *
 * 降级策略（重要）：
 *   上报端点属于后端待实现项 **FE-B16**（`POST /api/telemetry`）。端点未配置时
 *   **不发任何网络请求**，只留内存环形缓冲 + console —— 前端进度不被后端阻塞。
 *   配置方式：构建时给 `VITE_TELEMETRY_URL`（见 .env.*），未设置即为关闭。
 *
 * 设计约束：
 *   · reportError 自身**绝不能抛**（它常在错误处理路径上被调用）；
 *   · 缓冲区有上限，避免长会话内存膨胀；
 *   · 每条错误带一个稳定 **digest**（短哈希）：用户报障时报编号，维护者能对上同一条。
 */

const MAX_RECORDS = 20

/** @type {{ digest: string, message: string, info: string, at: string, stack?: string }[]} */
const buffer = []

/** 极简 32 位哈希 → 8 位十六进制。只为"同一条错误同一个编号"，不做加密。 */
function digestOf(text) {
  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/** 上报端点：构建时注入；空字符串 = 关闭（默认） */
function endpoint() {
  try {
    const value = import.meta.env?.VITE_TELEMETRY_URL
    return typeof value === 'string' ? value.trim() : ''
  } catch {
    return ''
  }
}

function describe(error) {
  if (error instanceof Error) return { message: error.message || error.name, stack: error.stack }
  if (typeof error === 'string') return { message: error }
  try {
    return { message: JSON.stringify(error) }
  } catch {
    return { message: String(error) }
  }
}

/**
 * 记录一条前端错误。返回记录（调用方拿 digest 展示给用户）。
 * @param {unknown} error
 * @param {{ source?: string, info?: string, extra?: Record<string, unknown> }} [context]
 */
export function reportError(error, context = {}) {
  let record
  try {
    const { message, stack } = describe(error)
    const source = context.source || 'unknown'
    const info = context.info || ''
    record = {
      digest: digestOf(`${source}|${info}|${message}`),
      message: String(message).slice(0, 300),
      info: String(info).slice(0, 200),
      at: new Date().toISOString(),
      ...(stack ? { stack: String(stack).slice(0, 1000) } : {}),
    }
    buffer.push(record)
    if (buffer.length > MAX_RECORDS) buffer.shift()
  } catch {
    return { digest: 'unknown', message: '错误记录失败', info: '', at: new Date().toISOString() }
  }

  // 控制台留一份（开发与线上排查都靠它）
  try {
    console.error(`[telemetry:${record.digest}]`, record.message, context)
  } catch {
    /* 忽略 */
  }

  // 端点未配置 → 到此为止（FE-B16 未就绪时的正式降级路径）
  const url = endpoint()
  if (!url) return record

  try {
    const body = JSON.stringify({
      ...record,
      source: context.source || 'unknown',
      extra: context.extra ?? null,
      url: typeof location !== 'undefined' ? location.href : '',
      ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    })
    // 用 sendBeacon 优先：页面正在崩溃/卸载时 fetch 会被取消
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
    } else {
      fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body }).catch(() => {})
    }
  } catch {
    /* 上报失败绝不能影响主流程 */
  }
  return record
}

/** 最近记录（诊断页/测试用） */
export function recentErrors() {
  return [...buffer]
}

/** 通用上报通道（FE-B16 同端点）：端点未配置时静默，sendBeacon 优先，失败绝不抛。 */
function sendJson(payload) {
  const url = endpoint()
  if (!url) return
  try {
    const body = JSON.stringify(payload)
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
    } else {
      fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body }).catch(() => {})
    }
  } catch {
    /* 上报失败不影响主流程 */
  }
}

/**
 * 埋点（W2-6）：关键漏斗事件（注册/登录/建会话/首次消息/启动流水线）。
 * 与错误上报共用 FE-B16 端点，载荷带 type:'event' 区分。
 */
export function reportEvent(name, props = {}) {
  try {
    sendJson({ type: 'event', name: String(name), props: props ?? {}, at: new Date().toISOString() })
  } catch {
    /* 绝不抛 */
  }
}

/**
 * Web Vitals（W2-5）：上报 LCP/CLS/INP/FCP 等指标。
 * 与错误上报共用 FE-B16 端点，载荷带 type:'metric' 区分。
 */
export function reportMetric(name, value, extra = {}) {
  try {
    sendJson({ type: 'metric', name: String(name), value, extra: extra ?? {}, at: new Date().toISOString() })
  } catch {
    /* 绝不抛 */
  }
}

/** 安装全局兜底：Vue 的 errorHandler + 浏览器侧的 error/unhandledrejection */
export function installGlobalErrorHandlers(app) {
  app.config.errorHandler = (error, _instance, info) => {
    reportError(error, { source: 'vue', info })
  }

  if (typeof window === 'undefined') return
  window.addEventListener('error', (event) => {
    // 资源加载失败（img/script）没有 error 对象，走 message
    reportError(event.error ?? event.message ?? 'resource error', {
      source: 'window.error',
      info: event.filename ? `${event.filename}:${event.lineno}` : '',
    })
  })
  window.addEventListener('unhandledrejection', (event) => {
    reportError(event.reason ?? 'unhandled rejection', { source: 'unhandledrejection' })
  })
}

/**
 * SSE 流式客户端
 * ------------------------------------------------------------------
 * 后端要求 POST + Authorization 请求头，因此无法使用 EventSource（它只支持 GET 且不能带自定义头），
 * 必须使用 fetch + ReadableStream 手动解析。
 *
 * 切分与解析逻辑抽成纯函数 parseSSEChunk，便于单元测试（含跨 chunk 的不完整事件缓冲）。
 * ------------------------------------------------------------------
 */
import { getToken, isLoggedIn } from '@/utils/auth'
import { handleUnauthorized, isFormData, triggerUnauthorized } from './request'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

/**
 * 解析单个事件块（不含结尾空行）
 * @param {string} raw
 * @returns {{ event: string, data: string, id: string, retry: number|null } | null}
 */
function parseEventBlock(raw) {
  if (!raw) return null

  const dataLines = []
  let event = ''
  let id = ''
  let retry = null

  for (const line of raw.split('\n')) {
    // 空行与以 ':' 开头的注释行（服务端心跳）直接跳过
    if (line === '' || line.startsWith(':')) continue

    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    let value = colon === -1 ? '' : line.slice(colon + 1)
    // 规范：冒号后仅跳过第一个空格
    if (value.startsWith(' ')) value = value.slice(1)

    if (field === 'data') dataLines.push(value)
    else if (field === 'event') event = value
    else if (field === 'id') id = value
    else if (field === 'retry') {
      const parsed = Number(value)
      if (!Number.isNaN(parsed)) retry = parsed
    }
  }

  // 既没有 data 也没有 event 的块（纯注释 / 心跳）不产生事件
  if (!dataLines.length && !event) return null
  return { event, data: dataLines.join('\n'), id, retry }
}

/**
 * 纯函数：从缓冲区中切出所有「已完整」的 SSE 事件。
 * 调用方负责把 rest 拼到下一次读取的文本前面，从而正确缓冲跨 chunk 的不完整事件。
 * @param {string} buffer 上次残留 + 本次新读到的文本
 * @returns {{ events: Array<{ event: string, data: string, id: string, retry: number|null }>, rest: string }}
 */
export function parseSSEChunk(buffer) {
  const events = []
  // 兼容 CRLF 行尾；残留的孤立 \r 会在下次拼接后归一化
  let pending = String(buffer ?? '').replace(/\r\n/g, '\n')

  let boundary = pending.indexOf('\n\n')
  while (boundary !== -1) {
    const raw = pending.slice(0, boundary)
    pending = pending.slice(boundary + 2)
    const event = parseEventBlock(raw)
    if (event) events.push(event)
    boundary = pending.indexOf('\n\n')
  }

  return { events, rest: pending }
}

/**
 * 发起 SSE 流式请求
 * @param {string} url 接口路径（不含 BASE_URL）
 * @param {{
 *   method?: string, data?: any, headers?: object, signal?: AbortSignal,
 *   onDelta?: (data: string, event: object) => void,
 *   onEvent?: (event: object) => void,
 *   onDone?: () => void,
 *   onError?: (error: Error) => void,
 * }} options
 * @returns {Promise<{ aborted: boolean, error?: Error }>}
 */
export async function streamSSE(url, options = {}) {
  const { method = 'POST', data, headers = {}, signal, onDelta, onEvent, onDone, onError } = options

  const multipart = isFormData(data)

  /** 真正发出一次流式请求（重放时复用同一份参数） */
  const doFetch = () =>
    fetch(`${BASE_URL}${url}`, {
      method,
      headers: {
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
        ...(multipart ? {} : { 'Content-Type': 'application/json' }),
        ...(isLoggedIn() ? { Authorization: `Bearer ${getToken()}` } : {}),
        ...headers,
      },
      body: data == null || method === 'GET' ? undefined : multipart ? data : JSON.stringify(data),
      signal,
    })

  try {
    let response = await doFetch()

    if (response.status === 401) {
      // 与 JSON 请求同一套续期逻辑：续期到了就重放一次流；失败则唤起登录弹窗
      if (await handleUnauthorized(response)) {
        response = await doFetch()
        if (response.status === 401) triggerUnauthorized(response)
      }
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      const error = new Error(text || `流式请求失败（${response.status}）`)
      error.status = response.status
      throw error
    }

    if (!response.body) throw new Error('当前环境不支持流式响应（response.body 为空）')

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let finished = false

    while (!finished) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const { events, rest } = parseSSEChunk(buffer)
      buffer = rest

      for (const event of events) {
        if (event.data === '[DONE]') {
          finished = true
          break
        }
        onEvent?.(event)
        onDelta?.(event.data, event)
      }
    }

    // 收尾：冲刷解码器残留字节，并把没有以空行结尾的最后一个事件补出来
    if (!finished) {
      buffer += decoder.decode()
      if (buffer.trim()) {
        const { events } = parseSSEChunk(`${buffer}\n\n`)
        for (const event of events) {
          if (event.data === '[DONE]') continue
          onEvent?.(event)
          onDelta?.(event.data, event)
        }
      }
    }

    onDone?.()
    return { aborted: false }
  } catch (error) {
    // 主动中断（AbortSignal）不算错误
    if (signal?.aborted) return { aborted: true }
    if (onError) {
      onError(error)
      return { aborted: false, error }
    }
    throw error
  }
}

/**
 * 便捷封装：返回可中断的流句柄
 * @returns {{ abort: () => void, done: Promise<{ aborted: boolean }> }}
 */
export function createSSEStream(url, options = {}) {
  const controller = new AbortController()
  const done = streamSSE(url, { ...options, signal: controller.signal })
  return { abort: () => controller.abort(), done }
}

export default createSSEStream

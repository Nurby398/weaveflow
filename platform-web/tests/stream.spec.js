import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSSEStream, parseSSEChunk, streamSSE } from '@/api/stream'
import { setUnauthorizedHandler } from '@/api/request'

/** Node 环境没有 localStorage，补一个最小实现（auth.js 会用到） */
function createStorageMock() {
  const store = new Map()
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  }
}

/** 构造一个按顺序吐出文本块的 fetch 响应 */
function fetchWithChunks(chunks) {
  const encoder = new TextEncoder()
  return vi.fn(
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
            controller.close()
          },
        }),
        { status: 200 },
      ),
  )
}

/** 逐块喂给 parseSSEChunk，模拟流式读取时的缓冲区累积 */
function feed(chunks) {
  let buffer = ''
  const events = []
  for (const chunk of chunks) {
    buffer += chunk
    const result = parseSSEChunk(buffer)
    buffer = result.rest
    events.push(...result.events)
  }
  return { events, rest: buffer }
}

describe('parseSSEChunk', () => {
  it('解析单个完整事件并清空缓冲区', () => {
    const { events, rest } = parseSSEChunk('data: hello\n\n')
    expect(events).toEqual([{ event: '', data: 'hello', id: '', retry: null }])
    expect(rest).toBe('')
  })

  it('跨 chunk 切分：不完整事件被缓冲，拼齐后才产出', () => {
    let buffer = ''
    const events = []

    const step1 = parseSSEChunk((buffer += 'data: hel'))
    buffer = step1.rest
    events.push(...step1.events)
    expect(step1.events).toEqual([])
    expect(buffer).toBe('data: hel')

    const step2 = parseSSEChunk((buffer += 'lo\n'))
    buffer = step2.rest
    events.push(...step2.events)
    expect(step2.events).toEqual([])

    const step3 = parseSSEChunk((buffer += '\n'))
    buffer = step3.rest
    events.push(...step3.events)
    expect(events).toEqual([{ event: '', data: 'hello', id: '', retry: null }])
    expect(buffer).toBe('')
  })

  it('一次读取切出多个事件，并保留尾部不完整片段', () => {
    const { events, rest } = parseSSEChunk('data: 一\n\ndata: 二\n\ndata: 三')
    expect(events.map((e) => e.data)).toEqual(['一', '二'])
    expect(rest).toBe('data: 三')
  })

  it('多行 data 以换行合并，并解析 event / id / retry 字段', () => {
    const { events } = parseSSEChunk('event: message\nid: 42\nretry: 3000\ndata: a\ndata: b\n\n')
    expect(events).toEqual([{ event: 'message', data: 'a\nb', id: '42', retry: 3000 }])
  })

  it('忽略注释行（心跳）与纯注释事件块', () => {
    const { events } = parseSSEChunk(': keep-alive\n\ndata: real\n\n: ping\n\n')
    expect(events).toEqual([{ event: '', data: 'real', id: '', retry: null }])
  })

  it('兼容 CRLF 行尾以及跨 chunk 断裂的 CRLF', () => {
    const { events } = feed(['data: a\r\n\r\ndata: b\r', '\n\r\n'])
    expect(events.map((e) => e.data)).toEqual(['a', 'b'])
  })

  it('透传 [DONE] 标记，由上层决定终止', () => {
    const { events } = feed(['data: 片段\n\ndata: [DONE]\n\n'])
    expect(events.map((e) => e.data)).toEqual(['片段', '[DONE]'])
  })

  it('冒号后只跳过一个空格，无冒号行按空值字段处理', () => {
    const { events } = parseSSEChunk('data:  两个空格\n\n')
    expect(events[0].data).toBe(' 两个空格')
  })

  it('返回值稳定：空输入不产出事件', () => {
    expect(parseSSEChunk('').events).toEqual([])
    expect(parseSSEChunk(undefined).rest).toBe('')
  })
})

describe('streamSSE', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorageMock())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    setUnauthorizedHandler(null)
  })

  it('按 chunk 增量回调 onDelta，遇到 [DONE] 后停止且只回调一次 onDone', async () => {
    // 事件被人为切断在三个 chunk 之间，验证缓冲逻辑
    vi.stubGlobal('fetch', fetchWithChunks(['data: 你', '好\n\ndata: 世', '界\n\ndata: [DONE]\n\ndata: 不该出现\n\n']))

    const deltas = []
    let doneCount = 0
    const result = await streamSSE('/ai/stream', {
      data: { prompt: 'hi' },
      onDelta: (delta) => deltas.push(delta),
      onDone: () => {
        doneCount += 1
      },
    })

    expect(deltas).toEqual(['你好', '世界'])
    expect(doneCount).toBe(1)
    expect(result).toEqual({ aborted: false })
  })

  it('尾部没有空行结尾的最后一个事件也会被冲刷出来', async () => {
    vi.stubGlobal('fetch', fetchWithChunks(['data: 没有空行结尾']))

    const deltas = []
    await streamSSE('/ai/stream', { onDelta: (delta) => deltas.push(delta) })
    expect(deltas).toEqual(['没有空行结尾'])
  })

  it('AbortSignal 中断返回 aborted，且不触发 onError', async () => {
    const encoder = new TextEncoder()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init) => {
        const signal = init?.signal
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode('data: first\n\n'))
            const timer = setTimeout(() => {
              controller.enqueue(encoder.encode('data: second\n\n'))
              controller.close()
            }, 20)
            signal?.addEventListener('abort', () => {
              clearTimeout(timer)
              controller.error(new DOMException('Aborted', 'AbortError'))
            })
          },
        })
        return new Response(stream, { status: 200 })
      }),
    )

    const controller = new AbortController()
    const deltas = []
    let errorCalled = false

    const result = await streamSSE('/ai/stream', {
      signal: controller.signal,
      onDelta: (delta) => {
        deltas.push(delta)
        if (delta === 'first') controller.abort()
      },
      onError: () => {
        errorCalled = true
      },
    })

    expect(result.aborted).toBe(true)
    expect(deltas).toEqual(['first'])
    expect(errorCalled).toBe(false)
  })

  it('createSSEStream 返回可中断句柄', async () => {
    vi.stubGlobal('fetch', fetchWithChunks(['data: ok\n\ndata: [DONE]\n\n']))
    const deltas = []
    const handle = createSSEStream('/ai/stream', { onDelta: (delta) => deltas.push(delta) })
    await handle.done
    expect(deltas).toEqual(['ok'])
  })

  it('401 触发全局 unauthorized 钩子并抛出错误', async () => {
    let unauthorizedCalled = false
    setUnauthorizedHandler(() => {
      unauthorizedCalled = true
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Unauthorized', { status: 401 })),
    )

    await expect(streamSSE('/ai/stream')).rejects.toThrow('Unauthorized')
    expect(unauthorizedCalled).toBe(true)
  })

  it('携带 Authorization 头（带 token 时）', async () => {
    localStorage.setItem('platform_token', 'test-token')
    const fetchMock = fetchWithChunks(['data: x\n\n'])
    vi.stubGlobal('fetch', fetchMock)

    await streamSSE('/ai/stream', { data: { a: 1 } })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/ai/stream')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer test-token')
    expect(init.headers.Accept).toBe('text/event-stream')
    expect(JSON.parse(init.body)).toEqual({ a: 1 })
  })
})

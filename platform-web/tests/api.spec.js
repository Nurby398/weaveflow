import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { http, request, setUnauthorizedHandler } from '@/api/request'
import { clearAuth, getStoredUser, getToken, isLoggedIn, setStoredUser, setToken } from '@/utils/auth'

/** Node 环境没有 localStorage，补一个最小实现 */
function createStorageMock() {
  const store = new Map()
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  }
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('utils/auth 对外 API', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorageMock())
  })

  afterEach(() => vi.unstubAllGlobals())

  it('token 读写与登录判定', () => {
    expect(getToken()).toBe('')
    expect(isLoggedIn()).toBe(false)

    setToken('abc')
    expect(getToken()).toBe('abc')
    expect(isLoggedIn()).toBe(true)
  })

  it('用户信息读写与 clearAuth', () => {
    setStoredUser({ username: 'ops', role: 'admin' })
    expect(getStoredUser()).toEqual({ username: 'ops', role: 'admin' })

    clearAuth()
    expect(getToken()).toBe('')
    expect(getStoredUser()).toBeNull()
  })

  it('本地用户信息损坏时返回 null 且不抛异常', () => {
    localStorage.setItem('platform_user', '{坏数据')
    expect(getStoredUser()).toBeNull()
    expect(localStorage.getItem('platform_user')).toBeNull()
  })
})

describe('api/request', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorageMock())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    setUnauthorizedHandler(null)
  })

  it('GET 拼接 query 并自动带 Authorization', async () => {
    setToken('tk')
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await http.get('/agents', { page: 1, size: 10 })

    expect(result).toEqual({ ok: true })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/agents?page=1&size=10')
    expect(init.method).toBe('GET')
    expect(init.body).toBeUndefined()
    expect(init.headers.Authorization).toBe('Bearer tk')
    expect(init.headers['Content-Type']).toBe('application/json')
  })

  it('POST 的 JSON body 被序列化', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    await http.post('/flows/run', { name: 'demo' })

    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(init.body).toBe('{"name":"demo"}')
  })

  /**
   * 回归防线：无 body 的 POST / DELETE 也不能声明 application/json。
   * 真后端（Fastify）见到该 content-type 就解析空请求体并回 400 FST_ERR_CTP_EMPTY_JSON_BODY，
   * 于是 provider 连通性测试、解绑外部接入这些「无参数 POST / DELETE」全部拿不到真实结论。
   */
  it('无 body 的 DELETE 不声明 JSON content-type', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    await http.delete('/agents/abc/external')

    const [, init] = fetchMock.mock.calls[0]
    expect(init.body).toBeUndefined()
    expect(init.headers['Content-Type']).toBeUndefined()
  })

  it('无 body 的 POST（连通性测试）不声明 JSON content-type', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    await http.post('/providers/abc/test')

    const [, init] = fetchMock.mock.calls[0]
    expect(init.body).toBeUndefined()
    expect(init.headers['Content-Type']).toBeUndefined()
  })

  it('multipart 分支：FormData 不序列化且不手动设置 Content-Type', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    const formData = new FormData()
    formData.append('file', new Blob(['hello']), 'a.txt')
    formData.append('kind', 'avatar')

    await http.upload('/user/avatar', formData)

    const [, init] = fetchMock.mock.calls[0]
    expect(init.body).toBe(formData)
    expect(init.headers['Content-Type']).toBeUndefined()
  })

  it('401 触发钩子并抛出带 status 的错误', async () => {
    let called = 0
    setUnauthorizedHandler(() => {
      called += 1
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ message: '登录已过期' }, 401)),
    )

    await expect(request('/user/profile')).rejects.toMatchObject({ status: 401, message: '登录已过期' })
    expect(called).toBe(1)
  })

  it('非 JSON 响应（网关 HTML 错误页）不抛解析异常', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>502 Bad Gateway</html>', { status: 502 })),
    )

    await expect(request('/agents')).rejects.toMatchObject({ status: 502 })
  })
})

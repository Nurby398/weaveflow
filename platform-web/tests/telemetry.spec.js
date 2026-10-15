/**
 * lib/telemetry 单测（Wave 2 · W2-1/W2-5）
 * ------------------------------------------------------------------
 * 钉住三件事：
 *   1. 同一条错误永远是同一个 digest（用户报编号 → 维护者能对上）；
 *   2. **端点未配置时绝不发网络请求**（FE-B16 未就绪的正式降级路径）；
 *   3. 缓冲区有上限，长会话不会无限膨胀。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installGlobalErrorHandlers, recentErrors, reportError, reportEvent, reportMetric } from '@/lib/telemetry'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('lib/telemetry', () => {
  it('同一条错误 digest 稳定，不同错误不同', () => {
    const a = reportError(new Error('同样的错'), { source: 'unit' })
    const b = reportError(new Error('同样的错'), { source: 'unit' })
    const c = reportError(new Error('另一种错'), { source: 'unit' })

    expect(a.digest).toBe(b.digest)
    expect(a.digest).not.toBe(c.digest)
    expect(a.digest).toMatch(/^[0-9a-f]{8}$/)
  })

  it('非 Error 输入也能记（字符串 / 普通对象 / null），绝不抛', () => {
    expect(reportError('裸字符串').message).toBe('裸字符串')
    expect(reportError({ code: 500 }).message).toContain('500')
    expect(() => reportError(null)).not.toThrow()
    expect(() => reportError(undefined)).not.toThrow()
  })

  it('端点未配置：不发任何网络请求（降级路径）', () => {
    vi.stubEnv('VITE_TELEMETRY_URL', '')
    const fetchSpy = vi.fn()
    const beaconSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    vi.stubGlobal('navigator', { sendBeacon: beaconSpy })

    reportError(new Error('不该上报'), { source: 'unit' })

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(beaconSpy).not.toHaveBeenCalled()
  })

  it('端点已配置：走 sendBeacon 上报且带 digest', () => {
    vi.stubEnv('VITE_TELEMETRY_URL', 'https://telemetry.test/collect')
    const beaconSpy = vi.fn(() => true)
    vi.stubGlobal('navigator', { sendBeacon: beaconSpy })
    vi.stubGlobal(
      'Blob',
      class BlobStub {
        constructor(parts) {
          this.parts = parts
        }
      },
    )

    const record = reportError(new Error('要上报'), { source: 'unit' })

    expect(beaconSpy).toHaveBeenCalledTimes(1)
    expect(beaconSpy.mock.calls[0][0]).toBe('https://telemetry.test/collect')
    expect(record.digest).toBeTruthy()
  })

  it('缓冲区有上限（20 条）', () => {
    for (let i = 0; i < 30; i += 1) {
      reportError(new Error(`批量错误 ${i}`), { source: 'unit' })
    }
    const all = recentErrors()
    expect(all.length).toBeLessThanOrEqual(20)
    // 保留的是最近的：最后一条一定在里面
    expect(all[all.length - 1].message).toContain('批量错误 29')
  })

  it('installGlobalErrorHandlers 接上 Vue 的 errorHandler', () => {
    const app = { config: {} }
    installGlobalErrorHandlers(app)
    expect(typeof app.config.errorHandler).toBe('function')

    // 走一遍：异常被记录而不是抛出去
    expect(() => app.config.errorHandler(new Error('事件回调里的错'), null, 'click handler')).not.toThrow()
  })

  it('reportEvent / reportMetric：端点未配置时不发网络请求（W2-5/W2-6）', () => {
    vi.stubEnv('VITE_TELEMETRY_URL', '')
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response(null)))
    expect(() => reportEvent('login', { userId: 'u1' })).not.toThrow()
    expect(() => reportMetric('LCP', 123)).not.toThrow()
    expect(spy).not.toHaveBeenCalled()
  })
})

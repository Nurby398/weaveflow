/**
 * Web Vitals 采集（Wave 2 · W2-5）
 * ------------------------------------------------------------------
 * 用原生 PerformanceObserver 采 LCP / CLS / INP / FCP，不引第三方 SDK。
 * 上报走 lib/telemetry.js 的 reportMetric（端点 FE-B16 未配置时**零网络请求**，
 * 所以安装本身是安全的：没配端点就什么都不发）。
 */
import { reportMetric } from '@/lib/telemetry'

function observe(type, toMetric) {
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) toMetric(entry)
    })
    observer.observe({ type, buffered: true })
  } catch {
    /* 不支持该指标就跳过，绝不影响主流程 */
  }
}

/** 安装所有 Web Vitals 观察器。可在应用启动后立即调用。 */
export function installWebVitals() {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return

  observe('largest-contentful-paint', (entry) => {
    reportMetric('LCP', Math.round(entry.startTime))
  })
  observe('layout-shift', (entry) => {
    if (!entry.hadRecentInput) reportMetric('CLS', Number(entry.value.toFixed(4)))
  })
  observe('first-input', (entry) => {
    reportMetric('INP', Math.round(entry.processingStart - entry.startTime))
  })
  observe('paint', (entry) => {
    if (entry.name === 'first-contentful-paint') reportMetric('FCP', Math.round(entry.startTime))
  })
}

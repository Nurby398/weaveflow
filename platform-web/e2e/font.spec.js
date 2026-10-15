/**
 * E2E · 自托管字体（Wave 2 · W2-2 的验收）
 * ------------------------------------------------------------------
 * 这条测试回答两个问题，且**两者都必须成立**：
 *   1. 字体真的从**本站**加载并可用（不是"声明了但没生效"）；
 *   2. 全站**没有任何**第三方字体请求（内网/等保部署不能依赖外网）。
 *
 * 注意：helpers 里的 blockExternal 会 abort 外网字体请求，但 abort 依然会产生 request 事件，
 * 所以"有没有试图访问 fonts.googleapis.com"是可观测的 —— 谁把外链加回来，这条就红。
 */
import { expect, test } from '@playwright/test'

test('自托管字体：本地可加载，且不请求任何第三方字体 CDN', async ({ page }) => {
  const woff2 = []
  const externalFontRequests = []
  page.on('response', (response) => {
    if (response.url().includes('.woff2')) woff2.push(response.url())
  })
  page.on('request', (request) => {
    if (/fonts\.(googleapis|gstatic)\.com/.test(request.url())) {
      externalFontRequests.push(request.url())
    }
  })

  await page.goto('/login', { waitUntil: 'domcontentloaded' })

  const font = await page.evaluate(async () => {
    const faces = await document.fonts.load('700 16px Quantico', 'WEAVEFLOW')
    return {
      faceCount: faces.length,
      usable: document.fonts.check('700 16px Quantico', 'WEAVEFLOW'),
    }
  })

  expect(font.faceCount).toBeGreaterThan(0)
  expect(font.usable).toBe(true)

  // 字体文件全部来自本站（127.0.0.1 = 本地 dev server / 预览服务）
  expect(woff2.length).toBeGreaterThan(0)
  for (const url of woff2) expect(url).toMatch(/127\.0\.0\.1|localhost/)

  // 外网字体 CDN：一个请求都不该有
  expect(externalFontRequests).toEqual([])
})

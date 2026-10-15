/**
 * E2E · 视觉回归（W1-4）
 * ------------------------------------------------------------------
 * 目的：**样式/布局被误改**时立刻报警（改一处 CSS 影响另一屏，是这类项目最常见的回归）。
 *
 * ⚠️ baseline 的平台约束（重要）：
 *   截图对字体抗锯齿/渲染引擎敏感，跨平台必然有像素差。当前 baseline 在 **Windows** 生成
 *   （文件名带 `-win32` 后缀），所以在 CI（Linux）里默认跳过 —— 不是"测试不重要"，
 *   而是**不能在两个平台共用一套基准**。企业里的标准做法是把视觉回归放进固定镜像（Docker）跑；
 *   本仓先按本地门禁执行，CI 侧留位。
 *   首个跑法：`npm run test:e2e:visual:update`（生成基准）→ 之后 `npm run test:e2e:visual`（比对）。
 *
 * 覆盖：工作台 / 智能体 / 团队 × 明暗（桌面）+ 对话 × 明暗（桌面）+ 工作台/对话 窄屏 = 9 张。
 * 对话页必须先"点智能体开会话"才会出现输入区（裸 /chat 只有选择器），所以单独走 openChat()。
 */
import { expect, test } from '@playwright/test'
import { gotoApp, preparePublic, prepareVisual, shotOptions } from './helpers.js'

// 见文件头说明：基准绑定生成平台，CI 上跳过（换 Docker 基准后即可打开）
test.skip(Boolean(process.env.CI), '视觉基准由 Windows 生成，CI(Linux) 渲染差异不做门禁')

const DESKTOP = { width: 1280, height: 800 }
const MOBILE = { width: 390, height: 844 }
const PLATFORM_AGENT = '需求分析与开题工程师'

/**
 * 公开页（未登录即可看）：**拉丁展示字最集中**的两屏 —— 视觉基准对字体/排版改动是否敏感，
 * 主要靠这两屏（登录后那几屏正文几乎全是中文，用系统字体，字体换了像素也不变）。
 */
const PUBLIC_PAGES = [
  { name: 'login', path: '/login', ready: 'form' },
  { name: 'about', path: '/about', ready: '.about__title-line' },
]

for (const theme of ['light', 'dark']) {
  for (const item of PUBLIC_PAGES) {
    test(`[visual] ${item.name} · ${theme}`, async ({ page }) => {
      await preparePublic(page, { theme, ...DESKTOP })
      await gotoApp(page, item.path)
      await expect(page.locator(item.ready).first()).toBeVisible()
      await expect(page).toHaveScreenshot(`${item.name}-${theme}.png`, shotOptions(page))
    })
  }
}

/** 从工作台点平台智能体 → 建会话 → 落到有输入区的对话页 */
async function openChat(page) {
  await gotoApp(page, '/')
  await page.locator('.agent-card', { hasText: PLATFORM_AGENT }).click()
  await expect(page).toHaveURL(/\/chat\//)
  await expect(page.locator('textarea[aria-label="消息输入"]')).toBeVisible()
}

const SIMPLE_PAGES = [
  { name: 'home', path: '/', ready: '.agent-card' },
  { name: 'agents', path: '/agents', ready: '.agents__item' },
  { name: 'teams', path: '/teams', ready: '.teams__items' },
]

for (const theme of ['light', 'dark']) {
  for (const item of SIMPLE_PAGES) {
    test(`[visual] ${item.name} · ${theme}`, async ({ page }) => {
      await prepareVisual(page, { theme, ...DESKTOP })
      await gotoApp(page, item.path)
      await expect(page.locator(item.ready).first()).toBeVisible()
      await expect(page).toHaveScreenshot(`${item.name}-${theme}.png`, shotOptions(page))
    })
  }

  test(`[visual] chat · ${theme}`, async ({ page }) => {
    await prepareVisual(page, { theme, ...DESKTOP })
    await openChat(page)
    await expect(page).toHaveScreenshot(`chat-${theme}.png`, shotOptions(page))
  })
}

test('[visual] home · 窄屏（390px）', async ({ page }) => {
  await prepareVisual(page, { theme: 'light', ...MOBILE })
  await gotoApp(page, '/')
  await expect(page.locator('.agent-card').first()).toBeVisible()
  await expect(page).toHaveScreenshot('home-mobile.png', shotOptions(page))
})

test('[visual] chat · 窄屏（390px）', async ({ page }) => {
  await prepareVisual(page, { theme: 'light', ...MOBILE })
  await openChat(page)
  await expect(page).toHaveScreenshot('chat-mobile.png', shotOptions(page))
})

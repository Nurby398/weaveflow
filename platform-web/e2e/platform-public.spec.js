/**
 * E2E · 平台公共资源主路径（D18–D24 的用户可见面）
 * ------------------------------------------------------------------
 * 三条路径对应产品承诺：
 *   1. 登录后**工作台就能看见**平台公共智能体（带「平台」徽标）；
 *   2. **智能体页选中平台智能体 → 没有任何写入口**；切回私有智能体写入口必须恢复；
 *   3. **点平台智能体直接开聊**，消息能流式回来。
 *
 * 全程跑在假后端上（scripts/mock-api.mjs，其中前两个智能体标了 isPlatform: true），
 * 所以 CI 里不需要真后端也能跑。
 */
import { expect, test } from '@playwright/test'
import { gotoApp, login } from './helpers.js'

const PLATFORM_AGENT = '需求分析与开题工程师' // mock 里 isPlatform: true
const PRIVATE_AGENT = '代码开发与测试工程师' // mock 里未标平台 → 私有

test('登录后工作台能看到平台公共智能体，且只有它带「平台」徽标', async ({ page }) => {
  await login(page)
  await gotoApp(page, '/')

  const platformCard = page.locator('.agent-card', { hasText: PLATFORM_AGENT })
  const privateCard = page.locator('.agent-card', { hasText: PRIVATE_AGENT })

  await expect(platformCard).toBeVisible()
  await expect(privateCard).toBeVisible()
  await expect(platformCard).toContainText('平台')
  await expect(privateCard).not.toContainText('平台')
})

test('智能体页：平台智能体只读（无保存/删除、表单 inert），私有智能体照旧可写', async ({ page }) => {
  await login(page)
  await gotoApp(page, '/agents')

  await page.locator('.agents__item', { hasText: PLATFORM_AGENT }).click()
  await expect(page.getByText('平台公共 · 只读')).toBeVisible()
  await expect(page.getByRole('button', { name: '保存' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '删除' })).toHaveCount(0)
  // 表单整体不可交互（inert 由 :inert="isPlatformSelected" 绑定）
  await expect(page.locator('.agents__form')).toHaveAttribute('inert', /.*/)

  // 切回私有智能体：写入口必须回来（防止「只读」被做成「人人只读」）
  await page.locator('.agents__item', { hasText: PRIVATE_AGENT }).click()
  await expect(page.getByText('平台公共 · 只读')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '保存' })).toBeVisible()
  await expect(page.getByRole('button', { name: '删除' })).toBeVisible()
})

test('工作台点平台智能体 → 进对话 → 发送消息 → 收到流式回复', async ({ page }) => {
  await login(page)
  await gotoApp(page, '/')

  await page.locator('.agent-card', { hasText: PLATFORM_AGENT }).click()
  await expect(page).toHaveURL(/\/chat\//)

  // 用真实按键输入（fill() 不触发本仓 Textarea 的 v-model 同步，发送按钮会一直是 disabled）
  const composer = page.getByLabel('消息输入')
  await composer.click()
  await composer.pressSequentially('帮我整理开题报告', { delay: 10 })
  const send = page.getByRole('button', { name: '发送' })
  await expect(send).toBeEnabled()
  await composer.press('Enter')

  // 假后端已把流式回复落库（见 mock-api.mjs），所以直接断言内容即可，重拉也不会丢。
  // ⚠️ 用 .last()：假后端的新会话 id 固定，重复跑时历史会累积，一次可能匹配到多条助手气泡
  //    （严格模式会直接报错，--repeat-each 复跑时踩过）。
  const reply = page.locator('.msg--assistant').last()
  await expect(reply).toContainText('已收到你的问题', { timeout: 15_000 })
  await expect(reply).toContainText('E2E 假回复：流式结束', { timeout: 15_000 })
  // 用户自己发的那条也要在
  await expect(page.locator('.msg--user').last()).toContainText('帮我整理开题报告')
})

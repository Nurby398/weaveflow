/**
 * Playwright E2E 配置
 * ------------------------------------------------------------------
 * 为什么能自包含（CI 里也能跑）：
 *   仓里已有假后端 `scripts/mock-api.mjs`（覆盖 auth/agents/teams/knowledge/conversations/pipeline/SSE），
 *   前端 dev server 的 `/api` 代理指向它即可 —— 不需要真后端、不需要 PostgreSQL。
 *
 * 端口约定（避开日常开发用的 5175 / 3000，防止和本地手动起的服务打架）：
 *   mock-api : 3010    vite dev : 5275
 */
import { defineConfig, devices } from '@playwright/test'

const MOCK_PORT = 3010
const APP_PORT = 5275
const ci = Boolean(process.env.CI)

/**
 * ⚠️ 两个 webServer 都显式绑 127.0.0.1：
 * Linux runner 上 `localhost` 可能解析到 ::1，而 baseURL 用的是 127.0.0.1 →
 * 浏览器 ERR_CONNECTION_REFUSED、三个用例全红，本地（Windows 排在 IPv4）却看不出来。
 */

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  /**
   * CI 首次跑要冷启动 vite（按需编译）+ 浏览器冷启动，7s 的默认断言超时会偶发不够用；
   * 实测过同一套用例一次红一次绿（2026-10-15），所以显式放宽并给 CI 两次重试：
   * 抖动不能被当成"绿的"，但重试耗尽仍红才算真失败。
   */
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: ci ? 2 : 0,
  forbidOnly: ci,
  reporter: ci ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${APP_PORT}`,
    // 页面里有 6MB 背景视频与外网字体：导航/动作超时显式化，别让默认值把 CI 拖红
    navigationTimeout: 20_000,
    actionTimeout: 10_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node scripts/mock-api.mjs',
      port: MOCK_PORT,
      timeout: 30_000,
      reuseExistingServer: !ci,
      env: { MOCK_PORT: String(MOCK_PORT) },
    },
    {
      // 冷启动（首次按需编译）在 CI 上可能明显慢于本地，给足 120s
      command: `npx vite --host 127.0.0.1 --port ${APP_PORT} --strictPort`,
      port: APP_PORT,
      timeout: 120_000,
      reuseExistingServer: !ci,
      env: { VITE_DEV_PROXY_TARGET: `http://127.0.0.1:${MOCK_PORT}` },
    },
  ],
})

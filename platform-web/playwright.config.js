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

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 1,
  retries: ci ? 1 : 0,
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
      reuseExistingServer: !ci,
      env: { MOCK_PORT: String(MOCK_PORT) },
    },
    {
      command: `npx vite --port ${APP_PORT} --strictPort`,
      port: APP_PORT,
      reuseExistingServer: !ci,
      env: { VITE_DEV_PROXY_TARGET: `http://127.0.0.1:${MOCK_PORT}` },
    },
  ],
})

/**
 * E2E 公共工具。
 * 假后端（scripts/mock-api.mjs）对任意账号都返回同一个 token，所以这里的账号只是形式。
 */
export const E2E_EMAIL = 'e2e@example.com'
export const E2E_PASSWORD = 'e2e-pass-2026'

/** 外网字体一律拦掉：CI runner 上 fonts.googleapis.com 慢/被限时，等 'load' 会把测试拖超时 */
export async function blockExternal(page) {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort())
}

/** 走真实登录表单（不注入 token，避免绕过我们要验证的前端链路） */
export async function login(page) {
  await blockExternal(page)
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.getByLabel('邮箱').fill(E2E_EMAIL)
  await page.getByLabel('密码').fill(E2E_PASSWORD)
  await page.getByRole('button', { name: '登录' }).click()
  // 登录成功后默认落 /chat（见 Login.vue 的 resolveAfterAuth）
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

/** 站内导航统一等 DOM 就绪，不等 6MB 背景视频等重资源 */
export async function gotoApp(page, path) {
  await page.goto(path, { waitUntil: 'domcontentloaded' })
}

/**
 * 视觉回归的准备动作：视口 + 主题（登录前写入 localStorage，避免闪一次再切）+ 登录。
 * 主题键与取值见 src/composables/useTheme.js（'platform_theme'，'light' | 'dark'）。
 */
export async function prepareVisual(page, { theme = 'light', width = 1280, height = 800 } = {}) {
  await page.setViewportSize({ width, height })
  await page.addInitScript((value) => {
    try {
      localStorage.setItem('platform_theme', value)
    } catch {
      // 隐私模式等场景写不了 localStorage：主题只影响这一次会话，不影响断言
    }
  }, theme)
  await login(page)
}

/**
 * 截图统一选项：
 *   · 动画关闭（含 CSS transition / 光标闪烁），否则每帧都可能不同；
 *   · 背景视频 mask 掉：它是 6MB 视频，解码进度不同像素就不同；
 *   · 给 0.5% 的像素容差，吸收字体抗锯齿的平台差异。
 */
export function shotOptions(page) {
  return {
    animations: 'disabled',
    caret: 'hide',
    mask: [page.locator('video')],
    maxDiffPixelRatio: 0.005,
  }
}

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
 * 视觉回归的准备动作（公开页）：视口 + 主题 + 隐藏背景视频，**不登录**。
 * 主题键与取值见 src/composables/useTheme.js（'platform_theme'，'light' | 'dark'）。
 */
export async function preparePublic(page, { theme = 'light', width = 1280, height = 800 } = {}) {
  await page.setViewportSize({ width, height })
  await page.addInitScript((value) => {
    try {
      localStorage.setItem('platform_theme', value)
    } catch {
      // 隐私模式等场景写不了 localStorage：主题只影响这一次会话，不影响断言
    }
    /**
     * ★ 背景视频是**全屏 fixed** 元素，绝不能靠 mask 它来求稳定：
     *   mask 会按它的 bounding box 铺满整个视口 —— 实测基准图整张变成 Playwright 的
     *   mask 色 #FF00FF，门禁彻底失效（截图全同 → 任何视觉回归都发现不了）。
     *   正确做法：把它当装饰性元素直接隐藏，这样截图才真实可比。
     */
    const hideVideo = () => {
      const style = document.createElement('style')
      // 粒子内核是持续动画（散开/聚合/脉冲），截图会不确定 → 与背景视频同理，截图时隐藏
      style.textContent = 'video { display: none !important; } .particle-orb { display: none !important; }'
      document.head?.appendChild(style)
    }
    if (document.head) hideVideo()
    else document.addEventListener('DOMContentLoaded', hideVideo)
  }, theme)
  await blockExternal(page)
}

/** 视觉回归的准备动作（登录后页面）：在 preparePublic 基础上再登录 */
export async function prepareVisual(page, options = {}) {
  await preparePublic(page, options)
  await login(page)
}

/**
 * 截图统一选项：
 *   · 动画关闭（含 CSS transition / 光标闪烁），否则每帧都可能不同；
 *   · 只 mask **局部**动态内容（消息时间戳）；背景视频已在 preparePublic 里 display:none 隐藏
 *     —— 它是全屏固定元素，用 mask 会连整张图一起遮掉（实测教训见 preparePublic 注释）；
 *   · 容差 0.05%（1280×800 ≈ 512px）：字形/颜色/间距的改动会被抓住。
 *
 * 自检：`bash scripts/verify-gate-sensitivity.sh` 会造两处回归（隐藏侧栏 / 删字体），
 * 要求视觉基准与字体断言分别报警 —— 门禁必须"会失败"才算数。
 */
export function shotOptions(page) {
  return {
    animations: 'disabled',
    caret: 'hide',
    mask: [page.locator('.msg__meta')],
    maxDiffPixelRatio: 0.0005,
  }
}

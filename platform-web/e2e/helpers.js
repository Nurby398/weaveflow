/**
 * E2E 公共工具。
 * 假后端（scripts/mock-api.mjs）对任意账号都返回同一个 token，所以这里的账号只是形式。
 */
export const E2E_EMAIL = 'e2e@example.com'
export const E2E_PASSWORD = 'e2e-pass-2026'

/** 走真实登录表单（不注入 localStorage，避免绕过我们要验证的前端链路） */
export async function login(page) {
  await page.goto('/login')
  await page.getByLabel('邮箱').fill(E2E_EMAIL)
  await page.getByLabel('密码').fill(E2E_PASSWORD)
  await page.getByRole('button', { name: '登录' }).click()
  // 登录成功后默认落 /chat（见 Login.vue 的 resolveAfterAuth）
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

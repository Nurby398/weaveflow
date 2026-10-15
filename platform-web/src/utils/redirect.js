/**
 * 站内跳转地址校验（防开放重定向）
 * ------------------------------------------------------------------
 * 用途：`/login?redirect=<目标>` 与 401 跳转都会把这个参数交给 router.push。
 * 若不校验，攻击者可构造 `/login?redirect=//evil.com`，用户登录成功后
 * 就被送到外站（钓鱼跳板）。这里只放行"本站绝对路径"。
 *
 * 规则：
 *   - 必须是字符串且以单个 '/' 开头（'/' 本身合法）
 *   - 拒绝 '//host' 与 '/\host'：浏览器会把它们当协议相对 URL 跳到外站
 *   - 拒绝含反斜杠的其它变体
 *   - 其余情况一律回退到 fallback（默认首页）
 */
export function safeRedirect(raw, fallback = '/') {
  if (typeof raw !== 'string') return fallback

  const value = raw.trim()
  if (!value.startsWith('/')) return fallback
  if (value.startsWith('//')) return fallback
  if (value.includes('\\')) return fallback

  return value
}

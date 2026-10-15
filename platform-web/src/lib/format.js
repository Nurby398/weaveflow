/**
 * 展示层格式化工具
 * 所有以「数值 / 时间戳 / ID」为主的输出都配合 var(--ui-font-mono) 使用。
 */

function toDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const pad = (n) => String(n).padStart(2, '0')

/** 2026-10-13 21:04:07（本地时区，等宽友好） */
export function formatDateTime(value) {
  const date = toDate(value)
  if (!date) return '—'
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  )
}

/** 相对时间：刚刚 / 5 分钟前 / 3 小时前 / 2 天前 */
export function relativeTime(value) {
  const date = toDate(value)
  if (!date) return '—'
  const diff = Date.now() - date.getTime()
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  if (diff < 30 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`
  return formatDateTime(date)
}

/** UUID → 前 8 位，便于在列表里做等宽短标识 */
export function shortId(id) {
  const text = String(id ?? '')
  return text ? text.slice(0, 8) : '—'
}

export function formatBytes(bytes) {
  const size = Number(bytes)
  if (!Number.isFinite(size) || size <= 0) return '0 B'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(2)} MB`
}

/** 千分位数字（token 用量） */
export function formatNumber(value) {
  const num = Number(value ?? 0)
  if (!Number.isFinite(num)) return '0'
  return num.toLocaleString('en-US')
}

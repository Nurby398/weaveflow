/**
 * 会话侧栏分组（设计评审 P0-3）
 * ------------------------------------------------------------------
 * 纯函数，可单测：按「今天 / 近 7 天 / 更早」分桶 + 标题关键词过滤（本地），
 * 组内按时间倒序，组间固定顺序（今天 → 近 7 天 → 更早），空组自动去掉。
 * 日期缺失 / 非法一律归「更早」兜底，不猜时间。
 */

const BUCKET_ORDER = ['today', 'week', 'earlier']
const BUCKET_LABELS = { today: '今天', week: '近 7 天', earlier: '更早' }
const DAY_MS = 24 * 60 * 60 * 1000

function timeOf(value) {
  const time = value ? new Date(value).getTime() : 0
  return Number.isNaN(time) ? 0 : time
}

function bucketKey(value) {
  const time = timeOf(value)
  if (!time) return 'earlier'
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  if (time >= startOfToday) return 'today'
  if (time >= startOfToday - 6 * DAY_MS) return 'week'
  return 'earlier'
}

/**
 * @param {{ id: string, title?: string, createdAt?: string }[]} items 会话列表
 * @param {string} query 标题关键词（可空）
 * @returns {{ key: string, label: string, items: object[] }[]}
 */
export function groupConversations(items, query = '') {
  const kw = String(query ?? '')
    .trim()
    .toLowerCase()
  const buckets = new Map()
  for (const item of items) {
    if (
      kw &&
      !String(item.title ?? '')
        .toLowerCase()
        .includes(kw)
    )
      continue
    const key = bucketKey(item.createdAt)
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(item)
  }
  return BUCKET_ORDER.filter((key) => buckets.has(key)).map((key) => ({
    key,
    label: BUCKET_LABELS[key],
    items: [...buckets.get(key)].sort((a, b) => timeOf(b.createdAt) - timeOf(a.createdAt)),
  }))
}

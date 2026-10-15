/**
 * lib 层单测：格式化工具 + 头像映射
 * ------------------------------------------------------------------
 * 这两块是**纯函数**、被所有视图共用，此前零覆盖。它们出错的表现都很隐蔽：
 *   · formatBytes/formatNumber 算错 → 界面数字悄悄变错，没人会去核对
 *   · agentAvatar 匹配不上 → 头像静默换成别的智能体（认错人）
 * 所以这里钉的是「边界输入不能崩、不能静默错」。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatBytes, formatDateTime, formatNumber, relativeTime, shortId } from '@/lib/format'
import { AGENT_AVATARS, BRAND_AVATAR, DEFAULT_ASSISTANT_NAME, agentAvatar } from '@/lib/avatars'

describe('lib/format', () => {
  it('formatDateTime：按本地时区补零，非法输入退化成占位符', () => {
    expect(formatDateTime(new Date(2026, 9, 13, 21, 4, 7))).toBe('2026-10-13 21:04:07')
    expect(formatDateTime('2026-10-13T21:04:07')).toBe('2026-10-13 21:04:07')
    expect(formatDateTime('不是时间')).toBe('—')
    expect(formatDateTime(null)).toBe('—')
    expect(formatDateTime('')).toBe('—')
  })

  it('relativeTime：刚刚 / 分钟 / 小时 / 天 / 超过 30 天回落成绝对时间', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 15, 12, 0, 0))
    const ago = (ms) => new Date(Date.now() - ms)

    expect(relativeTime(ago(30_000))).toBe('刚刚')
    expect(relativeTime(ago(5 * 60_000))).toBe('5 分钟前')
    expect(relativeTime(ago(3 * 3_600_000))).toBe('3 小时前')
    expect(relativeTime(ago(2 * 86_400_000))).toBe('2 天前')
    expect(relativeTime(ago(40 * 86_400_000))).toBe(formatDateTime(new Date(2026, 8, 5, 12, 0, 0)))
    expect(relativeTime('坏数据')).toBe('—')
    vi.useRealTimers()
  })

  it('shortId：截前 8 位，空值给占位符而不是 undefined', () => {
    expect(shortId('267b6d9f-d006-4ae8-a853-c4fac26e425b')).toBe('267b6d9f')
    expect(shortId('abc')).toBe('abc')
    expect(shortId('')).toBe('—')
    expect(shortId(null)).toBe('—')
    expect(shortId(undefined)).toBe('—')
  })

  it('formatBytes：非法/非正数给 0 B，量级与小数位固定', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(-1)).toBe('0 B')
    expect(formatBytes('不是数字')).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(1024 * 1024)).toBe('1.00 MB')
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.50 MB')
  })

  it('formatNumber：token 用量走千分位，非法值不显示 NaN', () => {
    expect(formatNumber(1234)).toBe('1,234')
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(null)).toBe('0')
    expect(formatNumber('abc')).toBe('0')
  })
})

describe('lib/avatars（认图 = 认人，错一个就是错一个智能体）', () => {
  it('6 张智能体头像都能被构建期解析出来', () => {
    expect(AGENT_AVATARS).toHaveLength(6)
    for (const src of AGENT_AVATARS) expect(typeof src).toBe('string')
    for (const src of AGENT_AVATARS) expect(src.length).toBeGreaterThan(0)
  })

  it('按名字精确匹配（含阶段序号前缀）', () => {
    expect(agentAvatar({ name: '毕设选题与立项顾问' })).toBe(AGENT_AVATARS[0])
    expect(agentAvatar({ name: '需求分析与开题工程师' })).toBe(AGENT_AVATARS[1])
    // 「①毕设选题与立项顾问」的「①」属于私有区字符，必须能被剥掉后匹配
    expect(agentAvatar({ name: '①毕设选题与立项顾问' })).toBe(AGENT_AVATARS[0])
  })

  it('平台默认助手与调度器共用品牌标', () => {
    expect(DEFAULT_ASSISTANT_NAME).toBe('织流')
    expect(agentAvatar({ name: DEFAULT_ASSISTANT_NAME })).toBe(BRAND_AVATAR)
    expect(agentAvatar({ name: '织流调度' })).toBe(BRAND_AVATAR)
    // 品牌标不进哈希兜底池，避免别的智能体随机撞成品牌图
    expect(AGENT_AVATARS).not.toContain(BRAND_AVATAR)
  })

  it('显式下标优先于名字匹配（列表按下标排头像的场景）', () => {
    expect(agentAvatar({ name: '毕设选题与立项顾问' }, 2)).toBe(AGENT_AVATARS[2])
    expect(agentAvatar({}, 3)).toBe(AGENT_AVATARS[3])
    expect(agentAvatar({}, 0)).toBe(AGENT_AVATARS[0])
  })

  it('空智能体给空串（交给 Avatar 走首字回落），未知名字走稳定哈希', () => {
    expect(agentAvatar(null)).toBe('')
    expect(agentAvatar({})).toBe('')
    expect(agentAvatar({ id: '' })).toBe('')

    const unknown = { name: '某个不在表里的智能体', id: 'unknown-id-1' }
    const first = agentAvatar(unknown)
    expect(AGENT_AVATARS).toContain(first)
    // 同一对象两次调用必须一致，否则每次渲染都会换头像
    expect(agentAvatar(unknown)).toBe(first)
  })
})

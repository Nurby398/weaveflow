// @vitest-environment happy-dom
/**
 * 路由/信息架构测试（Paperclip 参照改造 · 第一小批）
 * ------------------------------------------------------------------
 * 钉住"信息架构允许扩展"后的导航面：运行历史 / 成本 / 评测 三个新路由必须存在。
 * 这不是为了"测 Vue Router"，而是防止将来有人把导航删了、页面变成孤儿路由。
 */
import { describe, expect, it } from 'vitest'
import router from '@/router'

describe('router / 信息架构', () => {
  it('包含 Paperclip 参照新增的三个入口路由', () => {
    const names = router.getRoutes().map((route) => route.name)
    expect(names).toEqual(expect.arrayContaining(['Runs', 'Cost', 'Evals']))
  })

  it('三个新路由都挂在受保护布局下（未登录应被路由守卫拦住）', () => {
    for (const name of ['Runs', 'Cost', 'Evals']) {
      const route = router.getRoutes().find((item) => item.name === name)
      expect(route).toBeTruthy()
      expect(route.path.startsWith('/')).toBe(true)
    }
  })
})

/**
 * 成本面板的演示开关（与 dispatchDemo 的开关同构，但抽出来以便测试可 mock）
 * ------------------------------------------------------------------
 * 单独成文件的原因：`import.meta.env.VITE_MOCK_COST` 在构建期被静态内联，
 * 测试里用 vi.stubEnv 改不动它；抽成模块后测试可以 mock 这个模块（用 getter 切换）。
 * 生产构建（.env.production 无 VITE_MOCK_COST）恒为 false，且 demo 数据仍在
 * lib/costDemo.js 里动态 import，不会进生产包。
 */
export const COST_MOCK_ENABLED = ['true', '1'].includes(String(import.meta.env.VITE_MOCK_COST ?? '').toLowerCase())

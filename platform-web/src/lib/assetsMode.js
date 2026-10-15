/**
 * 资产库的演示开关（与 tasksMode/costMode 同构：抽成模块以便测试 mock）
 * ------------------------------------------------------------------
 * 生产构建恒为 false；demo 数据在 lib/assetsDemo.js 里动态 import，不进生产包。
 */
export const ASSETS_MOCK_ENABLED = ['true', '1'].includes(String(import.meta.env.VITE_MOCK_ASSETS ?? '').toLowerCase())

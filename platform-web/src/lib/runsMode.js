/**
 * 运行历史的演示开关（与 costMode.js 同构：抽成模块以便测试 mock）
 * ------------------------------------------------------------------
 * 生产构建（.env.production 无 VITE_MOCK_RUNS）恒为 false；demo 数据在
 * lib/runsDemo.js 里动态 import，不会进生产包。
 */
export const RUNS_MOCK_ENABLED = ['true', '1'].includes(String(import.meta.env.VITE_MOCK_RUNS ?? '').toLowerCase())

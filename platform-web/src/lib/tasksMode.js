/**
 * 任务中心的演示开关（与 costMode/runsMode 同构：抽成模块以便测试 mock）
 * ------------------------------------------------------------------
 * 生产构建恒为 false；demo 数据在 lib/tasksDemo.js 里动态 import，不进生产包。
 */
export const TASKS_MOCK_ENABLED = ['true', '1'].includes(String(import.meta.env.VITE_MOCK_TASKS ?? '').toLowerCase())

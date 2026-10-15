/**
 * 成本面板的受控演示数据（Paperclip 参照 · §D1 支出追踪）
 * ------------------------------------------------------------------
 * 与 dispatchDemo.js 同模式：
 *   · 仅当 `VITE_MOCK_COST` 打开时才被 **动态 import**，生产构建不引入这些假数据；
 *   · 关闭时 Cost.vue 走真实接口 `GET /api/usage/summary`（FE-B19，未就绪则显示占位）。
 *
 * 数据形状与 FE-B19 契约一致（见 docs/前端驱动-后端待实现清单-v1.md）：
 *   summary = { currency, totalCost, totalTokensIn, totalTokensOut, budget, budgetUsedRatio, byTeam[] }
 */
export const COST_MOCK_ENABLED = ['true', '1'].includes(String(import.meta.env.VITE_MOCK_COST ?? '').toLowerCase())

export const DEMO_COST_SUMMARY = {
  currency: 'CNY',
  totalCost: 42.35,
  totalTokensIn: 1_284_000,
  totalTokensOut: 386_500,
  budget: 100,
  budgetUsedRatio: 0.42,
  byTeam: [
    {
      teamId: 'team-1',
      teamName: '毕业设计流水线（我的）',
      isPlatform: false,
      cost: 18.2,
      tokensIn: 552_000,
      tokensOut: 168_000,
      runs: 3,
    },
    {
      teamId: 'team-2',
      teamName: '毕业设计流水线(真实)',
      isPlatform: true,
      cost: 24.15,
      tokensIn: 732_000,
      tokensOut: 218_500,
      runs: 5,
    },
  ],
}

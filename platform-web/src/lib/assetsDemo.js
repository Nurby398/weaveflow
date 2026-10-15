/**
 * 资产库的受控演示数据（EvoFlow 参照 · §E5 资产中心）
 * ------------------------------------------------------------------
 * 形状与 FE-B31 契约一致（见 docs/前端驱动-后端待实现清单-v1.md）：
 *   asset = { id, teamId, teamName, stageNo, title, content, createdAt }
 * 资产由「阶段产出自动沉淀」而来（后端落库），前端只负责检索与展示。
 */
export const DEMO_ASSETS = [
  {
    id: 'asset-1',
    teamId: 'team-1',
    teamName: '毕业设计流水线（我的）',
    stageNo: 1,
    title: '选题评估结论：校园二手交易平台',
    content: '选题具备明确用户与痛点、范围可控，建议聚焦"校内 C2C + 信誉体系"作为差异化点。',
    createdAt: '2026-10-15T08:30:00.000Z',
  },
  {
    id: 'asset-2',
    teamId: 'team-1',
    teamName: '毕业设计流水线（我的）',
    stageNo: 2,
    title: '开题报告技术路线',
    content: '技术路线定为：SpringBoot 后端 + Vue3 前端 + MySQL；验证方式为 5 个智能体分阶段产出契约校验。',
    createdAt: '2026-10-15T09:40:00.000Z',
  },
  {
    id: 'asset-3',
    teamId: 'team-1',
    teamName: '毕业设计流水线（我的）',
    stageNo: 3,
    title: '数据库表设计要点',
    content: '用户表 / 商品表 / 订单表三张核心表，注意软删除字段与索引设计。',
    createdAt: '2026-10-15T10:20:00.000Z',
  },
]

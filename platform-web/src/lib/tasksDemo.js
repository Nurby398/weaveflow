/**
 * 任务中心的受控演示数据（EvoFlow 参照 · §E8 任务中心）
 * ------------------------------------------------------------------
 * 形状与 FE-B30 契约一致（见 docs/前端驱动-后端待实现清单-v1.md）：
 *   task = { id, title, teamId, teamName, status, progress, currentStage, startedAt, updatedAt }
 * status ∈ running | paused | failed | completed
 */
export const DEMO_TASKS = [
  {
    id: 'task-1',
    title: '校园二手交易平台 · 毕设流水线',
    teamId: 'team-1',
    teamName: '毕业设计流水线（我的）',
    status: 'running',
    progress: 40,
    currentStage: 2,
    startedAt: '2026-10-15T09:00:00.000Z',
    updatedAt: '2026-10-15T10:10:00.000Z',
  },
  {
    id: 'task-2',
    title: '毕业论文格式检查（平台流水线）',
    teamId: 'team-2',
    teamName: '毕业设计流水线(真实)',
    status: 'paused',
    progress: 60,
    currentStage: 3,
    startedAt: '2026-10-14T14:00:00.000Z',
    updatedAt: '2026-10-14T15:20:00.000Z',
  },
  {
    id: 'task-3',
    title: '开题报告补全 · 失败样例',
    teamId: 'team-1',
    teamName: '毕业设计流水线（我的）',
    status: 'failed',
    progress: 75,
    currentStage: 4,
    startedAt: '2026-10-13T08:00:00.000Z',
    updatedAt: '2026-10-13T08:42:00.000Z',
  },
  {
    id: 'task-4',
    title: '数据库设计跑批 · 已完成',
    teamId: 'team-1',
    teamName: '毕业设计流水线（我的）',
    status: 'completed',
    progress: 100,
    currentStage: 5,
    startedAt: '2026-10-12T10:00:00.000Z',
    updatedAt: '2026-10-12T12:30:00.000Z',
  },
]

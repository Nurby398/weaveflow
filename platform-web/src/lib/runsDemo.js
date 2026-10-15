/**
 * 运行历史的受控演示数据（Paperclip 参照 · 支柱 D「运行历史 & 追踪」）
 * ------------------------------------------------------------------
 * 形状与 FE-B11 契约一致（见 docs/前端驱动-后端待实现清单-v1.md）：
 *   runs[] = { runId, teamId, teamName, isPlatform, status, currentStage, stageCount,
 *              startedAt, updatedAt, failure }
 * status ∈ running | completed | failed（与 pipelineRuns.status 对齐）。
 */
export const DEMO_RUNS = [
  {
    runId: 'run-1001',
    teamId: 'team-1',
    teamName: '毕业设计流水线（我的）',
    isPlatform: false,
    status: 'running',
    currentStage: 1,
    stageCount: 5,
    startedAt: '2026-10-15T09:20:00.000Z',
    updatedAt: '2026-10-15T10:05:00.000Z',
    failure: null,
  },
  {
    runId: 'run-1002',
    teamId: 'team-2',
    teamName: '毕业设计流水线(真实)',
    isPlatform: true,
    status: 'failed',
    currentStage: 3,
    stageCount: 5,
    startedAt: '2026-10-14T14:00:00.000Z',
    updatedAt: '2026-10-14T14:32:00.000Z',
    failure: '阶段 4 契约校验未通过：缺失字段 topic_name',
  },
  {
    runId: 'run-1003',
    teamId: 'team-1',
    teamName: '毕业设计流水线（我的）',
    isPlatform: false,
    status: 'completed',
    currentStage: 5,
    stageCount: 5,
    startedAt: '2026-10-13T08:00:00.000Z',
    updatedAt: '2026-10-13T11:10:00.000Z',
    failure: null,
  },
]

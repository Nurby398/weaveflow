/**
 * 评测的受控演示数据（Paperclip 参照 · 支柱 C「Agent Employee Training / Evals」）
 * ------------------------------------------------------------------
 * 形状与 FE-B20 契约一致（见 docs/前端驱动-后端待实现清单-v1.md）：
 *   cases[] = { caseId, name, input, expectedKeyPoints[] }
 *   runs[]  = { runId, caseId, caseName, agentName, score, durationMs, tokensIn, tokensOut, createdAt }
 * score ∈ 0..100。
 */
export const DEMO_EVAL_CASES = [
  {
    caseId: 'case-1',
    name: '选题可行性判断',
    input: '我想做一个校园二手交易平台，帮我评估这个选题。',
    expectedKeyPoints: ['有明确用户与痛点', '范围可控', '有数据可验证'],
  },
  {
    caseId: 'case-2',
    name: '开题报告结构',
    input: '帮我给"校园二手交易平台"写开题报告提纲。',
    expectedKeyPoints: ['研究问题', '技术路线', '验证方式'],
  },
  {
    caseId: 'case-3',
    name: '数据库表设计',
    input: '设计用户与订单两张表。',
    expectedKeyPoints: ['主键与关系', '字段类型', '索引考虑'],
  },
]

export const DEMO_EVAL_RUNS = [
  {
    runId: 'eval-run-1',
    caseId: 'case-1',
    caseName: '选题可行性判断',
    agentName: '①毕设选题与立项顾问',
    score: 88,
    durationMs: 3420,
    tokensIn: 1800,
    tokensOut: 620,
    createdAt: '2026-10-15T09:00:00.000Z',
  },
  {
    runId: 'eval-run-2',
    caseId: 'case-2',
    caseName: '开题报告结构',
    agentName: '②需求分析与开题工程师',
    score: 74,
    durationMs: 5230,
    tokensIn: 2450,
    tokensOut: 980,
    createdAt: '2026-10-15T09:12:00.000Z',
  },
  {
    runId: 'eval-run-3',
    caseId: 'case-3',
    caseName: '数据库表设计',
    agentName: '③架构与数据库设计工程师',
    score: 52,
    durationMs: 6110,
    tokensIn: 3020,
    tokensOut: 1210,
    createdAt: '2026-10-15T09:26:00.000Z',
  },
]

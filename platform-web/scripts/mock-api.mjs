/**
 * 本地视觉验收用的假数据服务（不是真实后端，不参与构建与测试）
 * ==================================================================
 * ⚠️ 本文件不是真实后端，仅供「无后端时的视觉预演」。
 *    它返回的每一条数据都是静态样例，**不代表任何真实账号的状态**。
 *    真实验收请连 platform-server（真 PostgreSQL 或 DEV_MEMORY_DB=1）后再截图；
 *    用本文件跑出来的截图必须在 screenshots/README.md 里标注为「预演（mock）」。
 * ==================================================================
 * 用途：platform-server 需要 PostgreSQL 与 .env 才能启动，
 * 因此无后端时用本文件提供与真实接口「同形」的响应，让页面渲染样例数据。
 * 启动：node scripts/mock-api.mjs          （默认 3010）
 * 配合：VITE_PREVIEW_PROXY_TARGET=http://localhost:3010 npm run preview
 *
 * 样例智能体只保留平台设计里真实存在的角色；任何「凭空造出来的智能体」都不允许放进来
 * （历史上曾因此被误读为用户的真实数据）。
 *
 * P9 起同步 P4 流水线契约：GET /api/pipeline/:runId 回 { run, stages }（stages 与 run 平级），
 * stage 形如 { stageNo(0 基), agentId, agentName, conversationId, status, artifact }，
 * status ∈ pending | waiting | validated | failed。
 *
 * P7b 起同步外部智能体接入契约：
 *   POST   /api/agents/:id/external/test   连通性测试
 *   DELETE /api/agents/:id/external        解绑
 *   agent 上的 sourceType / externalBaseUrl / externalAgentId / externalTokenHint
 *   令牌「明文进、掩码出」——假服务同样只回掩码，绝不在响应里回显明文。
 * ------------------------------------------------------------------
 */
import { createServer } from 'node:http'

const PORT = Number(process.env.MOCK_PORT || 3010)

const uuid = (n) => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`
const ago = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString()

const user = {
  id: uuid(1),
  email: 'demo@platform.dev',
  nickname: '演示账号',
  role: 'user',
  createdAt: ago(60 * 24 * 30),
}

const teams = [
  {
    id: uuid(2),
    name: '毕业设计流水线',
    description: '从选题到答辩的多阶段协作团队',
    createdAt: ago(60 * 24 * 12),
    agents: [],
  },
]

const agents = [
  {
    id: uuid(11),
    teamId: uuid(2),
    name: '需求分析与开题工程师',
    icon: '✎',
    stageNo: 1,
    isPlatform: true,
    systemPrompt: '负责把模糊想法整理成可执行的开题报告：明确研究问题、目标、范围与风险，输出结构化提纲。',
    providerCredId: uuid(21),
    model: 'deepseek-chat',
    knowledgeDocIds: [uuid(31), uuid(32)],
    outputSchema: null,
    sort: 10,
    createdAt: ago(60 * 24 * 12),
  },
  {
    id: uuid(12),
    teamId: uuid(2),
    name: '架构与数据库设计工程师',
    icon: '▤',
    stageNo: 2,
    isPlatform: true,
    systemPrompt: '根据开题报告产出系统架构图、模块划分与数据库表结构，标注关键取舍。',
    providerCredId: uuid(21),
    model: 'deepseek-reasoner',
    knowledgeDocIds: [uuid(32)],
    outputSchema: null,
    sort: 20,
    createdAt: ago(60 * 24 * 11),
  },
  {
    id: uuid(13),
    teamId: uuid(2),
    name: '代码开发与测试工程师',
    icon: '{ }',
    stageNo: 3,
    systemPrompt: '实现核心模块并补齐单元测试，给出可复现的运行命令。',
    providerCredId: uuid(22),
    model: 'qwen3-coder',
    knowledgeDocIds: [],
    outputSchema: null,
    sort: 30,
    createdAt: ago(60 * 24 * 6),
  },
  {
    id: uuid(14),
    teamId: uuid(2),
    name: '论文写作与规范检查',
    icon: '¶',
    stageNo: 4,
    systemPrompt: '按学校模板排版论文，检查引用、图表编号与格式一致性。',
    providerCredId: uuid(21),
    model: 'deepseek-chat',
    knowledgeDocIds: [uuid(31)],
    outputSchema: null,
    sort: 40,
    createdAt: ago(60 * 5),
  },
]

/** 外部接入字段的默认形状：自带模型 Key 的智能体也要带这几个键，前端不必写兜底分支 */
const externalDefaults = {
  sourceType: 'self_hosted',
  externalBaseUrl: null,
  externalAgentId: null,
  externalTokenHint: null,
}

for (const agent of agents) {
  Object.assign(agent, { ...externalDefaults, ...agent })
}

for (const team of teams) {
  team.agents = agents.filter((agent) => agent.teamId === team.id).sort((a, b) => a.sort - b.sort)
}

const providers = [
  {
    id: uuid(21),
    label: 'DeepSeek 官方',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKeyHint: 'sk-4f19••••••••7c2e',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    createdAt: ago(60 * 24 * 20),
  },
  {
    id: uuid(22),
    label: '通义千问（自建网关）',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKeyHint: 'sk-9ab3••••••••01fd',
    models: ['qwen3-coder', 'qwen-max'],
    createdAt: ago(60 * 24 * 5),
  },
]

const knowledge = [
  { id: uuid(31), name: '毕业论文格式规范（2026 修订）.txt', bytes: 184_320, createdAt: ago(60 * 24 * 14) },
  { id: uuid(32), name: '平台接口文档 v1.txt', bytes: 96_512, createdAt: ago(60 * 24 * 9) },
  { id: uuid(33), name: '选题库示例清单.txt', bytes: 24_880, createdAt: ago(60 * 24 * 2) },
]

const conversations = [
  {
    id: uuid(41),
    teamId: uuid(2),
    agentDefId: uuid(11),
    stageNo: 1,
    parentConversationId: null,
    title: '开题报告提纲',
    createdAt: ago(180),
  },
  {
    id: uuid(42),
    teamId: uuid(2),
    agentDefId: uuid(13),
    stageNo: 3,
    parentConversationId: null,
    title: 'SSE 流式接口联调',
    createdAt: ago(45),
  },
]

const assistantMarkdown = [
  '已按你的要求把开题报告整理成三部分，**研究问题**、**技术路线**、**验证方式**。',
  '',
  '### 关键结论',
  '',
  '- 研究问题可收敛为一句可检验的命题',
  '- 技术路线选 `SSE + 原生 fetch`，避免 EventSource 无法带 Authorization 头',
  '',
  '```js',
  '// 中断生成的最小实现',
  'const handle = createSSEStream(`/conversations/${id}/stream`, {',
  '  data: { content, attachmentIds },',
  '  onDelta: (raw) => {',
  '    const chunk = JSON.parse(raw)',
  "    append(chunk.choices?.[0]?.delta?.content ?? '')",
  '  },',
  '})',
  'handle.abort()',
  '```',
  '',
  '| 阶段 | 产出物 | 责任智能体 |',
  '|:--|:--|:--|',
  '| 1 | 开题报告 | 需求分析与开题工程师 |',
  '| 2 | 架构与表结构 | 架构与数据库设计工程师 |',
  '',
  '> 注意：知识注入上限 200000 字符，超出会被截断并在 meta 帧里标记。',
].join('\n')

const messages = {
  [uuid(41)]: [
    {
      id: uuid(51),
      role: 'user',
      content: '帮我把开题报告整理成三部分，重点是技术路线。',
      attachments: [],
      tokensIn: 0,
      tokensOut: 0,
      createdAt: ago(6),
    },
    {
      id: uuid(52),
      role: 'assistant',
      content: assistantMarkdown,
      attachments: [],
      tokensIn: 1_284,
      tokensOut: 986,
      createdAt: ago(5),
    },
  ],
  [uuid(42)]: [
    {
      id: uuid(53),
      role: 'user',
      content: '流式接口现在能中断了吗？',
      attachments: [uuid(61)],
      tokensIn: 0,
      tokensOut: 0,
      createdAt: ago(44),
    },
    {
      id: uuid(54),
      role: 'assistant',
      content: '可以。前端用 `AbortSignal` 复用 `streamSSE`，中断后服务端会把已生成的部分落库。',
      attachments: [],
      tokensIn: 512,
      tokensOut: 320,
      createdAt: ago(43),
    },
  ],
}

/* -------------------------------- 流水线 -------------------------------- */
/**
 * P8 契约（与 platform-server 同形）：
 *   POST /api/pipeline/:teamId/start       → 201 { run, conversationId }
 *   GET  /api/pipeline/:runId              → 200 { run }
 *   POST /api/pipeline/:runId/advance      → 200 流转成功 / 422 CONTRACT_INVALID
 * 两个固定 run id 分别代表「正常态」与「契约未通过态」，供视觉验收使用。
 */
const RUN_OK = uuid(71)
const RUN_INVALID = uuid(72)

const STAGE1_OUTPUT = [
  '## 研究问题',
  '',
  '把「平台缺少流水线界面」收敛为一个可检验的命题：',
  '',
  '- 契约校验结果对操作者**可见**',
  '- 未通过时可重试，且重试预算明确',
  '',
  '## 技术路线',
  '',
  '| 决策 | 取舍 |',
  '|:--|:--|',
  '| 渲染方式 | 复用 `renderMarkdown`，不新增依赖 |',
  '| 状态展示 | 复用 `Badge` + 新增 `Steps` 进度条 |',
].join('\n')

const STAGE2_OUTPUT = [
  '## 架构与表结构',
  '',
  '流水线运行态由 `pipeline_runs` + `pipeline_stages` 两张表承载：',
  '',
  '```sql',
  'create table pipeline_stages (',
  '  run_id uuid not null,',
  '  stage_no int not null,',
  '  status text not null,',
  '  output text,',
  '  contract jsonb,',
  '  primary key (run_id, stage_no)',
  ');',
  '```',
  '',
  '> 契约结果按阶段落库，因此刷新页面后仍能看到上一次的校验结论。',
].join('\n')

const STAGE3_OUTPUT = '## 代码开发与测试\n\n核心模块已实现，单元测试覆盖契约解析的四个清单分支。\n'

/** 阶段契约块：真后端 GET /pipeline/:runId 只回 contractJson + bodyChars，不回正文 */
const STAGE1_CONTRACT = {
  topic_name: '基于多智能体流水线的毕设协作平台',
  scenario: '本科毕业设计',
  summary: '把模糊选题收敛成一句话可检验的命题',
}
const STAGE2_CONTRACT = {
  topic_name: '基于多智能体流水线的毕设协作平台',
  scenario: '本科毕业设计',
  system_modules: ['契约校验', '流水线编排', 'SSE 对话内核'],
}

/** 与真后端 stage_artifacts 同形：{ validated, missingFields, contractJson, bodyChars } */
function makeArtifact(validated, contractJson, bodyChars, missingFields = []) {
  return { validated, missingFields, contractJson, bodyChars }
}

/**
 * 阶段列表：stageNo 0 基，status ∈ pending | waiting | validated | failed。
 * currentArtifact 为 null 时，当前阶段是「已建会话、还没产出」的 waiting。
 */
function makeStages(currentArtifact) {
  return [
    {
      stageNo: 0,
      agentId: uuid(11),
      agentName: '需求分析与开题工程师',
      conversationId: uuid(41),
      status: 'validated',
      artifact: makeArtifact(true, STAGE1_CONTRACT, STAGE1_OUTPUT.length),
    },
    {
      stageNo: 1,
      agentId: uuid(12),
      agentName: '架构与数据库设计工程师',
      conversationId: uuid(42),
      status: currentArtifact === null ? 'waiting' : 'failed',
      artifact: currentArtifact,
    },
    {
      stageNo: 2,
      agentId: uuid(13),
      agentName: '代码开发与测试工程师',
      conversationId: null,
      status: 'pending',
      artifact: null,
    },
    {
      stageNo: 3,
      agentId: uuid(14),
      agentName: '论文写作与规范检查',
      conversationId: null,
      status: 'pending',
      artifact: null,
    },
  ]
}

/** 真后端 GET 回 { run, stages }：stages 与 run 平级，run 里不含 stages */
function runView(run) {
  const view = { ...run }
  delete view.stages
  return view
}

const pipelineRuns = {
  [RUN_OK]: {
    run: { id: RUN_OK, teamId: uuid(2), currentStage: 1, status: 'running', stageCount: 4, createdAt: ago(30) },
    stages: makeStages(null),
  },
  [RUN_INVALID]: {
    run: { id: RUN_INVALID, teamId: uuid(2), currentStage: 1, status: 'running', stageCount: 4, createdAt: ago(12) },
    stages: makeStages(makeArtifact(false, STAGE2_CONTRACT, STAGE2_OUTPUT.length, ['scenario'])),
  },
}

/** 契约未通过：第一次回 retryAllowed:true，第二次起预算耗尽 */
const invalidAttempts = { [RUN_INVALID]: 0 }

function contractInvalidBody(runId) {
  const used = (invalidAttempts[runId] = (invalidAttempts[runId] || 0) + 1)
  const retryAllowed = used <= 1
  return {
    error: {
      code: 'CONTRACT_INVALID',
      message: '契约校验未通过：缺失字段 scenario、acceptanceCriteria；1 处顺序问题',
      details: {
        ok: false,
        missing: ['scenario', 'acceptanceCriteria'],
        extra: ['notes'],
        orderIssues: [{ field: 'techStack', expectedIndex: 2, actualIndex: 4, occupiedBy: 'timeline' }],
        typeIssues: [{ field: 'milestones', expected: 'array', actual: 'string' }],
        retryAllowed,
        maxRetries: retryAllowed ? 1 : 0,
      },
    },
  }
}

const json = (res, body, status = 200) => {
  const payload = body === undefined ? '' : JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(payload)
}

/** 读取请求体（假服务只在 PATCH/POST 时用到） */
const readJson = (req) =>
  new Promise((resolve) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
    })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : null)
      } catch {
        resolve(null)
      }
    })
  })

/** 明文进、掩码出：假服务也绝不回声明文令牌 */
function maskToken(token) {
  const text = String(token || '')
  if (!text) return null
  return text.length <= 8 ? '••••••••' : `${text.slice(0, 5)}••••••••${text.slice(-4)}`
}

/** 人工视觉验收用的富文本回复（含有意未闭合的代码围栏，用来看渲染） */
const DEFAULT_STREAM_TEXT = [
  '已收到你的问题。',
  '下面给出**可中断**的实现要点：\n\n',
  '```js\n',
  'const handle = createSSEStream(url, { onDelta })\n',
  'handle.abort()\n',
  '```\n\n',
  '中断后服务端仍会落库已生成内容。',
]

/**
 * SSE 假回复。
 * intervalMs 默认 500（人工看节奏像真流式）；E2E 用 20ms，否则一条回复要等十几秒。
 * text 默认富文本；E2E 传纯文本短句，避免"围栏未闭合"这类渲染时序干扰断言。
 */
const streamReply = (res, intervalMs = 500, text = DEFAULT_STREAM_TEXT) => {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  })
  const meta = {
    type: 'meta',
    conversationId: uuid(41),
    agentId: uuid(11),
    model: 'deepseek-chat',
    knowledge: { docs: 2, injectedChars: 12_480, totalChars: 280_832, limit: 200_000, truncated: false },
    attachments: [],
  }
  res.write(`event: meta\ndata: ${JSON.stringify(meta)}\n\n`)

  let index = 0
  const timer = setInterval(() => {
    if (index >= text.length) {
      clearInterval(timer)
      res.write(`data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 1_102, completion_tokens: 268 } })}\n\n`)
      res.write('data: [DONE]\n\n')
      res.end()
      return
    }
    const chunk = {
      id: 'chatcmpl-mock',
      object: 'chat.completion.chunk',
      choices: [{ index: 0, delta: { content: text[index] }, finish_reason: null }],
    }
    res.write(`data: ${JSON.stringify(chunk)}\n\n`)
    index += 1
  }, intervalMs)
  res.on('close', () => clearInterval(timer))
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const path = url.pathname
  const method = req.method || 'GET'

  // 预检
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': '*',
    })
    res.end()
    return
  }

  if (path === '/api/auth/login' && method === 'POST')
    return json(res, { accessToken: 'mock-access-token', refreshToken: 'mock-refresh-token', user })
  if (path === '/api/me') return json(res, { user })
  if (path === '/api/agents' && method === 'GET') return json(res, { agents })
  if (path === '/api/agents' && method === 'POST') {
    const body = (await readJson(req)) || {}
    const created = { ...agents[0], ...body, id: uuid(99), createdAt: new Date().toISOString() }
    created.externalTokenHint = maskToken(body.externalToken)
    delete created.externalToken
    return json(res, { agent: created }, 201)
  }
  // 连通性测试：必须在下面的 /test 通配之前判定
  if (/^\/api\/agents\/[^/]+\/external\/test$/.test(path) && method === 'POST') {
    const agent = agents.find((item) => item.id === path.split('/')[3])
    if (!agent || agent.sourceType !== 'external') {
      return json(res, { ok: false, status: 409, latencyMs: null, error: { message: '该智能体尚未配置外部接入' } }, 409)
    }
    return json(res, { agentId: agent.id, ok: true, status: 200, latencyMs: 187, modelCount: 1 })
  }
  // 解绑外部接入
  if (/^\/api\/agents\/[^/]+\/external$/.test(path) && method === 'DELETE') {
    const agent = agents.find((item) => item.id === path.split('/')[3])
    if (agent) {
      agent.sourceType = 'self_hosted'
      agent.externalBaseUrl = null
      agent.externalAgentId = null
      agent.externalTokenHint = null
    }
    return json(res, undefined, 204)
  }
  if (path.startsWith('/api/agents/') && method === 'PATCH') {
    const id = path.split('/').pop()
    const agent = agents.find((item) => item.id === id) || agents[0]
    const patch = await readJson(req)
    if (patch) {
      const { externalToken, ...rest } = patch
      Object.assign(agent, rest)
      if (externalToken) agent.externalTokenHint = maskToken(externalToken)
      if (rest.sourceType === 'self_hosted') {
        agent.externalBaseUrl = null
        agent.externalAgentId = null
        agent.externalTokenHint = null
      }
    }
    return json(res, { agent })
  }
  if (path.startsWith('/api/agents/') && method === 'DELETE') return json(res, undefined, 204)
  if (path === '/api/teams' && method === 'GET') return json(res, { teams })
  if (path === '/api/teams' && method === 'POST')
    return json(res, { team: { ...teams[0], id: uuid(98), name: '新建团队', agents: [] } }, 201)
  if (path.startsWith('/api/teams/') && method === 'PATCH') {
    const id = path.split('/').pop()
    return json(res, { team: teams.find((item) => item.id === id) || teams[0] })
  }
  if (path.startsWith('/api/teams/') && method === 'DELETE') return json(res, undefined, 204)
  if (path === '/api/providers' && method === 'GET') return json(res, { providers })
  if (path === '/api/providers' && method === 'POST')
    return json(res, { provider: { ...providers[0], id: uuid(97), label: '新建凭据' } }, 201)
  if (path.endsWith('/test') && method === 'POST') {
    return json(res, { providerId: path.split('/')[3], ok: true, status: 200, latencyMs: 214, modelCount: 2 })
  }
  if (path.startsWith('/api/providers/') && method === 'DELETE') return json(res, undefined, 204)
  if (path === '/api/knowledge' && method === 'GET') return json(res, { knowledge })
  if (path === '/api/conversations' && method === 'GET') return json(res, { conversations })
  if (path === '/api/conversations' && method === 'POST')
    return json(res, { conversation: { ...conversations[0], id: uuid(43), title: '新会话' } }, 201)
  // 会话消息与 SSE 流：聊天主路径的 E2E 需要它们（无需真后端）
  if (/^\/api\/conversations\/[^/]+\/messages$/.test(path) && method === 'GET') {
    return json(res, {
      messages: [
        { id: uuid(51), role: 'user', content: '这是历史提问', createdAt: ago(6), tokensIn: 0, tokensOut: 0 },
        { id: uuid(52), role: 'assistant', content: '这是历史回答', createdAt: ago(5), tokensIn: 12, tokensOut: 34 },
      ],
    })
  }
  if (/^\/api\/conversations\/[^/]+\/stream$/.test(path) && method === 'POST') {
    // E2E 走纯文本短回复：内容少、无围栏，断言稳定
    return streamReply(res, 20, ['已收到你的问题。', 'E2E 假回复：流式结束。'])
  }
  if (/^\/api\/conversations\/[^/]+\/messages$/.test(path)) {
    const id = path.split('/')[3]
    return json(res, { messages: messages[id] || [] })
  }
  if (/^\/api\/conversations\/[^/]+\/stream$/.test(path) && method === 'POST') return streamReply(res)
  /* ------------------------------ 流水线 ------------------------------ */
  const pipelineStart = path.match(/^\/api\/pipeline\/([^/]+)\/start$/)
  if (pipelineStart && method === 'POST') {
    const teamId = pipelineStart[1]
    // 真后端 201 形状：{ run, stage }，本阶段会话在 stage.conversationId
    const stages = makeStages(null)
    stages[0] = { ...stages[0], status: 'waiting', artifact: null }
    const run = {
      id: RUN_OK,
      teamId,
      currentStage: 0,
      status: 'running',
      stageCount: stages.length,
      createdAt: new Date().toISOString(),
    }
    pipelineRuns[RUN_OK] = { run, stages }
    const first = stages[0]
    return json(
      res,
      {
        run,
        stage: {
          stageNo: first.stageNo,
          conversationId: first.conversationId,
          agentId: first.agentId,
          agentName: first.agentName,
        },
      },
      201,
    )
  }

  const pipelineAdvance = path.match(/^\/api\/pipeline\/([^/]+)\/advance$/)
  if (pipelineAdvance && method === 'POST') {
    // 复刻 Fastify 行为：带 content-type: application/json 却没有 body → 400，
    // 请求进不到业务逻辑，调用方永远看不到 422 契约详情。
    if (String(req.headers['content-type'] || '').includes('application/json')) {
      return json(
        res,
        {
          statusCode: 400,
          code: 'FST_ERR_CTP_EMPTY_JSON_BODY',
          error: 'Bad Request',
          message: "Body cannot be empty when content-type is set to 'application/json'",
        },
        400,
      )
    }
    const runId = pipelineAdvance[1]
    const state = pipelineRuns[runId]
    if (!state) return json(res, { message: '流水线不存在' }, 404)
    if (runId === RUN_INVALID) return json(res, contractInvalidBody(runId), 422)

    const { run, stages } = state
    const current = stages.find((stage) => stage.stageNo === run.currentStage)
    if (current) {
      current.status = 'validated'
      current.artifact = makeArtifact(true, STAGE1_CONTRACT, STAGE1_OUTPUT.length)
    }
    const next = stages.find((stage) => stage.stageNo === run.currentStage + 1)
    if (next) {
      next.status = 'waiting'
      run.currentStage = next.stageNo
    } else {
      run.status = 'completed'
    }
    return json(res, {
      run,
      stage: current,
      artifact: current?.artifact ?? null,
      next: next
        ? {
            stageNo: next.stageNo,
            conversationId: next.conversationId,
            agentId: next.agentId,
            agentName: next.agentName,
          }
        : null,
      completed: !next,
      injection: next ? { contractChars: 320, bodyChars: 1024, bodyTruncated: false } : null,
    })
  }

  const pipelineRun = path.match(/^\/api\/pipeline\/([^/]+)$/)
  if (pipelineRun && method === 'GET') {
    const state = pipelineRuns[pipelineRun[1]]
    if (!state) return json(res, { message: '流水线不存在' }, 404)
    return json(res, { run: runView(state.run), stages: state.stages })
  }

  if (path === '/api/attachments' && method === 'POST') {
    return json(
      res,
      {
        attachment: { id: uuid(61), filename: '需求草稿.txt', mime: 'text/plain', bytes: 2048, hasText: true },
        extract: { status: 'ok', note: null },
      },
      201,
    )
  }

  return json(res, { message: `mock 未实现：${method} ${path}` }, 404)
})

server.listen(PORT, () => {
  console.log(`[mock-api] listening on http://localhost:${PORT}`)
})

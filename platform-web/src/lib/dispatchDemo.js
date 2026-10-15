/**
 * 主对话「意图派发」演示通道（受控假数据）
 * ------------------------------------------------------------------
 * 为什么需要它：后端 `POST /api/conversations` 的校验里有一条 `.refine` **强制要求
 * `agentDefId` 或 `teamId`**（weaveflow-server/platform-server/src/schemas/chat.ts:10-11），
 * 因此**当前后端根本创建不出「无智能体的主对话」**。主对话的交互要能完整演示，
 * 就只能先走一条受控的假数据通道（方案 v1 已敲定第 5 项：本轮只做前端）。
 *
 * 纪律：
 *  1. 仅当 `VITE_MOCK_DISPATCH` 打开时才会被调用；关闭时前端不引入任何假数据。
 *     **本文件必须由 Chat.vue 动态 `import()` 载入**（不是静态 import）：
 *     演示关键词/假产出不得被打进 Chat-*.js，只存在一个独立 chunk 里。
 *  2. 所有帧都走**与真实 SSE 完全相同的入口**（onEvent / onDelta），不另开旁路——
 *     后端按 docs/主对话意图派发方案-v1.md §3.5 实现后，前端零改动切换。
 *  3. 纯本地：不发起任何网络请求，不消耗上游 `app/run` 配额。
 *  4. 帧结构严格对齐契约（kind / intent / teamId / teamName / agentId / agentName /
 *     stageNo / stageCount / reason / candidates），一个键都不多、不少。
 *  5. 演示数据必须一眼可辨：面板/卡片/抽屉里的每段产出都带「演示数据」字样。
 *
 * 第三判定（batch 4）：完全不命中任何团队时，**不在这里编回答**。
 *   `classifyIntent()` 把输入判成 route / confirm / fallback 三态；fallback 由 Chat.vue
 *   交给真实的「织流」去答（真实 conversation + stream）。本文件对 fallback
 *   一个帧都不 emit，两者不混为一谈。
 * batch 6c：`classifyIntent()` 加**动作词门槛**（见 ACTION_WORDS）——
 *   只靠项目名词判派发会把「讲两句毕设答辩的注意事项」这类**提问**误判成**委托**。
 * ------------------------------------------------------------------
 */

/** 开关：`VITE_MOCK_DISPATCH=true|1` 视为开启；未配置 / 其它值一律关闭 */
export const MOCK_DISPATCH_ENABLED = ['true', '1'].includes(
  String(import.meta.env.VITE_MOCK_DISPATCH ?? '').toLowerCase(),
)

/** 演示团队（与 docs 中「毕业设计流水线」一致） */
export const DEMO_TEAM = { teamId: 'demo-team-graduation', teamName: '毕业设计流水线' }

/**
 * 演示阶段：五个名字取自接入的 5 个智能体（来源见内部接入文档）。
 * `contract` 是该阶段的契约校验结果（产出抽屉用；形状对齐 lib/contract.js 的 normalize）。
 */
export const DEMO_STAGES = [
  {
    agentId: 'demo-agent-1',
    agentName: '①毕设选题与立项顾问',
    contract: { ok: true },
    content: [
      '**选题与立项建议（演示数据）**',
      '',
      '- 推荐题目：《基于 Spring Boot + Vue 的校园二手交易平台》',
      '- 立项理由：业务闭环清晰、实体少、答辩好讲',
      '- 技术栈：Spring Boot 3 / MySQL / Vue 3 / Element Plus',
      '- 开发周期：约 10 周',
    ].join('\n'),
  },
  {
    agentId: 'demo-agent-2',
    agentName: '②需求分析与开题工程师',
    contract: {
      ok: false,
      missing: ['非功能指标', '角色与权限矩阵'],
      retryAllowed: true,
      maxRetries: 1,
    },
    content: [
      '**需求分析与开题（演示数据）**',
      '',
      '- 角色：学生（发布 / 下架商品）、管理员（审核 / 分类）',
      '- 核心用例 8 个：注册登录、发布商品、搜索筛选、下单、评价、审核、分类管理、数据统计',
      '- 开题报告已按「研究背景 / 目标 / 技术路线」三段给出',
    ].join('\n'),
  },
  {
    agentId: 'demo-agent-3',
    agentName: '③架构与数据库设计工程师',
    contract: { ok: true },
    content: [
      '**架构与库表设计（演示数据）**',
      '',
      '- 分层：controller / service / mapper，前后端分离',
      '- 表 6 张：user / product / category / order / review / audit_log',
      '- 关键约束：order.product_id → product.id（外键），状态字段用枚举',
      '- 接口 14 个，已按 RESTful 命名并标注鉴权要求',
    ].join('\n'),
  },
  {
    agentId: 'demo-agent-4',
    agentName: '④代码开发与测试工程师',
    contract: {
      ok: false,
      missing: ['测试覆盖率报告'],
      retryAllowed: true,
      maxRetries: 2,
    },
    content: [
      '**代码与测试（演示数据）**',
      '',
      '- 后端骨架：Spring Boot + MyBatis-Plus + JWT 鉴权',
      '- 前端骨架：Vue 3 + Vite + Pinia',
      '- 单测覆盖核心 service 层，接口测试 14 条',
      '- 遗留项：支付模块本期不做，用「线下交易」替代',
    ].join('\n'),
  },
  {
    agentId: 'demo-agent-5',
    agentName: '⑤毕业论文规范工程师',
    contract: { ok: true },
    content: [
      '**论文规范检查（演示数据）**',
      '',
      '- 结构：摘要 / 绪论 / 需求分析 / 设计与实现 / 测试 / 结论，共 6 章',
      '- 图表编号与参考文献格式（GB/T 7714）已逐条核对',
      '- 提示：第三章「需求分析」与公开资料重合度偏高，建议重写两段',
    ].join('\n'),
  },
]

/**
 * 团队成员花名册：侧栏面板与 `@ 召唤` 共用的**唯一名字来源**。
 * 面板成员行、@ 解析、派发帧里的 agentName 全部出自这张表，不另写一套匹配规则。
 */
export const DEMO_ROSTER = DEMO_STAGES.map((stage, index) => ({
  agentId: stage.agentId,
  name: stage.agentName,
  stageNo: index,
}))

/** 未派发时侧栏面板的示例意图芯片（点击即派发；第 3 条用于演示低置信度回问） */
export const DEMO_INTENT_EXAMPLES = ['我想做软件开发毕设', '我要做毕业设计', '帮我做个课程设计']

/** 关键词表（演示用；方案 §3.2 的「规则优先」） */
const KEYWORDS = ['软件开发毕设', '软件工程毕设', '毕业设计', '毕设']

/**
 * 动作词表（batch 6c 新增）：判定「用户想让我**动手做点什么**」的委托信号。
 * ------------------------------------------------------------------
 * 依据（实测，batch 6c 问题①）：只看项目类名词不看意图时，
 *   「讲两句毕设答辩的注意事项」会被派发——可用户要的是**回答**，不是**委托**。
 *   凡是"像在问怎么做 / 要注意什么"的句子，都缺一个「我要你做」的动作词。
 * 取值依据（刻意保持粗粒度，不做词形/边界匹配，保持原有容错性）：
 *   - 想 / 我要 / 我需要 / 帮我：把"主体意愿"显式说出来的口语信号（"我想…"、"帮我…"）；
 *   - 做：覆盖最常见的委托句式「做一个」「做个」「做一下」；
 *   - 搭：覆盖「搭个网站 / 搭一个系统」；
 *   - 开发一个：覆盖「开发一个系统」这类不带「做/想」的动宾短语
 *     （「做一个」其实已被单字「做」覆盖，保留成词形式只是为了将来把这一层
 *     换成更精确的规则时有个集中的落点，改一处即可）。
 * ⚠️ 它只做**门槛**，不替换原有判定：命中动作词后仍按关键词 → 项目信号两级走
 *    route / confirm，判定逻辑本身一个字没改。
 */
const ACTION_WORDS = ['想', '我要', '我需要', '帮我', '做', '搭', '开发一个', '做一个']

/**
 * 项目类需求信号（演示用）：像在建一个东西、但说不清要派给哪个团队。
 * batch 6c 起它**只在命中动作词之后**才被检查（见 classifyIntent）：
 * 命中 → need-confirm 回问；一个都不命中 → fallback（交给织流真实回答）。
 */
const PROJECT_SIGNALS = [
  '系统',
  '开发',
  '设计',
  '毕设',
  '项目',
  '平台',
  '网站',
  '小程序',
  '软件',
  '课程设计',
  '毕业设计',
]

/** 低置信度候选（演示用） */
const DEMO_CANDIDATES = [
  { teamId: DEMO_TEAM.teamId, teamName: DEMO_TEAM.teamName, confidence: 0.42 },
  { teamId: 'demo-team-coursework', teamName: '课程设计流水线', confidence: 0.31 },
]

const FINISH_TEXT = [
  '**五个阶段已全部产出（演示数据）**',
  '',
  '- 左栏会话列表里可以逐条回看每个阶段的完整过程；',
  '- 也可以直接再输入一句新需求，重走一遍意图识别与派发。',
].join('\n')

const REJECT_TEXT = '好的。能再具体说一句你想做什么吗？例如：**我想做软件开发毕设**。'

/** 规则优先：命中即直接派发（返回命中的关键词作为意图名） */
export function matchIntent(text) {
  const raw = String(text || '')
  return KEYWORDS.find((keyword) => raw.includes(keyword)) || ''
}

/**
 * 三态判定（方案 §3.2「规则优先」的第三种，batch 4 新增；batch 6c 加动作词门槛）：
 *   'route'    动作词 + 团队关键词同时命中（如「我想做软件开发毕设」）→ 派发
 *   'confirm'  动作词 + 项目信号同时命中、但没点名团队（如「帮我随便做个系统」）
 *              → need-confirm 回问（不擅自派发）
 *   'fallback' 其它（问候、常识、平台使用问题、**只有项目名词没有委托动作**…）
 *              → ★ 交给「织流」真实回答，本文件不 emit 任何帧
 *
 * batch 6c 的改动只有一处：把「动作词」变成**前置于关键词/项目信号的门槛**。
 *   依据（实测）：只按关键词判定时，「讲两句毕设答辩的注意事项」会被派发，
 *   而用户要的是一段真实回答 —— 整句里没有任何"我要你动手做"的信号。
 *   反过来「我想做软件开发毕设」既有动作词又点名了团队，仍走 route；
 *   「帮我随便做个系统」有动作词但没点名团队，仍走 confirm（原行为）。
 *   命中动作词但完全不像项目（如「我想了解一下学习方法」）→ fallback。
 * 为什么用「命中即通过」而不是整句正则：演示判定本来就是粗粒度的，
 *   写成必须整句匹配的规则会立刻变脆（用户措辞稍有变化就失灵）。
 */
export function classifyIntent(text) {
  const raw = String(text || '')
  // ① 动作词门槛：没有「要我动手做点什么」的信号，一律不派发，交给织流真实回答
  if (!ACTION_WORDS.some((word) => raw.includes(word))) return 'fallback'
  // ② 点名了团队关键词 → 派发；③ 像项目但没点名 → 回问确认
  if (matchIntent(raw)) return 'route'
  return PROJECT_SIGNALS.some((signal) => raw.includes(signal)) ? 'confirm' : 'fallback'
}

/**
 * 创建演示驱动。
 * 回调签名与 Chat.vue 消费真实 SSE 的那几个函数一一对应：
 *   onEvent({ event, data })   —— dispatch 帧（与真实 stream 同形）
 *   onDelta(rawChunk)          —— 上游 OpenAI chunk 原文（与真实 stream 同形）
 *   onTurnStart() / onTurnDone() —— 一轮正文的开始 / 结束（决定占位消息的生命周期）
 *   onArtifact({ agentId, content, contract }) —— 阶段产出（写进 activeDispatch.artifacts）
 * 返回 { start, choose, reject, confirm, summon, abort, stageCount, roster, examples }
 */
export function createDispatchDemo({ onEvent, onDelta, onTurnStart, onTurnDone, onArtifact } = {}) {
  let alive = true
  const timers = new Set()
  let stageNo = -1
  let intent = ''

  function wait(ms) {
    return new Promise((resolve) => {
      const entry = { resolve, timer: 0 }
      entry.timer = setTimeout(() => {
        timers.delete(entry)
        resolve()
      }, ms)
      timers.add(entry)
    })
  }

  function abort() {
    alive = false
    for (const entry of timers) {
      clearTimeout(entry.timer)
      entry.resolve()
    }
    timers.clear()
  }

  function emitDispatch(payload) {
    if (!alive) return
    onEvent?.({ event: 'dispatch', data: JSON.stringify(payload) })
  }

  /** 按 12 字切块推增量，模拟真实流式的到达节奏 */
  async function streamText(text) {
    if (!alive) return
    onTurnStart?.()
    const chunks = String(text).match(/[\s\S]{1,12}/g) || []
    for (const chunk of chunks) {
      if (!alive) return
      onDelta?.(JSON.stringify({ choices: [{ delta: { content: chunk } }] }))
      await wait(40)
    }
    if (!alive) return
    onTurnDone?.()
  }

  function stageBase(index) {
    const stage = DEMO_STAGES[index]
    return {
      intent,
      teamId: DEMO_TEAM.teamId,
      teamName: DEMO_TEAM.teamName,
      agentId: stage.agentId,
      agentName: stage.agentName,
      stageNo: index,
      stageCount: DEMO_STAGES.length,
    }
  }

  async function routed(reason) {
    emitDispatch({ kind: 'routed', ...stageBase(0), reason })
    await wait(320)
  }

  async function runStage(index) {
    if (!alive) return
    stageNo = index
    const stage = DEMO_STAGES[index]
    emitDispatch({ kind: 'stage-start', ...stageBase(index), reason: `第 ${index + 1}/${DEMO_STAGES.length} 阶段开始` })
    await wait(200)
    await streamText(stage.content)
    if (!alive) return
    onArtifact?.({ agentId: stage.agentId, content: stage.content, contract: stage.contract })
    emitDispatch({ kind: 'stage-done', ...stageBase(index), reason: '本阶段产出已生成，确认后进入下一阶段' })
  }

  async function start(text) {
    const kind = classifyIntent(text)
    if (kind === 'route') {
      intent = matchIntent(text)
      await routed(`命中关键词：${intent}`)
      await runStage(0)
      return 'route'
    }
    // 第三种：完全不命中 → 不在这里编回答、也不 emit 任何帧，
    // 由调用方（Chat.vue）转交真实的「织流」。
    if (kind === 'fallback') return 'fallback'
    emitDispatch({
      kind: 'need-confirm',
      intent: String(text || '')
        .trim()
        .slice(0, 12),
      teamId: '',
      teamName: '',
      agentId: '',
      agentName: '',
      stageNo: 0,
      stageCount: DEMO_STAGES.length,
      reason: '规则未命中，LLM 兜底分类置信度 0.42 < 阈值 0.60，先回问你而不是乱派',
      candidates: DEMO_CANDIDATES,
    })
    return 'confirm'
  }

  async function choose(candidate) {
    if (!alive) return
    const hit = matchIntent(intent) || intent || '软件开发毕设'
    intent = hit
    if (candidate?.teamId && candidate.teamId !== DEMO_TEAM.teamId) {
      await streamText(`演示通道只内置了「${DEMO_TEAM.teamName}」这一条链路，暂不派发到「${candidate.teamName}」。`)
      return
    }
    await routed(`用户确认候选：${candidate?.teamName || DEMO_TEAM.teamName}`)
    await runStage(0)
  }

  async function reject() {
    if (!alive) return
    await streamText(REJECT_TEXT)
  }

  async function confirm() {
    if (!alive) return
    const next = stageNo + 1
    if (next < DEMO_STAGES.length) {
      await runStage(next)
      return
    }
    await streamText(FINISH_TEXT)
  }

  /**
   * @ 召唤：让被点名的成员作为**普通消息**回答，**不推进阶段**
   * （不 emit 任何 dispatch 帧，所以 activeDispatch 的 stageNo/stage 状态原样不动）。
   */
  async function summon(member, text) {
    if (!alive) return
    const who = member?.name || '该成员'
    const stageHint = stageNo >= 0 ? `阶段仍停在第 ${stageNo + 1}/${DEMO_STAGES.length} 阶段` : '当前还没有派发阶段'
    await streamText(
      [
        `**${who} · 补充说明（演示数据）**`,
        '',
        `收到你的召唤：「${String(text || '').trim() || '（只 @ 了人，没有正文）'}」`,
        '',
        `- 这是一条**普通消息**回复：只在主对话里答话，**不推进阶段**；`,
        `- ${stageHint}，确认后才会继续。`,
        '- 需要的话，点左栏成员行可以打开我的阶段产出全文与契约校验结果。',
      ].join('\n'),
    )
  }

  return {
    start,
    choose,
    reject,
    confirm,
    summon,
    abort,
    stageCount: DEMO_STAGES.length,
    roster: DEMO_ROSTER,
    examples: DEMO_INTENT_EXAMPLES,
  }
}

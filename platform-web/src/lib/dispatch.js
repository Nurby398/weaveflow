/**
 * 主对话「当前调度」单一真源（方案 §3.8）
 * ------------------------------------------------------------------
 * 侧栏面板、派发卡片、消息流发言人条 —— 三处**必须**从同一份 `activeDispatch` 派生。
 * 本文件就是这份状态的形状、归约（dispatch 帧 → 状态）与展示派生的唯一出处：
 *   1. `createActiveDispatch()` / `applyDispatchFrame()` 只认方案 §3.5 的 dispatch 契约键，
 *      不新增、不改名（契约一字不改）；
 *   2. 成员状态只用流水线既有枚举 pending / waiting / running / validated / failed
 *      （见 components/ui/Steps.vue 注释），不另造状态词；
 *   3. `parseMention()` 的成员名来源 = 状态里的 `members`（演示通道的成员名由同一个
 *      DEMO_STAGES 表喂进 `members`），因此全局只有一套名字匹配规则。
 *
 * 产出（产出抽屉的全文 + 契约校验）也挂在这份状态里（`artifacts`），由使用方在
 * 阶段产出到达时写入——真实链路接入后由后端提供，前端不改结构。
 * ------------------------------------------------------------------
 */

/** 成员/阶段状态枚举：与 platform-server 的 StageStatus 及 ui/Steps.vue 完全一致 */
export const MEMBER_STATUS = ['pending', 'waiting', 'running', 'validated', 'failed']

/** 状态展示文案（与 ui/Steps.vue 的 STATUS_TEXT 同一套词，避免同状态两种说法） */
const STATUS_TEXT = {
  pending: '待开始',
  waiting: '等待产出',
  running: '进行中',
  validated: '已校验',
  failed: '失败',
}

/** 派发整体状态文案（面板右侧那枚小标签） */
const OVERALL_TEXT = {
  idle: '待派发',
  running: '进行中',
  awaiting: '待你确认',
  done: '已完成',
  failed: '失败',
}

const OVERALL_TONE = {
  idle: 'neutral',
  running: 'info',
  awaiting: 'warn',
  done: 'success',
  failed: 'danger',
}

const STATUS_TONE = {
  pending: 'neutral',
  waiting: 'warn',
  running: 'info',
  validated: 'success',
  failed: 'danger',
}

/** ①–⑩：@ 召唤与成员名里都可能带这个序号前缀 */
const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩'

/** 状态串归一：未知值降级为 pending，样式与筛选都不会塌 */
export function statusOf(value) {
  const status = String(value || 'pending').toLowerCase()
  return STATUS_TEXT[status] ? status : 'pending'
}

export function statusText(value) {
  return STATUS_TEXT[statusOf(value)]
}

export function statusTone(value) {
  return STATUS_TONE[statusOf(value)]
}

export function overallText(value) {
  return OVERALL_TEXT[value] || OVERALL_TEXT.idle
}

export function overallTone(value) {
  return OVERALL_TONE[value] || OVERALL_TONE.idle
}

/** 成员名归一：去掉开头的序号前缀与空白，用于「按名字」匹配 */
export function normalizeMemberName(name) {
  return String(name || '')
    .replace(/^[\s①-⑩\d.、]+/, '')
    .trim()
}

/** 空状态：字段形状即方案 §3.8 的 activeDispatch */
export function createActiveDispatch() {
  return {
    teamId: '',
    teamName: '',
    intent: '',
    reason: '',
    stageNo: -1,
    stageCount: 0,
    /** idle | running | awaiting | done | failed */
    status: 'idle',
    /** [{ agentId, name, stageNo, status }] */
    members: [],
    currentAgentId: '',
    currentAgentName: '',
    candidates: [],
    /** agentId → { content, contract }：产出抽屉的单一来源 */
    artifacts: {},
    /** 控制权（方案 §3.7）：暂停调度 / 接管 */
    paused: false,
    takeover: false,
  }
}

/** 就地清空（保留响应式代理，不换对象引用） */
export function resetActiveDispatch(state) {
  Object.assign(state, createActiveDispatch())
}

/** 用团队花名册铺底（同一批成员名喂给状态，供面板与 @ 解析共用） */
export function seedMembers(state, roster = []) {
  state.members = roster.map((member, index) => ({
    agentId: String(member?.agentId || ''),
    name: String(member?.name || `成员 ${index + 1}`),
    stageNo: Number.isFinite(Number(member?.stageNo)) ? Number(member.stageNo) : index,
    status: 'pending',
  }))
  state.stageCount = state.members.length
}

/** 找成员：agentId 优先，其次归一后的名字 */
export function memberOf(state, { agentId, name } = {}) {
  const members = state?.members || []
  if (agentId) {
    const byId = members.find((member) => member.agentId && member.agentId === agentId)
    if (byId) return byId
  }
  const key = normalizeMemberName(name)
  if (!key) return null
  return members.find((member) => normalizeMemberName(member.name) === key) || null
}

/** 没有就建：真实链路下成员表由 dispatch 帧逐个补齐 */
function ensureMember(state, { agentId, name, stageNo } = {}) {
  if (!agentId && !name) return null
  const found = memberOf(state, { agentId, name })
  if (found) {
    if (name) found.name = String(name)
    if (Number.isFinite(Number(stageNo)) && Number(stageNo) >= 0) found.stageNo = Number(stageNo)
    return found
  }
  const member = {
    agentId: String(agentId || ''),
    name: String(name || `成员 ${state.members.length + 1}`),
    stageNo: Number.isFinite(Number(stageNo)) && Number(stageNo) >= 0 ? Number(stageNo) : state.members.length,
    status: 'pending',
  }
  state.members.push(member)
  state.members.sort((a, b) => a.stageNo - b.stageNo)
  if (state.stageCount < state.members.length) state.stageCount = state.members.length
  return member
}

/** 把某一阶段的成员状态推进到位：之前的已完成、之后的回到待开始 */
function markStage(state, index, status) {
  if (!Number.isFinite(index) || index < 0) return
  state.stageNo = index
  state.members = state.members
    .map((member) => ({
      ...member,
      status: member.stageNo < index ? 'validated' : member.stageNo === index ? status : 'pending',
    }))
    .sort((a, b) => a.stageNo - b.stageNo)
  const current = state.members.find((member) => member.stageNo === index)
  state.currentAgentId = current?.agentId || ''
  state.currentAgentName = current?.name || ''
}

/**
 * dispatch 帧 → 状态（方案 §3.5 契约键：kind / intent / teamId / teamName /
 * agentId / agentName / stageNo / stageCount / reason / candidates）。
 * 未知 kind 不落地，避免脏帧把面板画歪。
 */
export function applyDispatchFrame(state, payload) {
  if (!state || !payload || typeof payload !== 'object') return
  const kind = String(payload.kind || '')
  if (!kind) return

  if (payload.teamId) state.teamId = String(payload.teamId)
  if (payload.teamName) state.teamName = String(payload.teamName)
  if (payload.intent) state.intent = String(payload.intent)
  if (payload.reason) state.reason = String(payload.reason)
  const count = Number(payload.stageCount)
  if (Number.isFinite(count) && count > 0) state.stageCount = count
  const no = Number(payload.stageNo)
  if (Number.isFinite(no) && no >= 0) state.stageNo = no

  const member = ensureMember(state, {
    agentId: payload.agentId,
    name: payload.agentName,
    stageNo: payload.stageNo,
  })

  if (kind === 'routed') {
    if (member) member.status = 'waiting'
    state.currentAgentId = payload.agentId || member?.agentId || ''
    state.currentAgentName = payload.agentName || member?.name || ''
    state.status = 'running'
    return
  }
  if (kind === 'stage-start') {
    markStage(state, state.stageNo, 'running')
    state.status = 'running'
    return
  }
  if (kind === 'stage-done') {
    markStage(state, state.stageNo, 'validated')
    state.status = state.members.every((item) => item.status === 'validated') ? 'done' : 'awaiting'
    return
  }
  if (kind === 'need-confirm') {
    state.status = 'awaiting'
    state.candidates = Array.isArray(payload.candidates) ? payload.candidates.slice() : []
    state.currentAgentId = ''
    state.currentAgentName = ''
  }
}

/** 写入阶段产出（产出抽屉的数据来源） */
export function setArtifact(state, agentId, artifact) {
  const key = String(agentId || '')
  if (!state || !key) return
  state.artifacts[key] = {
    content: String(artifact?.content || ''),
    contract: artifact?.contract && typeof artifact.contract === 'object' ? artifact.contract : null,
  }
}

export function isDispatched(state) {
  return Boolean(state && state.stageCount > 0 && (state.teamName || state.members.length))
}

/** 「1/5」：阶段号 1 基，取不到返回空串 */
export function progressLabel(state) {
  const total = Number(state?.stageCount) || 0
  const no = Number(state?.stageNo)
  if (!total || !Number.isFinite(no) || no < 0) return ''
  return `${Math.min(no + 1, total)}/${total}`
}

/** 进度条填充比：已完成阶段满载，进行中阶段算半格 */
export function progressRatio(state) {
  const total = Number(state?.stageCount) || 0
  const no = Number(state?.stageNo)
  if (!total || !Number.isFinite(no) || no < 0) return 0
  const weight = state.status === 'running' ? 0.5 : 1
  return Math.max(0, Math.min(1, (no + weight) / total))
}

/** 当前发言人（面板高亮与窄屏轻量条共用） */
export function currentSpeakerName(state) {
  const member = memberOf(state, { agentId: state?.currentAgentId, name: state?.currentAgentName })
  return member?.name || state?.currentAgentName || ''
}

/** 序号 token → 下标；非法返回 -1 */
function indexOfToken(token) {
  const raw = String(token || '')
  if (!raw) return -1
  if (CIRCLED.includes(raw)) return CIRCLED.indexOf(raw)
  const num = Number(raw)
  return Number.isInteger(num) && num > 0 ? num - 1 : -1
}

/**
 * @ 召唤解析（方案 §3.7 增强层）。
 * 识别 `@③ 这个表设计再拆细一点` / `@③架构与数据库设计工程师 …` / `@架构与数据库设计工程师 …`。
 * 成员名只从传入的 `members` 里取（＝当前调度的同一份花名册），不另写一张名字表。
 * @returns {null | { member, text, token }} text = 去掉 @ 提及后的剩余正文
 */
export function parseMention(text, members = []) {
  const raw = String(text || '')
  const at = raw.indexOf('@')
  if (at < 0 || !members.length) return null
  const tail = raw.slice(at + 1)
  const match = tail.match(/^\s*([①-⑩]|\d{1,2})?\s*([^\s@，,。.;；:：、!！?？]*)/)
  if (!match) return null
  const numberToken = match[1] || ''
  const nameToken = match[2] || ''
  if (!numberToken && !nameToken) return null

  let member = null
  const index = indexOfToken(numberToken)
  if (index >= 0 && index < members.length) member = members[index]
  if (!member && nameToken) {
    const key = normalizeMemberName(nameToken)
    member =
      members.find((item) => normalizeMemberName(item.name) === key) ||
      members.find((item) => normalizeMemberName(item.name).includes(key)) ||
      null
  }
  if (!member) return null
  return {
    member,
    token: `@${numberToken && member ? numberToken : member.name}`,
    text: tail.slice(match[0].length).trim(),
  }
}

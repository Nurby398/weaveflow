<script setup>
/**
 * 对话界面（核心屏）
 * ------------------------------------------------------------------
 * 形态对齐 DeepSeek Harness 的对话界面：**全屏三段式**
 *   左：会话栏（新建对话 + 会话列表）  中：消息流（顶栏 + 可滚动对话）  下：输入区
 * 视觉规则（单主题明亮模式）：
 *   - 层级靠「底色差 + 1px 细边框」，不靠阴影；卡片不投影，只有浮层才有阴影；
 *   - 唯一强调色只出现在主按钮、选中态、focus 光晕上，不铺大块背景；
 *   - 间距一律取 8px 网格（4/8/12/16/24/32），圆角只用 6/8/12 三档。
 *
 * SSE 协议（对齐 platform-server/src/services/chat-stream.ts）：
 *   event: meta  data: { type, conversationId, agentId, model, knowledge, attachments }
 *   data: <上游 OpenAI chunk 原文>          ← 增量正文在 choices[0].delta.content
 *   event: error data: { message }
 *   data: [DONE]                            ← 由 stream.js 内部消费
 *   ↑ 以上三种的语义一个字节都不许改（既有实现 + 测试按此固定）。
 *
 * ★ 意图派发 · 织流即主对话（batch 6b 合并，2026-10-14）：
 *   - **不再有独立的 /chat/master 入口**（选择页的「主对话」卡片已删）。派发判定改在
 *     **织流会话**（/chat/:id 且该会话的 agent 是「织流」）里前置：用户发消息先过
 *     `classifyIntent()` 三态判定（复用 lib/dispatchDemo.js，判定逻辑不重写）——
 *       route / confirm → 渲染派发卡片（照搬演示驱动：routed → stage-start → 产出 → stage-done/确认）；
 *       fallback        → **就按普通消息发给织流**（走既有 send()/stream 路径）。
 *   - 新增 SSE 事件 event: dispatch（**只加不改**），data 契约见方案 §3.5，
 *     由 components/DispatchCard.vue 渲染成派发卡片；
 *   - 后端 `POST /api/conversations` 仍强制要求 agentDefId/teamId，故 route / confirm
 *     两条仍由 lib/dispatchDemo.js 的受控假数据通道驱动（开关 VITE_MOCK_DISPATCH，
 *     开启时页面有「演示数据」标注）；fallback 是**真实调用**，不 emit 任何 dispatch 帧。
 *
 * 默认落点（batch 5/6b）：
 *   - 登录/注册成功 → /chat（Login.vue）→ 本组件自动打开与「织流」的会话（复用最近一条）；
 *   - /chat?pick=1 → 「选择智能体」页（左栏「新建对话」走这条），只列智能体卡片。
 * ------------------------------------------------------------------
 */
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Avatar from '@/components/ui/Avatar.vue'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import Drawer from '@/components/ui/Drawer.vue'
import PlanCard from '@/components/PlanCard.vue'
import ChatMessageList from '@/components/ChatMessageList.vue'
import ChatComposer from '@/components/ChatComposer.vue'
import ChatRail from '@/components/ChatRail.vue'
import Empty from '@/components/ui/Empty.vue'
import Modal from '@/components/ui/Modal.vue'
import { agentApi, conversationApi, logApiError, toFriendlyError, uploadAttachment } from '@/api'
import { createSSEStream } from '@/api/stream'
import { useAuthGuard } from '@/composables/useAuthGuard'
import { useToast } from '@/composables/useToast'
import { useUserStore } from '@/store/user'
import { agentAvatar, DEFAULT_ASSISTANT_NAME } from '@/lib/avatars'
import thinkingGif from '../../../picture/思考中.gif'
import { hasContractIssues, normalizeContractDetails, retryHint } from '@/lib/contract'
import {
  applyDispatchFrame,
  createActiveDispatch,
  currentSpeakerName,
  isDispatched,
  memberOf,
  parseMention,
  progressLabel,
  resetActiveDispatch,
  seedMembers,
  setArtifact,
  statusText,
  statusTone,
} from '@/lib/dispatch'
import { formatBytes, shortId } from '@/lib/format'
import { groupConversations } from '@/lib/conversationGroups'
import { renderMarkdown } from '@/lib/markdown'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const userStore = useUserStore()
const { requireLogin } = useAuthGuard()

const conversationId = computed(() => String(route.params.conversationId || ''))

/**
 * 「选择智能体」页开关：/chat?pick=1。
 * 由左栏「新建对话」写入；/chat 不带 query 时**不再是**选择页，而是自动打开默认会话。
 */
const pickMode = computed(() => String(route.query.pick || '') === '1')

/**
 * 默认聊天对象：平台自有智能体（sourceType=external），展示名 = DEFAULT_ASSISTANT_NAME。
 * ⚠️ 按 name 精确匹配是**临时约定**——后端 agent 记录目前没有「是否默认聊天对象」字段
 *    （对应 docs/通用智能体与白标方案-v1.md 待办 23）。Java 版应在 agent 上加一个显式字段
 *    （如 agent_defs.is_default_assistant），前端改为读该字段，不再按名字认人。
 *    名字的唯一真源是 lib/avatars.js 导出的 DEFAULT_ASSISTANT_NAME，本文件不再写字面量——
 *    字面量散在多处时，库里一改名就会静默失联（batch 6a 修的就是这个）。
 */
const defaultAssistant = computed(() => agents.value.find((item) => item.name === DEFAULT_ASSISTANT_NAME) || null)
/** 正在解析 / 创建默认会话：期间渲染 loading 占位，避免先闪一下「选择智能体」页 */
const resolvingDefault = ref(false)

/**
 * 演示通道开关：开启才有假数据，关闭时一律走真实接口路径。
 * **不静态引入 lib/dispatchDemo.js**——那会把演示关键词/假产出打进 Chat-*.js；
 * 该模块只在开关为真时用动态 import() 载入（独立 chunk，见 loadDispatchDemo）。
 * 生产环境 .env.production 没有 VITE_MOCK_DISPATCH ⇒ 这里恒为 false。
 */
const mockDispatch = ['true', '1'].includes(String(import.meta.env.VITE_MOCK_DISPATCH ?? '').toLowerCase())
/** 演示驱动（只有「主对话 + 开关开启」时非空） */
let demo = null
/** 演示驱动是否正处在「一轮阶段跑完之前」的忙态（含帧与帧之间的空档） */
let demoRunning = false
/** 演示模块（动态 import 后缓存；关闭开关时永远是 null） */
let demoModule = null
/** dispatch 帧生成的消息 id 序号（本地渲染用，不落库） */
let dispatchSeq = 0

/**
 * ★ 单一真源（方案 §3.8）：侧栏面板、派发卡片、消息流发言人条全部从这一份派生。
 * 禁止侧栏另拉接口或另存状态——handleDispatch 是唯一的写入点。
 */
const activeDispatch = reactive(createActiveDispatch())
/** 演示通道给的示例意图芯片（动态 import 后才填；真链路下为空） */
const demoExamples = ref([])
/** 侧栏面板折叠态 */
const panelCollapsed = ref(false)
/** 产出抽屉：打开的是哪个成员（null = 关闭） */
const drawerMember = ref(null)
const drawerOpen = ref(false)
/** 抽屉里「让它补充说明」后要把焦点放回输入框 */
const composerRef = ref(null)

/**
 * ★ 是否「织流会话」= 主对话（batch 6b 合并）。
 * 判据只看**这个会话的 agent 是不是「织流」**（meta 优先，其次会话记录上的 agentDefId），
 * 不看路由——独立的 /chat/master 入口已废弃。默认助手名字的唯一真源是 DEFAULT_ASSISTANT_NAME。
 */
const isWeaveflowConversation = computed(() => {
  const agent = headerAgent.value
  const assistant = defaultAssistant.value
  return Boolean(agent && assistant && agent.id === assistant.id)
})
/** 最近的派发目标：给随后产出的 assistant 消息打「发言人条」（名字 + 身份） */
const dispatchAgent = ref('')
const dispatchAgentId = ref('')

const conversations = ref([])
const agents = ref([])
const messages = ref([])
const loadingMessages = ref(false)
const input = ref('')
/** 待发送 / 已上传的附件 */
const uploads = ref([])
const streaming = ref(false)
const streamError = ref('')

/**
 * ★ 流式「思考中」计时（batch 6a）。
 * 计时从**请求发出**那一刻开始（即 streaming 由 false → true），每秒刷新一次；
 * 结束 / 失败 / 中断（streaming 回到 false）即停表——组件据此移除整条提示。
 * 与既有「正在生成」指示合并：消息流里这条思考条就是**唯一**的生成提示
 * （原 .md-body--streaming 光标已并进它，见模板注释），同一时刻不再有第二处在闪。
 */
const thinkingSeconds = ref(0)
let thinkingTimer = 0
let thinkingStartedAt = 0

function startThinkingClock() {
  stopThinkingClock()
  thinkingStartedAt = Date.now()
  thinkingSeconds.value = 0
  thinkingTimer = window.setInterval(() => {
    thinkingSeconds.value = Math.floor((Date.now() - thinkingStartedAt) / 1000)
  }, 1000)
}

function stopThinkingClock() {
  if (!thinkingTimer) return
  window.clearInterval(thinkingTimer)
  thinkingTimer = 0
}

watch(streaming, (on) => (on ? startThinkingClock() : stopThinkingClock()))
/** meta 帧：模型、知识注入统计 */
const meta = ref(null)

/** 当前打开「⋯」菜单的会话 id（空串 = 没有菜单打开） */
const menuForId = ref('')
/**
 * 菜单项：只做用户点名的「重命名 / 删除」两项。
 * 参照页菜单里还有「置顶 / 分享 / 多选」，用户明确说不做，故不进入本表。
 */
const MENU_ITEMS = [
  { key: 'rename', label: '重命名' },
  { key: 'delete', label: '删除', danger: true },
]
const menuIndex = ref(0)
/**
 * 菜单浮层坐标：会话列表是滚动容器，就地渲染的下拉会被它裁掉，
 * 因此菜单 Teleport 到 body 并用 position:fixed，坐标在这里按 ⋯ 按钮的矩形算好。
 */
const menuPos = ref({ top: 0, right: 0 })
const menuRef = ref(null)

/** 正在行内改名的会话 id（空串 = 无） */
const renamingId = ref('')
const renameDraft = ref('')
const renameInputRef = ref(null)
/** 本次行内编辑是否已结束（已提交或已取消）：用于压掉输入框卸载时可能补发的 blur */
let renameSettled = false

/** 删除的二次确认弹窗（流程为暂定，见模板中该弹窗上方的说明） */
const confirmDelete = ref(false)
const pendingDelete = ref(null)
const deleting = ref(false)

let handle = null
let streamTarget = null
let raf = 0

const readyAttachmentIds = computed(() =>
  uploads.value.filter((item) => item.status === 'done' && item.id).map((item) => item.id),
)

const activeAgent = computed(() => {
  const agentId = meta.value?.agentId
  if (agentId) return agents.value.find((item) => item.id === agentId) || null
  return null
})

/**
 * 会话对应的智能体：打开历史会话时还没有 meta 帧，光靠 meta 会解析不出身份，
 * 顶栏就只剩「对话」两个字。因此回落到会话记录上的 agentDefId 去匹配智能体。
 */
const conversationAgent = computed(() => {
  const conversation = conversations.value.find((item) => item.id === conversationId.value)
  if (!conversation?.agentDefId) return null
  return agents.value.find((item) => item.id === conversation.agentDefId) || null
})

/** 顶栏身份：智能体（meta 优先，其次会话记录） */
const headerAgent = computed(() => activeAgent.value || conversationAgent.value)
/**
 * 标题 = 智能体身份；模型名单独放在右侧标签里。
 * 为什么不让模型当标题：流式开始后 meta 带回模型名，标题会从「需求分析与开题工程师」
 * 突变成「deepseek-chat」，同时右侧标签也是同一个词——既跳变又重复。身份稳定，模型是元信息。
 */
const headTitle = computed(() => headerAgent.value?.name || (conversationId.value ? '对话' : '新建对话'))

/** 织流会话（= 主对话）的输入框文案（方案 §3.4：用户只说需求）；接管态下直接和当前成员说话 */
const composerPlaceholder = computed(() => {
  if (!isWeaveflowConversation.value) return '输入消息，Enter 发送；支持 Markdown 与代码块'
  if (activeDispatch.takeover) {
    const who = currentSpeakerName(activeDispatch) || '当前成员'
    return `已接管：这句话直接发给 ${who}，不再走阶段派发`
  }
  return '说说你想做什么，或用 @③ 召唤某位成员插话'
})

/** 空状态文案：织流会话（可派发）与会话索引/普通会话不是一回事，分开写 */
const emptyTitle = computed(() => (isWeaveflowConversation.value ? '说说你想做什么' : '开始你的第一轮对话'))
const emptyDescription = computed(() => {
  if (!isWeaveflowConversation.value) return '支持 Markdown 与代码块高亮；Enter 发送，Shift + Enter 换行。'
  return mockDispatch
    ? '直接说你想做什么。平台会先判定意图：能派发就派给对应团队（演示通道驱动「识别 → 派发 → 阶段推进」），不能派发就由「织流」直接回答。'
    : '直接说你想做什么，织流会直接回答你。'
})

/* ==================== 单一真源派生（面板 / 卡片 / 发言人条） ==================== */

/** 面板是否有调度内容可展示（未派发时走示例芯片态） */
const hasDispatch = computed(() => isDispatched(activeDispatch))
/** 进度条文字：与派发卡片同一份 stageNo/stageCount（面板里的进度条自己按同一份状态算填充比） */
const dispatchProgressLabel = computed(() => progressLabel(activeDispatch))
/** 当前发言人名字（面板高亮 / 窄屏轻量条共用） */
const dispatchSpeaker = computed(() => currentSpeakerName(activeDispatch))
/** 窄屏轻量条：团队名 + 1/5 + 当前发言人 */
const dispatchTeamName = computed(() => activeDispatch.teamName || '')

/** 产出抽屉：该成员的产出全文 + 契约校验结果 */
const drawerArtifact = computed(() => {
  const member = drawerMember.value
  if (!member) return null
  const key = member.agentId || member.name
  return activeDispatch.artifacts[key] || null
})
const drawerContract = computed(() => {
  const contract = drawerArtifact.value?.contract
  if (!contract) return null
  const details = normalizeContractDetails(contract)
  return { ...details, hasIssues: hasContractIssues(details) }
})
const drawerTitle = computed(() => (drawerMember.value ? `阶段产出 · ${drawerMember.value.name}` : '阶段产出'))
const drawerStageText = computed(() => {
  const member = drawerMember.value
  if (!member) return ''
  const total = activeDispatch.stageCount
  const no = Number(member.stageNo)
  if (!Number.isFinite(no)) return ''
  return total ? `阶段 ${no + 1}/${total}` : `阶段 ${no + 1}`
})

/* ============================ 数据加载 ============================ */

async function loadConversations() {
  if (!userStore.loggedIn) return
  try {
    conversations.value = await conversationApi.list()
  } catch (error) {
    logApiError(error, 'chat')
    toast.error(toFriendlyError(error))
  }
}

async function loadAgents() {
  if (!userStore.loggedIn) return
  try {
    agents.value = await agentApi.list()
  } catch (error) {
    logApiError(error, 'chat')
    toast.error(toFriendlyError(error))
  }
}

/**
 * 消息判重键（batch 6c）：
 *   1. 有 id 就用 id —— 服务端消息一定有真 id，本地演示消息用 `dispatch-N` / `demo-*`
 *      这类**服务端不可能生成**的 id，两者永不撞车；同 id 即同一条消息。
 *   2. 没有 id 时才退回 `role + createdAt`：本地流式占位用的是固定 id `streaming`，
 *      万一将来去掉，时间戳仍是可用的第二判据。
 */
function messageKey(message) {
  const id = String(message?.id || '')
  if (id) return `id:${id}`
  const at = String(message?.createdAt || '')
  return at ? `at:${message?.role || ''}:${at}` : ''
}

/** 消息时间戳（毫秒）；缺失 / 非法返回 null（调用方据此放弃排序，而不是把消息排到 1970） */
function messageTime(message) {
  const time = Date.parse(String(message?.createdAt || ''))
  return Number.isNaN(time) ? null : time
}

/**
 * ★ 合并「服务端真值」与「本地演示内容」（batch 6c 问题②）
 * ------------------------------------------------------------------
 * 背景（实测）：fallback 真实发送收尾时会 `loadMessages()` 从服务端整表刷新，
 *   而演示派发卡片 / 演示产出**是纯前端本地的、服务端根本没有**，
 *   整表覆盖会把它们连同位置一起抹掉（实测 3 张派发卡片 → 0）。
 *
 * 规则（服务端永远优先）：
 *   1. 只有带 `localOnly` 标记的消息是「只存在于本浏览器」的（演示派发卡片、
 *      演示通道的提问与回答），它们必须留下；
 *   2. **其余本地消息一律丢弃**：真实发送推入的用户消息与流式占位服务端都有对应的
 *      真值，留下就会「同一条回答出现两遍」——这就是不用 role+时间做粗判的原因，
 *      最干净的判重是**来源**：网络发出去的走服务端真值，没发出去的才留本地；
 *   3. 判重第二道闸 = `messageKey()`（id 优先，退化到 role + createdAt）：
 *      服务端消息先全部登记，本地同 key 的副本直接丢弃，**服务端真值不可能被本地顶掉**；
 *   4. 顺序：两端都有 createdAt 时按时间归位（稳定排序，同一时刻保持原相对顺序），
 *      演示内容因此留在它们原本的时间位置；只要有任一消息缺时间就**不排序**，
 *      退回「服务端顺序 + 本地追加」——宁可不排，也不拿可疑时间乱排。
 */
function mergeServerMessages(server) {
  const list = Array.isArray(server) ? server : []
  const seen = new Set()
  for (const item of list) {
    const key = messageKey(item)
    if (key) seen.add(key)
  }

  const kept = []
  for (const item of messages.value) {
    if (!item?.localOnly) continue
    const key = messageKey(item)
    if (key && seen.has(key)) continue
    if (key) seen.add(key)
    kept.push(item)
  }
  if (!kept.length) return list

  const merged = [...list, ...kept]
  const times = merged.map(messageTime)
  if (times.includes(null)) return merged
  return merged
    .map((item, index) => ({ item, index, time: times[index] }))
    .sort((a, b) => a.time - b.time || a.index - b.index)
    .map((entry) => entry.item)
}

/**
 * @param {string} id 会话 id
 * @param {{ mergeLocal?: boolean }} [options]
 *   mergeLocal=true：刷新后保留本地演示内容（**只用于真实发送收尾的那次刷新**）；
 *   切换会话时必须走默认的整表覆盖，否则上一条会话的演示卡片会串台。
 */
async function loadMessages(id, { mergeLocal = false } = {}) {
  if (!id) {
    messages.value = []
    return
  }
  loadingMessages.value = true
  try {
    const list = await conversationApi.messages(id)
    messages.value = mergeLocal ? mergeServerMessages(list) : list
    await nextTick()
    scrollToBottom(true)
  } catch (error) {
    logApiError(error, 'chat')
    toast.error(toFriendlyError(error))
  } finally {
    loadingMessages.value = false
  }
}

/**
 * 首屏数据只拉一次：watcher 与「默认会话解析」共用同一个 Promise，
 * 否则进 /chat 会并发发两份 /conversations 与 /agents。
 * 退出登录时清掉，保证下次登录重新拉（列表不能跨账号残留）。
 */
let bootPromise = null
function bootChat() {
  if (!bootPromise) bootPromise = Promise.all([loadConversations(), loadAgents()])
  return bootPromise
}

watch(
  () => userStore.loggedIn,
  (loggedIn) => {
    if (loggedIn) {
      bootChat()
    } else {
      bootPromise = null
    }
  },
  { immediate: true },
)

/**
 * 找到 / 新建与「织流」的真实会话。
 * 这是 batch 5 的查找逻辑：/chat（无 id）的默认落点走它（openDefaultConversation）。
 * 调用前必须已 bootChat()（否则 agent 列表 / 会话列表还没到）。
 * 找不到「织流」时返回 null，由调用方决定怎么提示。
 */
async function resolveAssistantConversation() {
  const assistant = defaultAssistant.value
  if (!assistant) return null
  const latest = conversations.value
    .filter((item) => item.agentDefId === assistant.id)
    .sort((a, b) => timeOf(b) - timeOf(a))[0]
  if (latest) return latest
  const created = await conversationApi.create({ agentDefId: assistant.id, title: assistant.name })
  conversations.value = [created, ...conversations.value]
  return created
}

/**
 * /chat（无 :conversationId）默认打开与「织流」的会话：
 *   1. 会话列表里找**最近一条**属于它的（按时间倒序取第一条）→ router.replace 过去；
 *   2. 没有 → 新建一条（POST /api/conversations，agentDefId = 织流）→ replace 过去；
 *   3. 找不到「织流」或创建失败（未登录 / 后端报错）→ **不卡死**，
 *      落回「选择智能体」页（resolvingDefault 置回 false 即显示该页）并给出提示。
 * `?pick=1` 一律不自动跳转——那是「新建对话」要去的选择页。
 * replace 而非 push：/chat 这一跳不该在浏览器历史里留一条回不去的记录。
 */
async function openDefaultConversation() {
  if (!userStore.loggedIn || conversationId.value || pickMode.value || resolvingDefault.value) return
  resolvingDefault.value = true
  try {
    await bootChat()
    // 解析期间用户可能已经自己点了别的会话或「新建对话」——以用户的操作优先
    if (conversationId.value || pickMode.value) return

    if (!defaultAssistant.value) {
      toast.error('未找到「织流」智能体，请从下方列表选择')
      return
    }

    const conversation = await resolveAssistantConversation()
    if (!conversation?.id) return
    if (conversationId.value || pickMode.value) return
    router.replace(`/chat/${conversation.id}`)
  } catch (error) {
    logApiError(error, 'chat')
    toast.error(toFriendlyError(error))
  } finally {
    resolvingDefault.value = false
  }
}

watch(
  () => [userStore.loggedIn, conversationId.value, pickMode.value],
  () => {
    openDefaultConversation()
  },
  { immediate: true },
)

/** 切换会话 / 新建对话：停掉可能还在跑的演示驱动，清掉本会话的临时流式状态 */
function resetDemo() {
  if (demo) {
    demo.abort()
    demo = null
  }
  demoRunning = false
  if (streamTarget) {
    streamTarget.streaming = false
    streamTarget = null
  }
  streaming.value = false
}

watch(
  conversationId,
  (id) => {
    resetDemo()
    meta.value = null
    streamError.value = ''
    uploads.value = []
    dispatchAgent.value = ''
    dispatchAgentId.value = ''
    drawerOpen.value = false
    drawerMember.value = null
    // 换会话即清空「当前调度」：单一真源不能被上一条会话的派发状态污染
    resetActiveDispatch(activeDispatch)
    // 织流会话也会落库（是真实会话），消息一律从服务端取；
    // 演示模块按需加载（动态 import → 独立 chunk），让首次派发的判定不额外等待。
    loadMessages(id)
    if (isWeaveflowConversation.value && mockDispatch) loadDispatchDemo()
  },
  { immediate: true },
)

/* ============================== 滚动 ============================== */

const listRef = ref(null)
/** 用户是否仍贴在底部（手动上翻时不打扰） */
const stick = ref(true)

function scrollToBottom(force = false) {
  const el = listRef.value
  if (!el || (!force && !stick.value)) return
  el.scrollTop = el.scrollHeight
}

function scheduleScroll() {
  if (raf) return
  raf = requestAnimationFrame(() => {
    raf = 0
    scrollToBottom()
  })
}

function onScroll() {
  const el = listRef.value
  if (!el) return
  stick.value = el.scrollHeight - el.scrollTop - el.clientHeight < 48
}

/* ============================== 流式 ============================== */

/** meta / error / dispatch 事件 */
function handleEvent(event) {
  if (event.event === 'meta') {
    try {
      meta.value = JSON.parse(event.data)
    } catch {
      meta.value = null
    }
    return
  }
  if (event.event === 'dispatch') {
    handleDispatch(event)
    return
  }
  if (event.event === 'error') {
    const message = '生成失败，请稍后重试'
    try {
      const payload = JSON.parse(event.data)
      if (payload?.message) console.warn('[chat] upstream:', payload.message)
    } catch {
      // 非 JSON 的错误帧按通用文案处理
    }
    streamError.value = message
  }
}

/**
 * dispatch 事件（新增事件，**不动 meta / data / error**）。
 * data 契约（前后端唯一约定，一字不改）见 docs/主对话意图派发方案-v1.md §3.5：
 *   { kind, intent, teamId, teamName, agentId, agentName, stageNo, stageCount, reason, candidates }
 * 解析失败只丢弃该帧，不打断整轮对话。
 */
function handleDispatch(event) {
  let payload
  try {
    payload = JSON.parse(event.data)
  } catch {
    // 一条脏帧不该把整轮对话打掉
    return
  }
  if (!payload || typeof payload !== 'object' || !payload.kind) return
  // ★ 单一真源唯一的写入点：面板 / 卡片 / 发言人条都从 activeDispatch 派生
  applyDispatchFrame(activeDispatch, payload)
  if (payload.agentName) {
    dispatchAgent.value = payload.agentName
    dispatchAgentId.value = payload.agentId || ''
    // 真实链路里 routed 帧可能晚于占位消息创建：把来源补到正在流式的那条上
    if (streamTarget) {
      streamTarget.agentName = payload.agentName
      streamTarget.agentId = payload.agentId || ''
    }
  }
  pushDispatchMessage(payload)
}

/** 派发卡片在消息流里的位置：routed / stage-start 在正文之前，stage-done 在正文之后 */
function pushDispatchMessage(payload) {
  const item = {
    id: `dispatch-${++dispatchSeq}`,
    role: 'dispatch',
    dispatch: payload,
    attachments: [],
    tokensIn: 0,
    tokensOut: 0,
    createdAt: new Date().toISOString(),
    // 演示派发卡片只存在于本浏览器（服务端没有这条消息），刷新消息时必须保留
    localOnly: true,
  }
  const at = streamTarget ? messages.value.indexOf(streamTarget) : -1
  if (payload.kind === 'stage-done' || at < 0) messages.value.push(item)
  else messages.value.splice(at, 0, item)
  nextTick(() => scrollToBottom())
}

/** 上游 OpenAI chunk：只取增量正文与 usage */
function handleDelta(raw) {
  if (!streamTarget || typeof raw !== 'string' || raw[0] !== '{') return
  let chunk = null
  try {
    chunk = JSON.parse(raw)
  } catch {
    return
  }

  const delta = chunk?.choices?.[0]?.delta?.content
  if (typeof delta === 'string' && delta) {
    streamTarget.content += delta
    scheduleScroll()
  }
  if (chunk?.usage) {
    streamTarget.tokensIn = chunk.usage.prompt_tokens ?? streamTarget.tokensIn
    streamTarget.tokensOut = chunk.usage.completion_tokens ?? streamTarget.tokensOut
  }
}

async function send() {
  const content = input.value.trim()
  if (!content || streaming.value) return
  const id = conversationId.value
  if (!id) return
  if (!requireLogin('发送消息')) return

  // ★ 织流会话 = 主对话（batch 6b 合并）：先做意图判定——
  //   被 route / confirm 接管就地返回；判定为 fallback 则继续往下，按普通消息真实发给织流。
  if (isWeaveflowConversation.value) {
    if (await handleWeaveflowSend(content)) return
    // fallback：若上一轮演示正处在「帧与帧之间」的空档里，先把它停掉，
    // 否则它的阶段帧会插到这次真实回答的前面（沿用 batch 4 的防护行为）。
    stopDemo()
  }

  const attachmentIds = readyAttachmentIds.value
  messages.value.push({
    id: `local-${Date.now()}`,
    role: 'user',
    content,
    attachments: attachmentIds,
    tokensIn: 0,
    tokensOut: 0,
    createdAt: new Date().toISOString(),
  })
  input.value = ''
  uploads.value = []
  streamError.value = ''

  const placeholder = reactive({
    id: 'streaming',
    role: 'assistant',
    content: '',
    attachments: [],
    tokensIn: 0,
    tokensOut: 0,
    createdAt: new Date().toISOString(),
    streaming: true,
  })
  messages.value.push(placeholder)
  streamTarget = placeholder
  streaming.value = true
  stick.value = true
  await nextTick()
  scrollToBottom(true)

  handle = createSSEStream(`/conversations/${id}/stream`, {
    data: { content, attachmentIds },
    onEvent: handleEvent,
    onDelta: handleDelta,
    onError: (error) => {
      streamError.value = toFriendlyError(error)
      logApiError(error, 'chat')
    },
  })

  const result = await handle.done

  placeholder.streaming = false
  streaming.value = false
  streamTarget = null
  handle = null

  if (result?.aborted) {
    // 中断后不再从服务端覆盖：本地已持有正确的部分内容，覆盖会丢掉「已中断」标记
    placeholder.id = `local-${Date.now()}`
    placeholder.interrupted = true
    placeholder.content += placeholder.content ? '\n\n_（已中断）_' : '_（已中断）_'
    return
  }

  if (streamError.value) {
    toast.error(streamError.value)
    if (!placeholder.content) {
      messages.value = messages.value.filter((item) => item !== placeholder)
    }
  }
  // 同步服务端最终消息（真实 id、token 用量）。
  // ★ mergeLocal：这次刷新只针对「真实发送」，本地演示内容（派发卡片 / 演示产出）
  //   服务端没有、必须保留；反过来服务端真值优先，本地旧副本不会被留下（见 mergeServerMessages）。
  loadMessages(id, { mergeLocal: true })
}

function abort() {
  // 真实流优先：演示驱动不会占用 handle，
  // 反过来「先看 demo」会把正在跑的真实流误当成演示流而不去中断它。
  if (handle) {
    handle.abort()
    return
  }
  if (demo) {
    // 演示驱动被中断后不会再回调 onTurnDone，这里手动收尾，避免「生成中」卡死
    demo.abort()
    finishDemoTurn()
  }
}

/* ---------------------- 消息级操作（P0-2） ---------------------- */

/** 复制消息原文（Markdown 源码）。剪贴板不可用时静默降级，不让复制按钮炸掉。 */
async function copyMessage(message) {
  const text = String(message.content ?? '')
  if (!text) return
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    }
    toast.success('已复制消息')
  } catch {
    toast.error('复制失败，请手动选中复制')
  }
}

/** 重新生成：重发这条 assistant 之前最近的一条 user 消息（复用 send() 全链路）。 */
async function regenerate(message) {
  if (streaming.value) return
  const index = messages.value.indexOf(message)
  const prior = [...messages.value.slice(0, index)].reverse().find((item) => item.role === 'user')
  if (!prior) return
  input.value = prior.content
  await send()
}

/** 删除单条（本地）。服务端删除需后端接口（FE-B，见清单），当前仅本会话内移除。 */
function removeMessage(message) {
  messages.value = messages.value.filter((item) => item !== message)
}

/* ====================== 织流会话 · 意图派发（演示通道） ====================== */

/**
 * 演示模块按需**动态 import**（不是静态 import）：
 * 只有 MOCK_DISPATCH_ENABLED 为真时才会真正加载，Vite 因此把它拆成独立 chunk，
 * 演示关键词与假产出不会被打进 Chat-*.js。
 */
async function loadDispatchDemo() {
  if (!mockDispatch) return null
  if (!demoModule) {
    try {
      demoModule = await import('@/lib/dispatchDemo')
      demoExamples.value = [...(demoModule.DEMO_INTENT_EXAMPLES || [])]
    } catch (error) {
      logApiError(error, 'chat')
      toast.error('演示脚本加载失败')
      return null
    }
  }
  return demoModule
}

/** 建立一个演示驱动（回调入口与真实 SSE 完全同形，后端接上后前端零改动） */
function ensureDemo(mod) {
  if (demo) return demo
  demo = mod.createDispatchDemo({
    onEvent: handleEvent,
    onDelta: handleDelta,
    onTurnStart: startDemoTurnTarget,
    onTurnDone: finishDemoTurn,
    onArtifact: (artifact) => setArtifact(activeDispatch, artifact?.agentId, artifact),
  })
  return demo
}

/** 落一条用户消息并清空输入区（派发 / @ 召唤 / 接管三条路共用） */
function pushUserMessage(content) {
  messages.value.push({
    id: `local-${Date.now()}`,
    role: 'user',
    content,
    attachments: readyAttachmentIds.value,
    tokensIn: 0,
    tokensOut: 0,
    createdAt: new Date().toISOString(),
    // 演示通道的提问**不发网络请求**、服务端没有这条消息：刷新消息时必须保留，
    // 否则回看会话会变成「只有回答、没有提问」。真实发送推入的用户消息没有这个标记
    // （服务端会返回它的真值），从而被整表刷新正确地替换掉、不会出现两遍。
    localOnly: true,
  })
  input.value = ''
  uploads.value = []
  streamError.value = ''
  stick.value = true
  nextTick(() => scrollToBottom(true))
}

/**
 * ★ 织流会话发送分流（batch 6b 合并；取代原「主对话」的 sendMaster）。
 * 优先级：`@ 召唤` > 接管直聊 > 意图判定。
 * 为什么这么排：用户显式点名与已接管是最强的意图，此时**不推进阶段、也不做意图判定**。
 *
 * 返回 true 表示这句话已被本函数接管（不再走普通发送）；
 * 返回 false 表示判定为 fallback —— 由调用方按**普通消息**真实发给织流。
 */
async function handleWeaveflowSend(content) {
  const mention = parseMention(content, activeDispatch.members)
  if (mention) {
    summonMember(content, mention.member, mention.text)
    return true
  }
  if (activeDispatch.takeover) {
    const member =
      memberOf(activeDispatch, { agentId: activeDispatch.currentAgentId, name: activeDispatch.currentAgentName }) ||
      activeDispatch.members[0]
    if (!member) {
      toast.warning('还没有可对话的成员：先派发一次，或用 @③ 点名一位成员。')
      return true
    }
    summonMember(content, member, content)
    return true
  }
  const intent = await classifyForDispatch(content)
  if (intent === 'fallback') return false
  // 计划卡（EvoFlow §E1）：先展示可确认计划，用户确认后才真正启动驱动
  const mod = await loadDispatchDemo()
  const stages = (mod?.DEMO_STAGES || []).map((stage) => ({ agentName: stage.agentName }))
  pushUserMessage(content)
  pendingPlan.value = { content, stages }
  return true
}

/**
 * 意图判定（三态 route / confirm / fallback）。
 * **复用 lib/dispatchDemo.js 的 classifyIntent()，判定逻辑不重写**。
 * 开关关闭 / 演示模块加载失败时一律按 fallback 处理 —— 织流本来就是真实智能体，
 * 没有派发通道时「直接回答」永远是可用的正确行为。
 */
async function classifyForDispatch(content) {
  if (!mockDispatch) return 'fallback'
  const mod = await loadDispatchDemo()
  if (!mod || typeof mod.classifyIntent !== 'function') return 'fallback'
  return mod.classifyIntent(content)
}

/**
 * 喊停还在跑的这一轮演示，并把可能的流式占位收尾。
 * 只在「帧与帧之间的空档」（streaming 已回 false、但驱动还没结束）里有意义；
 * 正在跑的真实流不属于演示，绝不能被它碰到。
 */
function stopDemo() {
  if (!demo && !demoRunning) return
  demo?.abort()
  demo = null
  demoRunning = false
  finishDemoTurn()
}

/** 真正启动演示驱动（不含落用户消息）。计划卡确认后与 @ 召唤等旧路径共用。 */
async function runDispatch(content) {
  dispatchAgent.value = ''
  dispatchAgentId.value = ''
  const mod = await loadDispatchDemo()
  if (!mod) return
  // 新一次派发：清空上一条链路，用演示花名册铺底（面板与 @ 解析共用这一份名字）
  stopDemo()
  resetActiveDispatch(activeDispatch)
  seedMembers(activeDispatch, mod.DEMO_ROSTER)
  // `start()` 在「一轮阶段跑完」时 resolve（awaiting-confirm 态则不忙），
  // 用这个窗口判断演示驱动此刻是否真的在跑（见 stopDemo 的空档说明）。
  demoRunning = true
  const run = ensureDemo(mod).start(content)
  Promise.resolve(run).finally(() => {
    demoRunning = false
  })
}

/* ---------------------- 计划卡（EvoFlow §E1） ---------------------- */

/** 待确认的计划：{ content, stages: [{ agentName }] }；确认前不启动驱动 */
const pendingPlan = ref(null)

async function confirmPlan() {
  const plan = pendingPlan.value
  if (!plan) return
  pendingPlan.value = null
  await runDispatch(plan.content)
}

function cancelPlan() {
  pendingPlan.value = null
}

/**
 * `@ 召唤` / 接管直聊：该成员作为**普通消息**回答，**不推进阶段**
 * （演示驱动在这里不 emit 任何 dispatch 帧，activeDispatch 原样不动）。
 */
async function summonMember(content, member, text) {
  pushUserMessage(content)
  dispatchAgent.value = member?.name || ''
  dispatchAgentId.value = member?.agentId || ''
  const mod = await loadDispatchDemo()
  if (!mod || !member) return
  ensureDemo(mod).summon(member, text || content)
}

/** 演示：一轮正文开始——新建流式占位消息，发言人条取最近一次派发/召唤的成员 */
function startDemoTurnTarget() {
  const placeholder = reactive({
    id: `demo-${Date.now()}`,
    role: 'assistant',
    content: '',
    agentName: dispatchAgent.value,
    agentId: dispatchAgentId.value,
    attachments: [],
    tokensIn: 0,
    tokensOut: 0,
    createdAt: new Date().toISOString(),
    streaming: true,
    // 演示驱动流出来的正文（服务端没有），刷新消息时保留
    localOnly: true,
  })
  messages.value.push(placeholder)
  streamTarget = placeholder
  streaming.value = true
  nextTick(() => scrollToBottom(true))
}

/** 演示：一轮正文结束——只摘掉流式标记；驱动还在等「确认并进入下一阶段」 */
function finishDemoTurn() {
  if (streamTarget) streamTarget.streaming = false
  streaming.value = false
  streamTarget = null
}

/** 「确认并进入下一阶段」：单阶段派发的人工确认闸口（方案 §3.3 模式 1） */
function confirmStage(payload) {
  if (activeDispatch.paused) {
    // 暂停的语义就是「不再推进阶段」，这里必须拦下，否则按钮形同虚设
    toast.warning('调度已暂停，先点「继续调度」再确认。')
    return
  }
  if (!payload || payload.confirmed) return
  payload.confirmed = true
  if (demo) {
    demo.confirm()
    return
  }
  toast.error('后端派发接口尚未实现（方案 §五 待办 4）。')
}

/** 低置信度候选：「是」＝接受置信度最高的候选 */
function chooseCandidate(payload, candidate) {
  if (!payload || payload.resolved) return
  payload.resolved = 'yes'
  if (demo) {
    demo.choose(candidate)
    return
  }
  toast.error('后端派发接口尚未实现（方案 §五 待办 4）。')
}

/** 低置信度候选：「不是」＝请用户补充说明，不派发 */
function rejectCandidate(payload) {
  if (!payload || payload.resolved) return
  payload.resolved = 'no'
  if (demo) {
    demo.reject()
    return
  }
  toast.error('后端派发接口尚未实现（方案 §五 待办 4）。')
}

/* ---------------------- 「当前调度」面板 / 产出抽屉 / 控制权 ---------------------- */

/** 点侧栏成员 → 打开产出抽屉（产出全文 + 契约校验结果） */
function openMemberDrawer(member) {
  if (!member) return
  drawerMember.value = member
  drawerOpen.value = true
}

/** 抽屉里「让它补充说明」= 在主对话里 @ 它（等价用户手打 @ 召唤） */
function askSupplement() {
  const member = drawerMember.value
  if (!member) return
  drawerOpen.value = false
  input.value = `@${member.name} 请把这一阶段的产出补充说明清楚`
  nextTick(() => composerRef.value?.focus())
  toast.success('已在输入框 @ 该成员，直接发送即可')
}

function pauseDispatch() {
  activeDispatch.paused = true
}

function resumeDispatch() {
  activeDispatch.paused = false
}

/** 接管＝直接和当前成员对话（等价旧路径），可随时交还 */
function takeoverDispatch() {
  activeDispatch.paused = false
  activeDispatch.takeover = true
}

function releaseDispatch() {
  activeDispatch.takeover = false
}

/**
 * 示例意图芯片：等价于用户把这句话打进输入框再发送（同一条判定 → 派发路径）。
 * 面板现在只在「已派发」时出现，芯片属未派发态的入口，保留但当前没有渲染时机。
 */
async function dispatchExample(text) {
  if (!requireLogin('派发任务')) return
  if (streaming.value) return
  input.value = text
  await send()
}

/** 助手正文：生成中走流式渲染（末尾空围栏不渲染），结束后走常规渲染 */

/* ============================== 附件 ============================== */

async function onFiles(event) {
  const files = Array.from(event.target.files || [])
  event.target.value = ''
  if (!files.length) return
  if (!requireLogin('上传附件')) return

  for (const file of files) {
    const item = reactive({
      key: `${Date.now()}-${file.name}-${uploads.value.length}`,
      name: file.name,
      size: file.size,
      progress: 0,
      status: 'uploading',
      id: '',
    })
    uploads.value.push(item)
    try {
      const attachment = await uploadAttachment(file, {
        conversationId: conversationId.value,
        onProgress: (ratio) => {
          item.progress = ratio
        },
      })
      item.id = attachment?.id || ''
      item.status = item.id ? 'done' : 'error'
    } catch (error) {
      item.status = 'error'
      logApiError(error, 'upload')
      toast.error(toFriendlyError(error))
    }
  }
}

function removeUpload(item) {
  uploads.value = uploads.value.filter((entry) => entry !== item)
}

/* ============================ 会话操作 ============================ */

async function startWith(agent) {
  if (!requireLogin('发起对话')) return
  try {
    const conversation = await conversationApi.create({ agentDefId: agent.id, title: agent.name })
    conversations.value = [conversation, ...conversations.value]
    router.push(`/chat/${conversation.id}`)
  } catch (error) {
    logApiError(error, 'chat')
    toast.error(toFriendlyError(error))
  }
}

function openConversation(id) {
  router.push(`/chat/${id}`)
}

/**
 * 新建对话：回到会话索引页选智能体。
 * ★ 必须带 `?pick=1`：/chat 不带 query 现在是「自动打开织流」的默认落点，
 *   不带这个开关的话「新建对话」会被默认跳转吃掉，永远回不到选择页。
 */
function newConversation() {
  if (pickMode.value) return
  router.push('/chat?pick=1')
}

/* ---------------------- 会话列表：月份分组 ---------------------- */

/** 会话时间戳；缺字段或非法日期按 0 处理（排到组内末尾），不让脏数据把排序整体打乱 */
function timeOf(item) {
  const time = item?.createdAt ? new Date(item.createdAt).getTime() : 0
  return Number.isNaN(time) ? 0 : time
}

/** 会话侧栏搜索关键词（P0-3，本地过滤） */
const conversationQuery = ref('')

/**
 * 会话按「今天 / 近 7 天 / 更早」分桶 + 标题关键词过滤：
 * 纯逻辑抽到 lib/conversationGroups.js（可单测），这里只做数据绑定。
 */
const conversationGroups = computed(() => groupConversations(conversations.value, conversationQuery.value))

/* ---------------------- 会话行：⋯ 菜单 ---------------------- */

function toggleMenu(id, event) {
  if (menuForId.value === id) {
    closeMenu()
    return
  }
  const rect = event.currentTarget.getBoundingClientRect()
  menuForId.value = id
  menuIndex.value = 0
  menuPos.value = { top: rect.bottom + 4, right: Math.max(8, window.innerWidth - rect.right) }
  nextTick(() => menuRef.value?.focus())
}

function closeMenu() {
  menuForId.value = ''
}

/** 点菜单外任意处关闭（点在其它行的 ⋯ 上时不关，交给它自己的 toggle 处理） */
function onDocPointerDown(event) {
  const target = event.target
  if (target instanceof Element && (target.closest('[data-chat-menu]') || target.closest('[data-chat-more]'))) {
    return
  }
  closeMenu()
}

/**
 * 菜单开着时挂「按下即关」的全局监听。
 * pointerdown 与 mousedown 都挂：只挂 pointerdown 时，不派发指针事件的输入路径
 * （合成事件、个别环境）会点不关；closeMenu() 幂等，重复触发没有副作用。
 */
const OUTSIDE_EVENTS = ['pointerdown', 'mousedown']

function bindOutside(active) {
  for (const type of OUTSIDE_EVENTS) {
    if (active) document.addEventListener(type, onDocPointerDown, true)
    else document.removeEventListener(type, onDocPointerDown, true)
  }
}

function onDocKeydown(event) {
  if (event.key === 'Escape') closeMenu()
}

/** 方向键移动 / Enter 触发：菜单自身持有焦点，故键位处理挂在菜单容器上 */
function onMenuKeydown(event) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    const step = event.key === 'ArrowDown' ? 1 : MENU_ITEMS.length - 1
    menuIndex.value = (menuIndex.value + step) % MENU_ITEMS.length
    return
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    runMenuItem(MENU_ITEMS[menuIndex.value])
    return
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    closeMenu()
  }
}

function runMenuItem(entry) {
  const row = conversations.value.find((item) => item.id === menuForId.value)
  closeMenu()
  if (!row || !entry) return
  if (entry.key === 'rename') startRename(row)
  else if (entry.key === 'delete') askDelete(row)
}

/* ---------------------- 会话行：重命名 ---------------------- */

/** 行内编辑：预填原值 + 自动聚焦 + 全选 */
function startRename(item) {
  renamingId.value = item.id
  renameDraft.value = item.title || ''
  renameSettled = false
  nextTick(() => {
    renameInputRef.value?.focus()
    renameInputRef.value?.select()
  })
}

/** input 在 v-for 内，ref 会收成数组，故用函数式 ref 只留当前这一个 */
function setRenameInput(el) {
  if (el) renameInputRef.value = el
}

function cancelRename() {
  renameSettled = true
  renamingId.value = ''
  renameDraft.value = ''
}

/**
 * 提交改名（Enter 与失焦都走这里）。
 * 空标题与「没改动」不发请求：后端对空标题回 400，本地直接当作取消更合理。
 */
async function submitRename(item) {
  if (renameSettled) return
  renameSettled = true
  const id = item.id
  const next = renameDraft.value.trim()
  const prev = item.title || ''
  renamingId.value = ''
  renameDraft.value = ''
  if (!next || next === prev) return

  conversations.value = conversations.value.map((row) => (row.id === id ? { ...row, title: next } : row))
  try {
    const updated = await conversationApi.rename(id, next)
    if (updated?.title) {
      conversations.value = conversations.value.map((row) => (row.id === id ? { ...row, ...updated } : row))
    }
    toast.success('已重命名')
  } catch (error) {
    conversations.value = conversations.value.map((row) => (row.id === id ? { ...row, title: prev } : row))
    logApiError(error, 'chat')
    toast.error(toFriendlyError(error))
  }
}

/* ---------------------- 会话行：删除 ---------------------- */

function askDelete(item) {
  pendingDelete.value = item
  confirmDelete.value = true
}

/**
 * 删除会话。
 * 409 是「该会话属于流水线的某个阶段」，与 404（他人 / 不存在）要分开提示：
 * 前者不能靠刷新解决，后者需要把列表拉回服务端真值。
 */
async function removeConversation() {
  const item = pendingDelete.value
  if (!item || deleting.value) return
  deleting.value = true
  try {
    await conversationApi.remove(item.id)
    conversations.value = conversations.value.filter((row) => row.id !== item.id)
    // 删的是当前打开的会话 → 回到「新建对话」态
    if (item.id === conversationId.value) router.push('/chat')
    toast.success('已删除会话')
  } catch (error) {
    logApiError(error, 'chat')
    if (error?.status === 409) toast.error('该会话属于流水线的某个阶段，不能删除')
    else if (error?.status === 404) {
      toast.error('会话不存在')
      loadConversations()
    } else toast.error(toFriendlyError(error))
  } finally {
    deleting.value = false
    confirmDelete.value = false
    pendingDelete.value = null
  }
}

watch(menuForId, (id) => {
  if (typeof document === 'undefined') return
  if (!id) {
    bindOutside(false)
    document.removeEventListener('keydown', onDocKeydown, true)
    window.removeEventListener('scroll', closeMenu, true)
    window.removeEventListener('resize', closeMenu)
    return
  }
  bindOutside(true)
  document.addEventListener('keydown', onDocKeydown, true)
  // 菜单是 fixed 定位：列表滚动 / 窗口尺寸变化后坐标不再对应触发器，直接收起
  window.addEventListener('scroll', closeMenu, true)
  window.addEventListener('resize', closeMenu)
})

onBeforeUnmount(() => {
  handle?.abort()
  if (demo) demo.abort()
  if (raf) cancelAnimationFrame(raf)
  stopThinkingClock()
  if (typeof document !== 'undefined') {
    bindOutside(false)
    document.removeEventListener('keydown', onDocKeydown, true)
    window.removeEventListener('scroll', closeMenu, true)
    window.removeEventListener('resize', closeMenu)
  }
})
</script>

<template>
  <div class="chat">
    <!-- ------------------------------ 会话栏 ------------------------------ -->
    <ChatRail
      :conversations="conversations"
      :conversation-groups="conversationGroups"
      :conversation-id="conversationId"
      :renaming-id="renamingId"
      :rename-draft="renameDraft"
      :menu-for-id="menuForId"
      :logged-in="userStore.loggedIn"
      :agents="agents"
      v-model:conversation-query="conversationQuery"
      :has-dispatch="hasDispatch"
      :active-dispatch="activeDispatch"
      :demo-examples="demoExamples"
      :panel-collapsed="panelCollapsed"
      :mock-dispatch="mockDispatch"
      @new="newConversation"
      @open="openConversation"
      @rename-input-ref="setRenameInput"
      @rename-submit="submitRename"
      @rename-cancel="cancelRename"
      @update:rename-draft="renameDraft = $event"
      @toggle-menu="toggleMenu"
      @update:panel-collapsed="panelCollapsed = $event"
      @open-member-drawer="openMemberDrawer"
      @pause="pauseDispatch"
      @resume="resumeDispatch"
      @takeover="takeoverDispatch"
      @release="releaseDispatch"
      @intent="dispatchExample"
    />

    <!-- ------------------------------ 主区域 ------------------------------ -->
    <section class="chat__main">
      <header class="chat__head">
        <Avatar v-if="headerAgent" :src="agentAvatar(headerAgent)" :name="headerAgent.name" size="sm" shape="square" />
        <div class="chat__head-main">
          <h1 class="chat__title">{{ headTitle }}</h1>
          <span v-if="conversationId" class="chat__head-sub ui-mono"> #{{ shortId(conversationId) }} </span>
        </div>

        <span v-if="meta?.model" class="chat__pill ui-mono">{{ meta.model }}</span>
        <span v-if="meta?.knowledge" class="chat__kn ui-mono">
          知识 {{ meta.knowledge.docs }} 篇 · {{ formatBytes(meta.knowledge.injectedChars) }}
          <template v-if="meta.knowledge.truncated">（已截断）</template>
        </span>

        <div class="chat__head-spacer" />
        <span class="chat__state" :class="{ 'is-live': streaming }">
          <i class="chat__state-dot" aria-hidden="true" />
          {{ streaming ? '生成中' : '空闲' }}
        </span>
      </header>

      <!-- 未登录 -->
      <Empty
        v-if="!userStore.loggedIn"
        glyph="◉"
        icon="chat"
        title="登录后开始对话"
        description="登录后即可创建会话、上传附件，并与智能体流式对话。"
      >
        <Button type="primary" @click="requireLogin('使用对话')">登录</Button>
      </Empty>

      <!-- 未选择会话：/chat 无 query 时自动打开「织流」会话（解析中显示占位，
           不先闪一下选择页）；/chat?pick=1 才是「选择智能体」页（只列智能体卡片）。 -->
      <template v-else-if="!conversationId">
        <div v-if="resolvingDefault && !pickMode" class="chat__boot ui-scroll">
          <p class="chat__hint">正在打开「织流」…</p>
        </div>

        <div v-else class="chat__picker ui-scroll">
          <div class="chat__picker-inner">
            <Empty
              v-if="!agents.length"
              icon="agents"
              title="还没有可对话的智能体"
              description="先到「智能体配置」创建一个智能体，再回到这里发起对话。"
            >
              <Button type="primary" @click="router.push('/agents')">去创建</Button>
            </Empty>

            <template v-else>
              <p class="chat__picker-tip">选择一个智能体开始新会话</p>
              <div class="chat__picker-grid">
                <button
                  v-for="agent in agents"
                  :key="agent.id"
                  class="chat__picker-card"
                  type="button"
                  @click="startWith(agent)"
                >
                  <Avatar :src="agentAvatar(agent)" :name="agent.name" size="sm" shape="square" />
                  <span class="chat__picker-name">{{ agent.name }}</span>
                  <span class="chat__picker-stage">
                    {{ agent.isPlatform ? '平台公共 · ' : '' }}阶段 {{ agent.stageNo ?? '—' }}
                  </span>
                </button>
              </div>
            </template>
          </div>
        </div>
      </template>

      <!-- 会话主体 -->
      <template v-else>
        <!-- 演示通道标注：钉在消息流上方，滚动也带不走。
             只在**本会话已有派发状态**时出现——派发卡片/阶段产出是演示数据，
             织流自己的回答不是，不能把整条会话打成「演示」。 -->
        <p v-if="hasDispatch && mockDispatch" class="chat__demo-banner">
          <Badge tone="warn" dot>演示数据</Badge>
          <span>派发通道（VITE_MOCK_DISPATCH）：派发卡片与阶段产出均来自内置演示脚本，不是真实智能体产出。</span>
        </p>

        <!-- 窄屏兜底（方案 §3.6）：**侧栏面板被折叠/隐藏**时，在消息流顶栏下方补一条同源的轻量条。
             ⚠️ 触发条件用的是"面板被折叠"，**不是宽度断点**：1180px 断点只是把会话栏收窄到 216px，
             面板本身仍然可见——若按宽度显示，同一份信息会同时出现两遍（面板 + 轻量条）。
             （若将来会话栏在某宽度被真正隐藏，需要把该条件一并加进来。） -->
        <p v-if="hasDispatch && panelCollapsed" class="chat__mini">
          <span class="chat__mini-team">{{ dispatchTeamName }}</span>
          <span class="chat__mini-count ui-mono">{{ dispatchProgressLabel }}</span>
          <span class="chat__mini-speaker">当前：{{ dispatchSpeaker || '—' }}</span>
        </p>

        <div ref="listRef" class="chat__list ui-scroll" @scroll.passive="onScroll">
          <div class="chat__thread">
            <p v-if="loadingMessages && !messages.length" class="chat__hint">加载消息…</p>
            <Empty
              v-if="!messages.length && !loadingMessages"
              icon="chat"
              :title="emptyTitle"
              :description="emptyDescription"
            />

            <ChatMessageList
              :messages="messages"
              :agents="agents"
              :header-agent="headerAgent"
              :active-dispatch="activeDispatch"
              :thinking-seconds="thinkingSeconds"
              :thinking-gif="thinkingGif"
              @copy="copyMessage"
              @regenerate="regenerate"
              @remove="removeMessage"
              @confirm="confirmStage"
              @choose="chooseCandidate"
              @reject="rejectCandidate"
            />
          </div>
        </div>

        <!-- ---------------------------- 输入区 ---------------------------- -->
        <!-- 计划卡（EvoFlow §E1）：派发识别后先展示可确认计划，确认才真正启动 -->
        <div v-if="pendingPlan" class="chat__plan">
          <PlanCard
            :content="pendingPlan.content"
            :stages="pendingPlan.stages"
            @confirm="confirmPlan"
            @cancel="cancelPlan"
          />
        </div>

        <ChatComposer
          ref="composerRef"
          v-model="input"
          :streaming="streaming"
          :placeholder="composerPlaceholder"
          :uploads="uploads"
          @send="send"
          @abort="abort"
          @upload="onFiles"
          @remove-upload="removeUpload"
        />
      </template>
    </section>

    <!-- ---------------------------- 产出抽屉（点侧栏成员打开） ---------------------------- -->
    <!-- 点成员 → 该阶段产出全文 + 契约校验结果（方案 §3.6 / §3.8 决策 3） -->
    <Drawer v-model="drawerOpen" :title="drawerTitle" size="420px">
      <div v-if="drawerMember" class="artifact">
        <div class="artifact__meta">
          <Badge v-if="drawerStageText" tone="info">{{ drawerStageText }}</Badge>
          <Badge :tone="statusTone(drawerMember.status)">{{ statusText(drawerMember.status) }}</Badge>
          <Badge v-if="mockDispatch" tone="warn" dot>演示数据</Badge>
        </div>

        <div v-if="drawerArtifact?.content" class="md-body" v-html="renderMarkdown(drawerArtifact.content)" />
        <p v-else class="artifact__none">该阶段还没有产出。等到本阶段产出生成后，这里会显示全文。</p>

        <section class="artifact__contract">
          <h4 class="artifact__contract-title">契约校验</h4>
          <template v-if="drawerContract">
            <Badge :tone="drawerContract.ok ? 'success' : 'danger'">
              {{ drawerContract.ok ? '通过' : '未通过' }}
            </Badge>
            <ul v-if="drawerContract.missing.length" class="artifact__missing">
              <li v-for="field in drawerContract.missing" :key="field">
                缺失字段：<span class="ui-mono">{{ field }}</span>
              </li>
            </ul>
            <ul v-if="drawerContract.extra.length" class="artifact__missing">
              <li v-for="field in drawerContract.extra" :key="field">
                多余字段：<span class="ui-mono">{{ field }}</span>
              </li>
            </ul>
            <!-- 重试预算只在校验未通过时才有意义，通过时不显示（否则「已用尽」会误导） -->
            <p v-if="!drawerContract.ok" class="artifact__hint">{{ retryHint(drawerContract) }}</p>
          </template>
          <Badge v-else tone="neutral">尚未提交校验</Badge>
        </section>
      </div>

      <template #footer>
        <Button type="ghost" @click="drawerOpen = false">关闭</Button>
        <Button type="primary" @click="askSupplement">让它补充说明</Button>
      </template>
    </Drawer>

    <!-- ---------------------------- 会话操作菜单 ---------------------------- -->
    <!-- Teleport 到 body：会话列表是 overflow:auto 的滚动容器，就地渲染会被裁掉 -->
    <Teleport to="body">
      <div
        v-if="menuForId"
        ref="menuRef"
        class="chat__menu"
        data-chat-menu
        role="menu"
        aria-label="会话操作"
        :aria-activedescendant="`chat-menu-item-${menuIndex}`"
        tabindex="-1"
        :style="{ top: `${menuPos.top}px`, right: `${menuPos.right}px` }"
        @keydown="onMenuKeydown"
      >
        <button
          v-for="(entry, index) in MENU_ITEMS"
          :id="`chat-menu-item-${index}`"
          :key="entry.key"
          class="chat__menu-item"
          :class="{ 'is-active': index === menuIndex, 'is-danger': entry.danger }"
          type="button"
          role="menuitem"
          @click="runMenuItem(entry)"
          @mousemove="menuIndex = index"
        >
          {{ entry.label }}
        </button>
      </div>
    </Teleport>

    <!-- ⚠️ 暂定实现：参照页的删除确认流程尚未确定（用户会补截图）。
         本轮按「二次确认弹窗 + 危险色确认按钮」落地，截图到位后可能需要调整。 -->
    <Modal v-model="confirmDelete" title="删除会话" width="420px">
      <p class="chat__confirm">
        删除后不可恢复，确认删除
        <span class="ui-mono">{{ pendingDelete?.title || '未命名会话' }}</span
        >？
      </p>
      <template #footer>
        <Button type="ghost" @click="confirmDelete = false">取消</Button>
        <Button type="danger" :loading="deleting" @click="removeConversation">确认删除</Button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
/* ============================== 整页骨架 ============================== */
/* 铺满「顶栏以下」的全部空间：对话产品不需要页面级留白与卡片外框 */
.chat {
  display: flex;
  height: calc(100vh - var(--ui-layout-navbar-height));
  min-height: 0;
  background: var(--ui-bg-base);
}

/* ------------------------------ 会话栏 ------------------------------ */
/* 底色比内容区略灰，靠 1px 分隔线与主区区分，不用阴影 */
/*
 * 会话操作菜单：浮层沿用现有玻璃 + 面板圆角语言（Teleport 到 body，坐标由脚本给）。
 * 项几何照参照页实测：116×40、圆角 8px、字号 14px。
 */
.chat__menu {
  position: fixed;
  z-index: var(--ui-z-navbar);
  padding: var(--ui-space-1);
  background: var(--ui-bg-overlay);
  -webkit-backdrop-filter: var(--ui-glass-blur);
  backdrop-filter: var(--ui-glass-blur);
  border: 1px solid var(--ui-border-l2);
  border-radius: var(--ui-radius-panel);
  box-shadow: var(--ui-shadow-2);
  outline: none;
}

.chat__menu-item {
  display: flex;
  align-items: center;
  width: 116px;
  height: 40px;
  padding: 0 var(--ui-space-2);
  border: none;
  border-radius: var(--ui-radius-2);
  background: transparent;
  color: var(--ui-text-secondary);
  font-size: var(--ui-font-size-base);
  text-align: left;
  cursor: pointer;
}

.chat__menu-item.is-active {
  background: var(--ui-interactive-hover);
  color: var(--ui-text-primary);
}

/* 危险项：只改文字色，不用实底红块——菜单里两项等重，实底会抢走视觉重心 */
.chat__menu-item.is-danger {
  color: var(--ui-danger-label);
}

.chat__menu-item.is-danger.is-active {
  background: var(--ui-danger-fill);
}

.chat__confirm {
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-secondary);
  line-height: var(--ui-line-height-base);
}

/* ------------------------------ 主区域 ------------------------------ */
.chat__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--ui-bg-layer-1);
  -webkit-backdrop-filter: var(--ui-glass-blur);
  backdrop-filter: var(--ui-glass-blur);
}

/* 顶栏：只放身份与状态（60px，与参照页实测的主区顶栏同高），别抢对话内容的空间 */
.chat__head {
  flex: none;
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
  height: 60px;
  padding: 0 var(--ui-space-5);
  border-bottom: 1px solid var(--ui-border-l1);
}

.chat__head-main {
  display: flex;
  align-items: baseline;
  gap: var(--ui-space-2);
  min-width: 0;
}

.chat__title {
  font-size: var(--ui-font-size-base);
  font-weight: var(--ui-font-weight-semibold);
  color: var(--ui-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat__head-sub,
.chat__kn {
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-caption);
}

.chat__pill {
  padding: 2px var(--ui-space-2);
  border: 1px solid var(--ui-border-l2);
  border-radius: var(--ui-radius-pill);
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-tertiary);
}

.chat__head-spacer {
  flex: 1;
}

.chat__state {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2);
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-caption);
}

.chat__state-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ui-text-dimmed);
}

.chat__state.is-live {
  color: var(--ui-success-label);
}

.chat__state.is-live .chat__state-dot {
  background: var(--ui-success-label);
}

/* ------------------------------ 消息流 ------------------------------ */
.chat__list {
  flex: 1;
  min-height: 0;
}

/* 对话列：内容列 840px 居中（照参照页实测），消息流 / 输入区 / 选择器共用同一列宽 */
.chat__thread {
  max-width: var(--ui-layout-content-max);
  margin: 0 auto;
  padding: var(--ui-space-6) var(--ui-space-5) var(--ui-space-5);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-6);
}

.chat__hint {
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-caption);
}

.msg {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
  min-width: 0;
}

/* 消息级操作（P0-2）：hover / 键盘聚焦出现，默认不占位、不打扰阅读 */
.msg__actions {
  display: flex;
  gap: var(--ui-space-2);
  opacity: 0;
  transition: opacity var(--ui-duration-fast) var(--ui-ease-standard);
}

.msg:hover .msg__actions,
.msg:focus-within .msg__actions {
  opacity: 1;
}

.msg__action {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--ui-text-caption);
  font-size: var(--ui-font-size-caption);
  cursor: pointer;
}

.msg__action:hover {
  color: var(--ui-text-label-secondary);
}

.msg__action--danger:hover {
  color: var(--ui-danger-label);
}

/* 用户消息：右对齐浅灰气泡，无边框、无阴影（气泡本身就是容器） */
.msg--user {
  align-items: flex-end;
}

.msg__bubble {
  max-width: 78%;
  padding: var(--ui-space-2) var(--ui-space-4);
  background: var(--ui-bg-layer-2);
  -webkit-backdrop-filter: var(--ui-glass-blur);
  backdrop-filter: var(--ui-glass-blur);
  border-radius: var(--ui-radius-panel);
  color: var(--ui-text-primary);
  font-size: var(--ui-font-size-base);
  line-height: var(--ui-line-height-base);
  white-space: pre-wrap;
  overflow-wrap: break-word;
}

/* 助手消息：正文直接铺在底色上，不加气泡——长回答套气泡会显得拥挤 */
.msg--assistant {
  align-items: stretch;
}

.msg__who {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-caption);
}

.msg__meta {
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-dimmed);
}

/*
 * 生成中提示（batch 6a）：小图标 + 「XX 思考中 · 用时 N 秒」 + 呼吸的省略号。
 * 轻量、落在消息流里，不铺底色、不遮内容；动效时长与缓动一律走令牌，不写死数值。
 * ⚠️ 白标铁律：措辞只用中性的「思考中」，绝不透出上游模型的中文公司名。
 */
.msg__thinking {
  display: flex;
  align-items: center;
  gap: var(--ui-space-1);
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-caption);
}

.msg__thinking-glyph {
  display: inline-flex;
  align-items: center;
  line-height: 1;
}

/* 思考动图：**必须显式定尺寸**——GIF 原始尺寸是 150×151，不约束会把整行撑开 */
.msg__thinking-gif {
  display: block;
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.msg__thinking-dots {
  animation: msg-thinking-pulse var(--ui-duration-slow) var(--ui-ease-standard) infinite alternate;
}

@keyframes msg-thinking-pulse {
  from {
    opacity: 0.25;
  }

  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .msg__thinking-dots {
    animation: none;
  }

  /* 动图无法用 CSS 暂停：减少动态偏好下直接隐藏，状态仍由文字（织流思考中 · 用时 N 秒）传达 */
  .msg__thinking-gif {
    display: none;
  }
}

.msg__files {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-2);
}

.msg__file {
  display: inline-block;
  padding: 2px var(--ui-space-2);
  border: 1px solid var(--ui-border-l2);
  border-radius: var(--ui-radius-pill);
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-tertiary);
}

.msg__file:hover {
  border-color: var(--ui-primary);
  color: var(--ui-primary-text);
}

.chat__plan {
  max-width: var(--ui-layout-content-max);
  margin: 0 auto var(--ui-space-3);
  padding: 0 var(--ui-space-5);
}

/* ---------------------------- 智能体选择 ---------------------------- */
/* 默认会话解析中：只放一句占位，不与选择页争夺视觉（避免"闪一下选择页"） */
.chat__boot {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--ui-space-6) var(--ui-space-5);
}

.chat__picker {
  flex: 1;
  min-height: 0;
}

.chat__picker-inner {
  max-width: var(--ui-layout-content-max);
  margin: 0 auto;
  padding: var(--ui-space-6) var(--ui-space-5);
}

.chat__picker-tip {
  margin-bottom: var(--ui-space-3);
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-caption);
}

.chat__picker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--ui-space-3);
}

.chat__picker-card {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  padding: var(--ui-space-3);
  background: var(--ui-bg-layer-1);
  -webkit-backdrop-filter: var(--ui-glass-blur);
  backdrop-filter: var(--ui-glass-blur);
  border: 1px solid var(--ui-border-l2);
  border-radius: var(--ui-radius-3);
  cursor: pointer;
  transition:
    border-color var(--ui-duration-fast) var(--ui-ease-standard),
    background var(--ui-duration-fast) var(--ui-ease-standard),
    box-shadow var(--ui-duration-fast) var(--ui-ease-standard),
    transform var(--ui-duration-fast) var(--ui-ease-standard);
}

.chat__picker-card:hover {
  border-color: var(--ui-primary);
  background: var(--ui-interactive-hover-strong);
  box-shadow: var(--ui-shadow-hover);
  transform: var(--ui-lift-hover-sm);
}

.chat__picker-name {
  flex: 1;
  min-width: 0;
  text-align: left;
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat__picker-stage {
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-caption);
}

/* ---------------------------- 演示通道标注 ---------------------------- */
/* 演示通道标注条：钉在消息流上方，滚动带不走。
   用警示色系但只做一条细带，不铺大块背景。 */
.chat__demo-banner {
  flex: none;
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  padding: var(--ui-space-2) var(--ui-space-5);
  border-bottom: 1px solid var(--ui-border-l1);
  background: var(--ui-warn-fill);
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-secondary);
}

/* 窄屏兜底轻量条（方案 §3.6）：显隐由模板的 v-if 控制（面板被折叠时才渲染），
   这里只负责布局；与侧栏面板同源。 */
.chat__mini {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--ui-space-3);
  padding: var(--ui-space-2) var(--ui-space-5);
  border-bottom: 1px solid var(--ui-border-l1);
  background: var(--ui-bg-layer-2);
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-secondary);
}

.chat__mini-team {
  font-weight: var(--ui-font-weight-medium);
  color: var(--ui-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat__mini-count {
  flex: none;
  color: var(--ui-text-caption);
}

.chat__mini-speaker {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ui-text-caption);
}

/* ---------------------------- 产出抽屉（点侧栏成员） ---------------------------- */
.artifact {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}

.artifact__meta {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
}

.artifact__none {
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-caption);
  line-height: var(--ui-line-height-base);
}

.artifact__contract {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
  padding: var(--ui-space-3);
  border: 1px solid var(--ui-border-l1);
  border-radius: var(--ui-radius-3);
  background: var(--ui-bg-layer-2);
}

.artifact__contract-title {
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-medium);
  color: var(--ui-text-primary);
}

.artifact__missing {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
  font-size: var(--ui-font-size-caption);
  color: var(--ui-danger-label);
}

.artifact__hint {
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-caption);
}

/* 派发卡片消息：与 assistant 消息同宽铺满，不缩进 */
.msg--dispatch {
  align-items: stretch;
}

/* 对话页里的空状态：去掉 Empty 自带的虚线框与白底。
   为什么：Empty 组件默认是「一张虚线卡片」，适合塞在列表/卡片里；
   但对话页是全屏白底，一块虚线方框会变成孤立的矩形，破坏「干净的整屏」观感。 */
.chat :deep(.ui-empty) {
  border: none;
  background: transparent;
  padding: var(--ui-space-6) var(--ui-space-4);
}

/* 顶栏头像：方形小图，与标题同高，不喧哗 */
.chat__head :deep(.ui-avatar) {
  flex: none;
}

/* 窄屏：收窄会话栏，优先保证对话正文宽度。
   （轻量条不在这里控制——它由"面板是否被折叠"决定，见模板处说明。） */
@media (max-width: 1180px) {
  .chat__rail {
    width: 216px;
  }
}
</style>

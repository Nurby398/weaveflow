<script setup>
/**
 * 工作台：我的团队列表 + 每个团队下的智能体卡片流
 * 后端无更新字段，卡片时间取 createdAt（工具提示里已明说）。
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Avatar from '@/components/ui/Avatar.vue'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import Empty from '@/components/ui/Empty.vue'
import Input from '@/components/ui/Input.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import Tabs from '@/components/ui/Tabs.vue'
import Tooltip from '@/components/ui/Tooltip.vue'
import { agentApi, conversationApi, logApiError, pipelineApi, teamApi, toFriendlyError } from '@/api'
import { useAuthGuard } from '@/composables/useAuthGuard'
import { useToast } from '@/composables/useToast'
import { useUserStore } from '@/store/user'
import { agentAvatar } from '@/lib/avatars'
import { formatDateTime, relativeTime, shortId } from '@/lib/format'

const router = useRouter()
const toast = useToast()
const userStore = useUserStore()
const { requireLogin } = useAuthGuard()

const teams = ref([])
const agents = ref([])
const loading = ref(false)
/** 正在为其创建会话的智能体 id */
const creating = ref('')
/** 正在为其启动流水线的团队 id */
const starting = ref('')

const bySort = (a, b) => (a.sort ?? 0) - (b.sort ?? 0)

/** 团队分组；未归属任何团队（或团队已删除）的智能体归入「未分组」 */
const groups = computed(() => {
  const teamIds = new Set(teams.value.map((team) => team.id))
  const list = teams.value.map((team) => ({
    id: team.id,
    name: team.name,
    description: team.description,
    /** 平台公共团队（所有账号可见、可跑流水线，不可改） */
    isPlatform: team.isPlatform === true,
    agents: agents.value.filter((agent) => agent.teamId === team.id).sort(bySort),
  }))

  const loose = agents.value.filter((agent) => !agent.teamId || !teamIds.has(agent.teamId)).sort(bySort)
  if (loose.length) {
    list.push({
      id: '__loose__',
      name: '未分组',
      description: '尚未归属任何团队的智能体',
      isPlatform: false,
      agents: loose,
    })
  }
  return list
})

/** 平台/我的筛选 + 名称搜索（P0-5）：未分组只属于「我的」，平台段排除它 */
const seg = ref('all')
const query = ref('')
const SEG_TABS = [
  { key: 'all', label: '全部' },
  { key: 'mine', label: '我的' },
  { key: 'platform', label: '平台' },
]
const filteredGroups = computed(() => {
  const kw = query.value.trim().toLowerCase()
  return groups.value.filter((group) => {
    // 分段：未分组只属于「我的」；其余按 isPlatform 分
    if (group.id === '__loose__') {
      if (seg.value === 'platform') return false
    } else {
      if (seg.value === 'platform' && !group.isPlatform) return false
      if (seg.value === 'mine' && group.isPlatform) return false
    }
    if (kw) {
      const nameHit = String(group.name ?? '')
        .toLowerCase()
        .includes(kw)
      const agentHit = group.agents.some((agent) =>
        String(agent.name ?? '')
          .toLowerCase()
          .includes(kw),
      )
      if (!nameHit && !agentHit) return false
    }
    return true
  })
})

const stageCount = computed(() => new Set(agents.value.map((a) => a.stageNo).filter((n) => n !== null)).size)

/** 平台公共团队数（项目卡片流的总览指标之一） */
const platformTeamCount = computed(() => teams.value.filter((team) => team.isPlatform).length)

/** 每个项目（团队）的阶段数：成员智能体去重后的 stageNo 数量 */
function stageCountOf(group) {
  return new Set(group.agents.map((agent) => agent.stageNo).filter((n) => n !== null)).size
}

async function load() {
  if (!userStore.loggedIn) return
  loading.value = true
  try {
    const [teamList, agentList] = await Promise.all([teamApi.list(), agentApi.list()])
    teams.value = teamList
    agents.value = agentList
  } catch (error) {
    logApiError(error, 'workbench')
    toast.error(toFriendlyError(error))
  } finally {
    loading.value = false
  }
}

onMounted(load)

/** 进入智能体对话：先建会话（真实接口）再跳转 */
async function openAgent(agent) {
  if (!requireLogin('发起对话')) return
  if (creating.value) return
  creating.value = agent.id
  try {
    const conversation = await conversationApi.create({ agentDefId: agent.id, title: agent.name })
    router.push(`/chat/${conversation.id}`)
  } catch (error) {
    logApiError(error, 'workbench')
    toast.error(toFriendlyError(error))
  } finally {
    creating.value = ''
  }
}

/** 一句话描述：后端没有 description 字段，取系统提示词首行 */
function summaryOf(agent) {
  // 接入智能体的提示词与技能在来源平台维护（本地本来就没有提示词），
  // 显示成「尚未填写系统提示词」会让人以为要在这里补，用户曾被这句误导过。
  if (agent?.sourceType === 'external') return '提示词与技能由来源平台维护'
  const raw = String(agent.systemPrompt || '')
    .replace(/[#>*`_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!raw) return '尚未填写系统提示词'
  return raw.length > 58 ? `${raw.slice(0, 58)}…` : raw
}

/** 启动流水线：为团队创建一次运行，成功后进入运行页（阶段推进与契约校验都在那里） */
async function startPipeline(team) {
  if (!requireLogin('启动流水线')) return
  if (starting.value) return
  starting.value = team.id
  try {
    const result = await pipelineApi.start(team.id)
    const runId = result?.run?.id || result?.id || ''
    if (!runId) throw new Error('启动流水线响应缺少 run.id')
    router.push(`/pipeline/${runId}`)
  } catch (error) {
    logApiError(error, 'workbench')
    toast.error(toFriendlyError(error))
  } finally {
    starting.value = ''
  }
}

function goto(path) {
  router.push(path)
}
</script>

<template>
  <div class="workbench">
    <!-- ------------------------------ 概览 ------------------------------ -->
    <header class="workbench__head">
      <div>
        <h2>工作台</h2>
        <p class="workbench__sub">每个项目就是一条毕设流水线，点成员卡片直接进入对话。</p>
      </div>
      <dl class="workbench__stats">
        <div class="workbench__stat">
          <dt>团队</dt>
          <dd class="ui-mono">{{ teams.length }}</dd>
        </div>
        <div class="workbench__stat">
          <dt>智能体</dt>
          <dd class="ui-mono">{{ agents.length }}</dd>
        </div>
        <div class="workbench__stat">
          <dt>阶段</dt>
          <dd class="ui-mono">{{ stageCount }}</dd>
        </div>
        <div class="workbench__stat">
          <dt>平台</dt>
          <dd class="ui-mono">{{ platformTeamCount }}</dd>
        </div>
      </dl>
      <div class="workbench__actions">
        <!-- 按钮文案与路由 meta.title 保持一致（智能体创建 / 智能体团队） -->
        <Button type="info" size="sm" @click="goto('/agents')">智能体创建</Button>
        <Button type="info" size="sm" @click="goto('/teams')">智能体团队</Button>
      </div>
    </header>

    <!-- --------------------------- 未登录状态 --------------------------- -->
    <Empty
      v-if="!userStore.loggedIn"
      icon="teams"
      title="登录后查看你的团队"
      description="工作台读取的是当前账号下的团队与智能体，未登录时不发起任何请求。"
    >
      <Button type="primary" @click="requireLogin('查看工作台')">登录</Button>
    </Empty>

    <!-- ---------------------------- 加载骨架 ---------------------------- -->
    <LoadingState v-else-if="loading && !agents.length" :rows="3" />

    <!-- ----------------------------- 数据区 ----------------------------- -->
    <template v-else>
      <div class="workbench__filter">
        <Tabs v-model="seg" :tabs="SEG_TABS" />
        <Input v-model="query" aria-label="搜索项目" placeholder="搜索项目或成员" />
      </div>

      <Empty
        v-if="!groups.length"
        icon="box"
        title="还没有团队和智能体"
        description="先建一个团队，再为它添加按阶段协作的智能体。"
      >
        <Button type="primary" @click="goto('/teams')">新建团队</Button>
        <Button type="info" @click="goto('/agents')">新建智能体</Button>
      </Empty>

      <Empty
        v-else-if="!filteredGroups.length"
        icon="filter"
        title="没有匹配的项目"
        description="换个关键词，或切到「全部」。"
      />

      <section v-for="group in filteredGroups" :key="group.id" class="team-block">
        <div class="team-block__head">
          <h3 class="team-block__name">{{ group.name }}</h3>
          <Badge v-if="group.isPlatform" tone="primary">平台公共</Badge>
          <Badge tone="neutral">{{ group.agents.length }} 个智能体</Badge>
          <Badge tone="neutral">阶段 {{ stageCountOf(group) }}</Badge>
          <span class="team-block__id ui-mono">{{ group.id === '__loose__' ? '—' : `#${shortId(group.id)}` }}</span>
          <!-- 未分组不是真实团队，没有可启动的流水线 -->
          <Button
            v-if="group.id !== '__loose__'"
            class="team-block__start"
            type="info"
            size="sm"
            :loading="starting === group.id"
            @click="startPipeline(group)"
          >
            启动流水线
          </Button>
          <p v-if="group.description" class="team-block__desc">{{ group.description }}</p>
        </div>

        <div class="agent-grid">
          <article
            v-for="agent in group.agents"
            :key="agent.id"
            class="agent-card"
            :class="{ 'is-busy': creating === agent.id }"
            role="button"
            tabindex="0"
            @click="openAgent(agent)"
            @keydown.enter="openAgent(agent)"
          >
            <Avatar :src="agentAvatar(agent)" :name="agent.name" size="md" shape="square" />

            <div class="agent-card__body">
              <div class="agent-card__head">
                <h4 class="agent-card__name">{{ agent.name }}</h4>
                <Badge v-if="agent.isPlatform" tone="primary">平台</Badge>
                <Badge tone="info">阶段 {{ agent.stageNo ?? '—' }}</Badge>
              </div>

              <p class="agent-card__desc">{{ summaryOf(agent) }}</p>

              <div class="agent-card__meta">
                <span class="ui-mono">#{{ shortId(agent.id) }}</span>
                <Tooltip :content="`创建时间 ${formatDateTime(agent.createdAt)}（后端未提供更新时间）`">
                  <span class="ui-mono">{{ relativeTime(agent.createdAt) }}</span>
                </Tooltip>
                <span v-if="agent.model" class="ui-mono agent-card__model">{{ agent.model }}</span>
                <span v-if="agent.knowledgeDocIds?.length" class="ui-mono">
                  知识 {{ agent.knowledgeDocIds.length }}
                </span>
              </div>
            </div>
          </article>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.workbench {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-5);
}

.workbench__head {
  display: flex;
  align-items: center;
  gap: var(--ui-space-5);
  padding: var(--ui-space-4);
  background: var(--ui-bg-layer-1);
  -webkit-backdrop-filter: var(--ui-glass-blur);
  backdrop-filter: var(--ui-glass-blur);
  border: 1px solid var(--ui-border-l1);
  border-radius: var(--ui-radius-panel);
}

.workbench__sub {
  margin-top: var(--ui-space-1);
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-label-tertiary);
}

.workbench__stats {
  display: flex;
  gap: var(--ui-space-5);
  margin: 0 0 0 auto;
}

.workbench__stat dt {
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-caption);
}

.workbench__stat dd {
  margin: 0;
  font-size: var(--ui-font-size-title);
  color: var(--ui-text-label-primary);
}

.workbench__actions {
  display: flex;
  gap: var(--ui-space-2);
}

.workbench__filter {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
  margin-bottom: var(--ui-space-4);
}

.workbench__filter .ui-input {
  max-width: 240px;
}

.workbench__skeleton {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--ui-space-3);
  justify-content: start;
}

.workbench__skeleton-card {
  height: 96px;
  background: var(--ui-bg-skeleton);
  border: 1px solid var(--ui-border-l1);
  border-radius: var(--ui-radius-4);
}

.team-block {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
}

.team-block__head {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
  flex-wrap: wrap;
}

/* 启动按钮靠右；下一行的团队说明独占整行 */
.team-block__start {
  margin-left: auto;
}

.team-block__name {
  font-size: var(--ui-font-size-lg);
  color: var(--ui-text-label-primary);
}

.team-block__id {
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-dimmed);
}

.team-block__desc {
  width: 100%;
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-caption);
}

/**
 * 列数随容器自适应：minmax 下限决定一屏列数，1fr 只在列内均分。
 * 下限 240px 让 1250px 左右的内容区能排下 5 列——5 个智能体正好占满一行，
 * 不会再出现「第二行只剩一张、右侧全空」的观感；超宽容器由卡片 max-width 兜住。
 */
.agent-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--ui-space-3);
  justify-content: start;
}

.agent-card {
  display: flex;
  gap: var(--ui-space-3);
  /* 超宽容器下也不让卡片被拉得过宽 */
  max-width: 384px;
  padding: var(--ui-space-3);
  background: var(--ui-bg-layer-1);
  -webkit-backdrop-filter: var(--ui-glass-blur);
  backdrop-filter: var(--ui-glass-blur);
  border: 1px solid var(--ui-border-l1);
  border-radius: var(--ui-radius-4);
  cursor: pointer;
  transition:
    border-color var(--ui-duration-fast) var(--ui-ease-standard),
    background var(--ui-duration-fast) var(--ui-ease-standard),
    box-shadow var(--ui-duration-fast) var(--ui-ease-standard),
    transform var(--ui-duration-fast) var(--ui-ease-standard);
}

/* hover：抬起 + 交互态阴影（依据用户原话「ui 互动效果显著一点，可以适当增加悬浮，阴影等效果」；
   静态卡片不加阴影，只有交互态与浮层加——原则见 base.css 的玻璃工具类注释） */
.agent-card:hover {
  background: var(--ui-bg-layer-2);
  border-color: var(--ui-border-l3);
  box-shadow: var(--ui-shadow-hover);
  transform: var(--ui-lift-hover);
}

.agent-card.is-busy {
  opacity: 0.6;
  pointer-events: none;
}

.agent-card__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
}

.agent-card__head {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
}

.agent-card__name {
  font-size: var(--ui-font-size-base);
  font-weight: var(--ui-font-weight-medium);
  color: var(--ui-text-label-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-card__desc {
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-label-tertiary);
  line-height: var(--ui-line-height-base);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.agent-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-3);
  margin-top: var(--ui-space-1);
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-caption);
}

.agent-card__model {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

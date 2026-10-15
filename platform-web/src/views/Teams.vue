<script setup>
/**
 * 团队配置：增删团队、增删团队成员、成员拖拽排序（只排序，不做画布）
 * 排序落库为 agents.sort（步长 10），移动成员落库为 agents.teamId。
 */
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Avatar from '@/components/ui/Avatar.vue'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import Empty from '@/components/ui/Empty.vue'
import Input from '@/components/ui/Input.vue'
import Tabs from '@/components/ui/Tabs.vue'
import Modal from '@/components/ui/Modal.vue'
import TeamTemplateWizard from '@/components/TeamTemplateWizard.vue'
import { agentApi, logApiError, pipelineApi, teamApi, toFriendlyError } from '@/api'
import { useAuthGuard } from '@/composables/useAuthGuard'
import { useToast } from '@/composables/useToast'
import { useUserStore } from '@/store/user'
import { agentAvatar } from '@/lib/avatars'
import { formatDateTime, shortId } from '@/lib/format'

const router = useRouter()
const toast = useToast()
const userStore = useUserStore()
const { requireLogin } = useAuthGuard()

const teams = ref([])
const allAgents = ref([])
const selectedTeamId = ref('')

/** 平台/我的筛选 + 名称搜索（P0-5） */
const seg = ref('all')
const query = ref('')
const SEG_TABS = [
  { key: 'all', label: '全部' },
  { key: 'mine', label: '我的' },
  { key: 'platform', label: '平台' },
]
const filteredTeams = computed(() => {
  const kw = query.value.trim().toLowerCase()
  return teams.value.filter((team) => {
    if (seg.value === 'platform' && !team.isPlatform) return false
    if (seg.value === 'mine' && team.isPlatform) return false
    if (
      kw &&
      !String(team.name ?? '')
        .toLowerCase()
        .includes(kw)
    )
      return false
    return true
  })
})
const saving = ref(false)
const confirmDelete = ref(false)
const starting = ref(false)
const templateOpen = ref(false)

const form = reactive({ name: '', description: '' })

/** 当前团队成员的本地副本：拖拽期间只改这里，松手才落库 */
const ordered = ref([])
const dragIndex = ref(-1)

const selectedTeam = computed(() => teams.value.find((team) => team.id === selectedTeamId.value) || null)

/** 平台公共团队（后端 isPlatform）：所有登录账号可读、可跑流水线，但不能改也不能删。 */
const isPlatformSelected = computed(() => selectedTeam.value?.isPlatform === true)

/** 可加入当前团队的智能体（不属于任何团队，或属于其它团队） */
const candidates = computed(() =>
  allAgents.value
    .filter((agent) => agent.teamId !== selectedTeamId.value)
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)),
)

watch(selectedTeam, (team) => {
  form.name = team?.name || ''
  form.description = team?.description || ''
  ordered.value = [...(team?.agents || [])].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
})

async function load(keepSelection = true) {
  if (!userStore.loggedIn) return
  try {
    const [teamList, agentList] = await Promise.all([teamApi.list(), agentApi.list()])
    teams.value = teamList
    allAgents.value = agentList
    if (!keepSelection || !teamList.some((team) => team.id === selectedTeamId.value)) {
      selectedTeamId.value = teamList[0]?.id || ''
    }
  } catch (error) {
    logApiError(error, 'teams')
    toast.error(toFriendlyError(error))
  }
}

onMounted(() => load())

function createTeam() {
  if (!requireLogin('新建团队')) return
  selectedTeamId.value = ''
  form.name = ''
  form.description = ''
  ordered.value = []
}

async function saveTeam() {
  if (!form.name.trim()) {
    toast.warning('请填写团队名称')
    return
  }
  saving.value = true
  const payload = { name: form.name.trim(), description: form.description.trim() || null }
  try {
    const saved = selectedTeamId.value
      ? await teamApi.update(selectedTeamId.value, payload)
      : await teamApi.create(payload)
    toast.success(selectedTeamId.value ? '已保存' : '已创建')
    await load()
    if (saved?.id) selectedTeamId.value = saved.id
  } catch (error) {
    logApiError(error, 'teams')
    toast.error(toFriendlyError(error))
  } finally {
    saving.value = false
  }
}

async function removeTeam() {
  confirmDelete.value = false
  try {
    await teamApi.remove(selectedTeamId.value)
    toast.success('已删除团队')
    selectedTeamId.value = ''
    await load(false)
  } catch (error) {
    logApiError(error, 'teams')
    toast.error(toFriendlyError(error))
  }
}

async function addAgent(agent) {
  try {
    await agentApi.update(agent.id, { teamId: selectedTeamId.value })
    await load()
  } catch (error) {
    logApiError(error, 'teams')
    toast.error(toFriendlyError(error))
  }
}

async function removeAgent(agent) {
  try {
    await agentApi.update(agent.id, { teamId: null })
    await load()
  } catch (error) {
    logApiError(error, 'teams')
    toast.error(toFriendlyError(error))
  }
}

/** 启动流水线：为当前团队创建一次运行并进入运行页（合同校验与阶段推进都在那里） */
async function startPipeline() {
  if (!requireLogin('启动流水线')) return
  if (starting.value) return
  starting.value = true
  try {
    const result = await pipelineApi.start(selectedTeamId.value)
    const runId = result?.run?.id || result?.id || ''
    if (!runId) throw new Error('启动流水线响应缺少 run.id')
    router.push(`/pipeline/${runId}`)
  } catch (error) {
    logApiError(error, 'teams')
    toast.error(toFriendlyError(error))
  } finally {
    starting.value = false
  }
}

/* ------------------------------ 拖拽排序 ------------------------------ */

/** 接入智能体的模型由来源方指定（本地 model 为 null）。**对外不显示具体模型名**，避免暴露供给方。 */
function modelLabel(agent) {
  if (agent?.model) return agent.model
  return agent?.sourceType === 'external' ? '由来源方指定' : '未绑定模型'
}

function onDragStart(index, event) {
  dragIndex.value = index
  event.dataTransfer.effectAllowed = 'move'
  // Firefox 必须 setData 才会触发拖拽
  event.dataTransfer.setData('text/plain', String(index))
}

function onDragOver(index, event) {
  event.preventDefault()
  if (dragIndex.value === -1 || dragIndex.value === index) return
  const list = ordered.value
  const [moved] = list.splice(dragIndex.value, 1)
  list.splice(index, 0, moved)
  dragIndex.value = index
}

async function onDrop() {
  const index = dragIndex.value
  dragIndex.value = -1
  if (index === -1) return

  const next = ordered.value.map((agent, position) => ({ agent, sort: (position + 1) * 10 }))
  const changed = next.filter(({ agent, sort }) => (agent.sort ?? 0) !== sort)
  if (!changed.length) return

  try {
    await Promise.all(changed.map(({ agent, sort }) => agentApi.update(agent.id, { sort })))
    toast.success('排序已保存')
  } catch (error) {
    logApiError(error, 'teams')
    toast.error(toFriendlyError(error))
  }
  await load()
}
</script>

<template>
  <div class="teams">
    <!-- ------------------------------ 团队列表 ------------------------------ -->
    <aside class="teams__list">
      <div class="teams__list-head">
        <h3>团队</h3>
        <Badge tone="neutral">{{ teams.length }}</Badge>
        <Button type="info" size="sm" @click="createTeam">新建</Button>
        <Button type="ghost" size="sm" @click="templateOpen = true">使用模板</Button>
      </div>

      <div class="teams__filter">
        <Tabs v-model="seg" :tabs="SEG_TABS" />
        <Input v-model="query" aria-label="搜索团队" placeholder="搜索名称" />
      </div>

      <ul v-if="filteredTeams.length" class="teams__items ui-scroll">
        <li v-for="team in filteredTeams" :key="team.id">
          <button
            class="teams__item"
            :class="{ 'is-active': team.id === selectedTeamId }"
            type="button"
            @click="selectedTeamId = team.id"
          >
            <span class="teams__item-name">{{ team.name }}</span>
            <Badge v-if="team.isPlatform" tone="primary">平台</Badge>
            <span class="ui-mono teams__item-meta">
              {{ team.agents?.length || 0 }} 成员 · #{{ shortId(team.id) }}
            </span>
          </button>
        </li>
      </ul>

      <Empty
        v-else-if="teams.length && !filteredTeams.length"
        size="sm"
        icon="filter"
        title="没有匹配的团队"
        description="换个关键词，或切到「全部」。"
      />

      <Empty v-else-if="userStore.loggedIn" size="sm" icon="teams" title="还没有团队" />
      <Empty v-else size="sm" icon="profile" title="登录后查看" />
    </aside>

    <!-- ------------------------------ 配置区 ------------------------------ -->
    <section class="teams__editor">
      <Empty
        v-if="!userStore.loggedIn"
        icon="teams"
        title="登录后配置团队"
        description="团队与成员关系都走受保护接口，未登录时不发起请求。"
      >
        <Button type="primary" @click="requireLogin('配置团队')">登录</Button>
      </Empty>

      <template v-else>
        <header class="teams__head">
          <h2>{{ selectedTeamId ? '团队配置' : '新建团队' }}</h2>
          <span v-if="selectedTeamId" class="ui-mono teams__head-id">#{{ selectedTeamId }}</span>
          <Badge v-if="isPlatformSelected" tone="primary">平台公共 · 只读</Badge>
          <div class="teams__head-spacer" />
          <Button v-if="selectedTeamId" type="ghost" size="sm" :loading="starting" @click="startPipeline">
            启动流水线
          </Button>
          <Button v-if="selectedTeamId && !isPlatformSelected" type="ghost" size="sm" @click="confirmDelete = true">
            删除团队
          </Button>
          <Button v-if="!isPlatformSelected" type="primary" size="sm" :loading="saving" @click="saveTeam">
            {{ selectedTeamId ? '保存' : '创建' }}
          </Button>
        </header>

        <div class="teams__body ui-scroll" :inert="isPlatformSelected">
          <p v-if="isPlatformSelected" class="field__hint">
            平台公共团队：任何登录账号都能查看并启动它的流水线，但不能修改成员或删除它。
          </p>
          <div class="field-row">
            <label class="field">
              <span class="field__label">团队名称</span>
              <Input v-model="form.name" placeholder="如：毕业设计流水线" maxlength="120" />
            </label>
          </div>
          <label class="field">
            <span class="field__label">团队说明</span>
            <Input v-model="form.description" placeholder="选填：这个团队解决什么问题" maxlength="2000" />
          </label>

          <template v-if="selectedTeamId">
            <div class="teams__section-head">
              <span class="field__label">成员与顺序（拖拽排序）</span>
              <Badge tone="neutral">{{ ordered.length }} 个</Badge>
              <span class="ui-mono teams__stamp"> 创建于 {{ formatDateTime(selectedTeam?.createdAt) }} </span>
            </div>

            <ul v-if="ordered.length" class="teams__members">
              <li
                v-for="(agent, index) in ordered"
                :key="agent.id"
                class="teams__member"
                :class="{ 'is-dragging': dragIndex === index }"
                draggable="true"
                @dragstart="onDragStart(index, $event)"
                @dragover="onDragOver(index, $event)"
                @drop="onDrop"
                @dragend="onDrop"
              >
                <span class="teams__handle ui-mono" aria-hidden="true">⠿</span>
                <span class="ui-mono teams__order">{{ String(index + 1).padStart(2, '0') }}</span>
                <Avatar :src="agentAvatar(agent)" :name="agent.name" size="sm" shape="square" />
                <span class="teams__member-name">{{ agent.name }}</span>
                <Badge tone="info">阶段 {{ agent.stageNo ?? '—' }}</Badge>
                <span class="ui-mono teams__member-id">#{{ shortId(agent.id) }}</span>
                <span class="ui-mono teams__member-model">{{ modelLabel(agent) }}</span>
                <Button type="ghost" size="sm" @click="removeAgent(agent)">移出</Button>
              </li>
            </ul>
            <Empty v-else size="sm" icon="profile" title="该团队还没有成员" description="从下方候选列表加入。" />

            <div class="teams__section-head">
              <span class="field__label">加入成员</span>
            </div>
            <div v-if="candidates.length" class="teams__candidates">
              <button
                v-for="agent in candidates"
                :key="agent.id"
                class="teams__candidate"
                type="button"
                @click="addAgent(agent)"
              >
                <Avatar :src="agentAvatar(agent)" :name="agent.name" size="sm" shape="square" />
                <span class="teams__candidate-name">{{ agent.name }}</span>
                <Badge tone="neutral">阶段 {{ agent.stageNo ?? '—' }}</Badge>
                <span class="ui-mono teams__candidate-id">#{{ shortId(agent.id) }}</span>
              </button>
            </div>
            <p v-else class="field__hint">所有智能体都已在该团队中。</p>
          </template>
        </div>
      </template>
    </section>

    <Modal v-model="confirmDelete" title="删除团队" width="420px">
      <p class="teams__confirm">
        删除团队不会删除其成员智能体，成员会回到「未分组」。确认删除
        <span class="ui-mono">{{ form.name }}</span
        >？
      </p>
      <template #footer>
        <Button type="ghost" @click="confirmDelete = false">取消</Button>
        <Button type="danger" @click="removeTeam">确认删除</Button>
      </template>
    </Modal>

    <!-- 团队模板：一键搭好「毕设流水线」骨架（Paperclip 参照 §C2） -->
    <TeamTemplateWizard v-model="templateOpen" @created="load()" />
  </div>
</template>

<style scoped>
.teams {
  display: flex;
  gap: var(--ui-space-4);
  height: calc(100vh - var(--ui-layout-navbar-height) - var(--ui-space-5) * 2);
}

.teams__list {
  flex: none;
  width: 240px;
  display: flex;
  flex-direction: column;
  background: var(--ui-bg-layer-1);
  -webkit-backdrop-filter: var(--ui-glass-blur);
  backdrop-filter: var(--ui-glass-blur);
  border: 1px solid var(--ui-border-l1);
  border-radius: var(--ui-radius-panel);
  overflow: hidden;
}

.teams__list-head {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  padding: var(--ui-space-3);
  border-bottom: 1px solid var(--ui-border-l1);
}

.teams__filter {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
  padding: var(--ui-space-3);
  border-bottom: 1px solid var(--ui-border-l1);
}

.teams__list-head h3 {
  flex: 1;
  font-size: var(--ui-font-size-base);
  color: var(--ui-text-label-primary);
}

.teams__items {
  flex: 1;
  padding: var(--ui-space-2);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
}

.teams__item {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--ui-space-2);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--ui-radius-2);
  text-align: left;
  cursor: pointer;
  transition:
    background var(--ui-duration-fast) var(--ui-ease-standard),
    box-shadow var(--ui-duration-fast) var(--ui-ease-standard),
    transform var(--ui-duration-fast) var(--ui-ease-standard);
}

.teams__item:hover {
  background: var(--ui-interactive-hover-strong);
  box-shadow: var(--ui-shadow-hover);
  transform: var(--ui-lift-hover-sm);
}

.teams__item.is-active {
  background: var(--ui-interactive-active);
  border-color: var(--ui-border-l3);
}

.teams__item-name {
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-label-primary);
}

.teams__item-meta {
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-caption);
}

.teams__editor {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--ui-bg-layer-1);
  -webkit-backdrop-filter: var(--ui-glass-blur);
  backdrop-filter: var(--ui-glass-blur);
  border: 1px solid var(--ui-border-l1);
  border-radius: var(--ui-radius-panel);
  overflow: hidden;
}

.teams__head {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
  padding: var(--ui-space-3) var(--ui-space-4);
  border-bottom: 1px solid var(--ui-border-l1);
}

.teams__head h2 {
  font-size: var(--ui-font-size-base);
  font-weight: var(--ui-font-weight-medium);
  color: var(--ui-text-label-primary);
}

.teams__head-id,
.teams__stamp {
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-dimmed);
}

.teams__head-spacer {
  flex: 1;
}

.teams__body {
  flex: 1;
  padding: var(--ui-space-4);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
}

.field-row {
  display: flex;
  gap: var(--ui-space-3);
}

.field {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
}

/* 只有横排时才让字段横向占满，避免在纵向容器里被拉高 */
.field-row > .field {
  flex: 1 1 0;
  min-width: 0;
}

.field__label {
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-caption);
}

.field__hint {
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-caption);
}

.teams__section-head {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  margin-top: var(--ui-space-2);
  padding-bottom: var(--ui-space-1);
  border-bottom: 1px solid var(--ui-border-l1);
}

.teams__section-head .ui-mono {
  margin-left: auto;
}

.teams__members {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
}

.teams__member {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
  padding: var(--ui-space-2);
  background: var(--ui-bg-layer-2);
  border: 1px solid var(--ui-border-l1);
  border-radius: var(--ui-radius-2);
}

.teams__member.is-dragging {
  border-color: var(--ui-primary);
  opacity: 0.85;
}

.teams__handle {
  color: var(--ui-text-dimmed);
  cursor: grab;
}

.teams__order {
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-caption);
}

.teams__member-name {
  flex: 1;
  min-width: 0;
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-label-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.teams__member-id,
.teams__member-model {
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-caption);
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.teams__candidates {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--ui-space-2);
}

.teams__candidate {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  padding: var(--ui-space-2);
  background: var(--ui-bg-layer-2);
  border: 1px dashed var(--ui-border-l2);
  border-radius: var(--ui-radius-2);
  cursor: pointer;
  transition:
    border-color var(--ui-duration-fast) var(--ui-ease-standard),
    box-shadow var(--ui-duration-fast) var(--ui-ease-standard),
    transform var(--ui-duration-fast) var(--ui-ease-standard);
}

.teams__candidate:hover {
  border-color: var(--ui-primary);
  box-shadow: var(--ui-shadow-hover);
  transform: var(--ui-lift-hover-sm);
}

.teams__candidate-name {
  flex: 1;
  min-width: 0;
  text-align: left;
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-label-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.teams__candidate-id {
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-dimmed);
}

.teams__confirm {
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-label-secondary);
  line-height: var(--ui-line-height-loose);
}
</style>

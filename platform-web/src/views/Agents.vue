<script setup>
/**
 * 智能体配置：列表 + 编辑（名称 / 图标 / 阶段 / 系统提示词 / 接入来源 / 知识文档）
 * 接入来源分两类：self_hosted（自家模型凭据）与 external（接入智能体）。
 */
import { computed, onMounted, reactive, ref, watch } from 'vue'
import Avatar from '@/components/ui/Avatar.vue'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import Empty from '@/components/ui/Empty.vue'
import Input from '@/components/ui/Input.vue'
import Modal from '@/components/ui/Modal.vue'
import Select from '@/components/ui/Select.vue'
import Tabs from '@/components/ui/Tabs.vue'
import Textarea from '@/components/ui/Textarea.vue'
import { agentApi, knowledgeApi, logApiError, providerApi, toFriendlyError } from '@/api'
import { useAuthGuard } from '@/composables/useAuthGuard'
import { useToast } from '@/composables/useToast'
import { useUserStore } from '@/store/user'
import { agentAvatar } from '@/lib/avatars'
import { formatBytes, formatDateTime, shortId } from '@/lib/format'

const toast = useToast()
const userStore = useUserStore()
const { requireLogin } = useAuthGuard()

const agents = ref([])

/** 平台/我的筛选 + 名称搜索（P0-5） */
const seg = ref('all')
const query = ref('')
const SEG_TABS = [
  { key: 'all', label: '全部' },
  { key: 'mine', label: '我的' },
  { key: 'platform', label: '平台' },
]
const filteredAgents = computed(() => {
  const kw = query.value.trim().toLowerCase()
  return agents.value.filter((agent) => {
    if (seg.value === 'platform' && !agent.isPlatform) return false
    if (seg.value === 'mine' && agent.isPlatform) return false
    if (
      kw &&
      !String(agent.name ?? '')
        .toLowerCase()
        .includes(kw)
    )
      return false
    return true
  })
})
const providers = ref([])
const docs = ref([])
const selectedId = ref('')
const loading = ref(false)
const saving = ref(false)
const confirmDelete = ref(false)
const confirmUnbind = ref(false)
const testingExternal = ref(false)
/** 连通性测试结果（含后端返回的失败原因），仅在当前选中项内有效 */
const testResult = ref(null)
/** 是否正在更换已绑定令牌（为 false 时只显示掩码，不回填） */
const changingToken = ref(false)

const SOURCE_TABS = [
  { key: 'self_hosted', label: '自带模型 Key' },
  { key: 'external', label: '接入智能体' },
]

/**
 * 接入智能体的示例地址：仅用于占位提示与新建时的预填，可从环境变量覆盖，
 * 不写进请求逻辑（后端以表单值为准）。
 * ⚠️ 默认值必须是**中性示例域名**，不得写入任何真实上游地址（白标要求，见 docs/通用智能体与白标方案-v1.md §四）。
 */
const EXTERNAL_BASE_URL_EXAMPLE = import.meta.env.VITE_EXTERNAL_AGENT_BASE_URL || 'https://your-agent.example.com'

const form = reactive({
  name: '',
  icon: '',
  stageNo: '',
  systemPrompt: '',
  providerCredId: '',
  model: '',
  knowledgeDocIds: [],
  teamId: null,
  sort: 0,
  sourceType: 'self_hosted',
  externalBaseUrl: '',
  externalAgentId: '',
  externalToken: '',
})

const providerOptions = computed(() =>
  providers.value.map((item) => ({ label: `${item.label} · ${item.apiKeyHint}`, value: item.id })),
)

const currentModels = computed(() => providers.value.find((item) => item.id === form.providerCredId)?.models || [])

const isNew = computed(() => !selectedId.value)

/* ------------------------- 接入智能体态 ------------------------- */

const isExternal = computed(() => form.sourceType === 'external')

/** 当前选中的服务端记录（外部字段以它为准，表单只持有可编辑副本） */
const currentAgent = computed(() => agents.value.find((item) => item.id === selectedId.value) || null)

/**
 * 平台公共智能体（后端 isPlatform，= user_id 为 NULL）：所有登录账号都能用，
 * 但普通用户不能改也不能删（后端 403 PLATFORM_RESOURCE_READONLY），所以编辑区整体不提供写入口。
 */
const isPlatformSelected = computed(() => currentAgent.value?.isPlatform === true)

/** 后端只回掩码 → 有掩码即视为已绑定 */
const boundExternal = computed(() => !isNew.value && !!currentAgent.value?.externalTokenHint)
/**
 * 是否已有接入地址。用于「明文不回填」的两个判断：占位提示 与 留空=不修改 的校验。
 * ⚠️ 白标：真实接入地址（可能含上游域名）**绝不回填到输入框**，否则用户能直接看到来源（docs/通用智能体与白标方案-v1.md §四）。
 */
const boundBaseUrl = computed(() => Boolean(currentAgent.value?.externalBaseUrl))

/** 已保存的智能体才能测连通性（测试接口需要 id） */
const canTestExternal = computed(() => !isNew.value && isExternal.value)

/** 连通性测试的补充信息：HTTP 状态码与耗时 */
const testMeta = computed(() => {
  const parts = []
  if (testResult.value?.status) parts.push(`HTTP ${testResult.value.status}`)
  if (testResult.value?.latencyMs != null) parts.push(`${testResult.value.latencyMs}ms`)
  return parts.join(' · ')
})

function fillForm(agent) {
  form.name = agent?.name || ''
  form.icon = agent?.icon || ''
  form.stageNo = agent?.stageNo ?? ''
  form.systemPrompt = agent?.systemPrompt || ''
  form.providerCredId = agent?.providerCredId || ''
  form.model = agent?.model || ''
  form.knowledgeDocIds = [...(agent?.knowledgeDocIds || [])]
  form.teamId = agent?.teamId ?? null
  form.sort = agent?.sort ?? 0
  form.sourceType = agent?.sourceType === 'external' ? 'external' : 'self_hosted'
  // ⚠️ 不回填地址：与令牌同构，明文只进不出。留空 = 不修改（见 validateExternal / save）
  form.externalBaseUrl = ''
  form.externalAgentId = agent?.externalAgentId || ''
  // 后端只回掩码（externalTokenHint），明文令牌永不回填，留空即「不修改」
  form.externalToken = ''
  changingToken.value = false
  testResult.value = null
}

watch(selectedId, (id) => fillForm(agents.value.find((item) => item.id === id)))

/** 切到接入来源时给一个可用的示例地址，用户可改 */
watch(
  () => form.sourceType,
  (type) => {
    testResult.value = null
    changingToken.value = false
    if (type === 'external' && !form.externalBaseUrl && isNew.value) {
      form.externalBaseUrl = EXTERNAL_BASE_URL_EXAMPLE
    }
  },
)

async function load() {
  if (!userStore.loggedIn) return
  loading.value = true
  try {
    const [agentList, providerList, docList] = await Promise.all([
      agentApi.list(),
      providerApi.list(),
      knowledgeApi.list(),
    ])
    agents.value = agentList
    providers.value = providerList
    docs.value = docList
    if (!selectedId.value && agentList.length) selectedId.value = agentList[0].id
    else if (selectedId.value) fillForm(agentList.find((item) => item.id === selectedId.value))
  } catch (error) {
    logApiError(error, 'agents')
    toast.error(toFriendlyError(error))
  } finally {
    loading.value = false
  }
}

onMounted(load)

function createNew() {
  selectedId.value = ''
  fillForm(null)
}

function toggleDoc(id) {
  const index = form.knowledgeDocIds.indexOf(id)
  if (index === -1) form.knowledgeDocIds.push(id)
  else form.knowledgeDocIds.splice(index, 1)
}

/**
 * 校验接入字段；全部通过时返回空串。
 * 已绑定且未点「更换」时令牌留空是合法语义（不修改），新建时必须填。
 */
function validateExternal() {
  const baseUrl = form.externalBaseUrl.trim()
  // 地址与令牌同构：已绑定且未重新输入时留空是合法语义（不修改），新建 / 未绑定过必须填
  if (!baseUrl && !boundBaseUrl.value) return '请填写接入地址'
  if (baseUrl && !/^https?:\/\/\S+$/i.test(baseUrl)) return '接入地址需以 http:// 或 https:// 开头'
  if (!form.externalAgentId.trim()) return '请填写接入智能体 ID'
  const needToken = !boundExternal.value || changingToken.value
  if (needToken && !form.externalToken.trim()) return '请填写访问令牌'
  return ''
}

async function save() {
  if (!form.name.trim()) {
    toast.warning('请填写智能体名称')
    return
  }
  if (isExternal.value) {
    const message = validateExternal()
    if (message) {
      toast.warning(message)
      return
    }
  }
  saving.value = true
  const payload = {
    name: form.name.trim(),
    icon: form.icon.trim() || null,
    stageNo: form.stageNo === '' ? null : Number(form.stageNo),
    teamId: form.teamId,
    sort: Number(form.sort) || 0,
    sourceType: form.sourceType,
  }
  if (isExternal.value) {
    // 提示词 / 模型 / 知识由来源平台维护，本平台不提交这三类字段，
    // PATCH 语义下「不提交 = 不修改」，不会把已有自建配置清空。
    // 地址与令牌同构：留空 = 不修改（PATCH 语义），也保证已存地址不会被空值清掉
    if (form.externalBaseUrl.trim()) payload.externalBaseUrl = form.externalBaseUrl.trim()
    payload.externalAgentId = form.externalAgentId.trim()
    // 明文进、掩码出：留空即「不修改」，绝不能把掩码当明文提交
    if (form.externalToken.trim()) payload.externalToken = form.externalToken.trim()
  } else {
    payload.systemPrompt = form.systemPrompt.trim() || null
    payload.providerCredId = form.providerCredId || null
    payload.model = form.model.trim() || null
    payload.knowledgeDocIds = form.knowledgeDocIds
  }
  try {
    const saved = selectedId.value ? await agentApi.update(selectedId.value, payload) : await agentApi.create(payload)
    toast.success(selectedId.value ? '已保存' : '已创建')
    await load()
    if (saved?.id) selectedId.value = saved.id
  } catch (error) {
    logApiError(error, 'agents')
    toast.error(toFriendlyError(error))
  } finally {
    saving.value = false
  }
}

async function remove() {
  confirmDelete.value = false
  try {
    await agentApi.remove(selectedId.value)
    toast.success('已删除')
    selectedId.value = ''
    await load()
    if (agents.value.length) selectedId.value = agents.value[0].id
  } catch (error) {
    logApiError(error, 'agents')
    toast.error(toFriendlyError(error))
  }
}

/* ========================= 接入 ========================= */

/** 从后端负载里取可展示的原文：折叠空白 + 截断，只用于测试结果区，不整段弹给用户 */
function pickBackendText(payload) {
  const source = payload?.error ?? payload
  const raw =
    (typeof source === 'string' ? source : '') ||
    source?.message ||
    source?.msg ||
    payload?.message ||
    payload?.msg ||
    payload?.detail
  return typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, 160) : ''
}

/** 兼容 { ok } / { success } / 仅 status 三种返回形状 */
function normalizeTestResult(result) {
  const data = result && typeof result === 'object' ? result : {}
  const ok = data.ok ?? data.success ?? (typeof data.status === 'number' ? data.status < 400 : false)
  return {
    ok: !!ok,
    status: data.status ?? null,
    latencyMs: data.latencyMs ?? null,
    message: pickBackendText(data),
  }
}

async function testExternal() {
  if (!canTestExternal.value) {
    toast.warning('先保存智能体，再测试连通性')
    return
  }
  testingExternal.value = true
  testResult.value = null
  try {
    testResult.value = normalizeTestResult(await agentApi.testExternal(selectedId.value))
  } catch (error) {
    logApiError(error, 'agents.external')
    testResult.value = {
      ok: false,
      status: error?.status ?? null,
      latencyMs: null,
      message: pickBackendText(error?.data ?? error),
    }
  } finally {
    testingExternal.value = false
  }
  if (testResult.value.ok) toast.success('接入智能体连通正常')
  else toast.error('接入智能体连通失败，请检查地址与令牌')
}

async function unbindExternal() {
  confirmUnbind.value = false
  try {
    await agentApi.removeExternal(selectedId.value)
    toast.success('已解绑接入')
    await load()
  } catch (error) {
    logApiError(error, 'agents.external')
    toast.error(toFriendlyError(error))
  }
}
</script>

<template>
  <div class="agents">
    <!-- ------------------------------ 列表 ------------------------------ -->
    <aside class="agents__list">
      <div class="agents__list-head">
        <h3>智能体</h3>
        <Badge tone="neutral">{{ agents.length }}</Badge>
        <Button type="info" size="sm" @click="createNew">新建</Button>
      </div>

      <div class="agents__filter">
        <Tabs v-model="seg" :tabs="SEG_TABS" />
        <Input v-model="query" aria-label="搜索智能体" placeholder="搜索名称" />
      </div>

      <ul v-if="filteredAgents.length" class="agents__items ui-scroll">
        <li v-for="agent in filteredAgents" :key="agent.id">
          <button
            class="agents__item"
            :class="{ 'is-active': agent.id === selectedId }"
            type="button"
            @click="selectedId = agent.id"
          >
            <Avatar :src="agentAvatar(agent)" :name="agent.name" size="sm" shape="square" />
            <span class="agents__item-body">
              <span class="agents__item-name">{{ agent.name }}</span>
              <span class="ui-mono agents__item-id">#{{ shortId(agent.id) }}</span>
            </span>
            <Badge v-if="agent.isPlatform" tone="primary">平台</Badge>
            <Badge v-if="agent.sourceType === 'external'" tone="info">接入</Badge>
            <Badge tone="neutral">{{ agent.stageNo ?? '—' }}</Badge>
          </button>
        </li>
      </ul>

      <Empty
        v-else-if="agents.length && !filteredAgents.length"
        size="sm"
        icon="filter"
        title="没有匹配的智能体"
        description="换个关键词，或切到「全部」。"
      />

      <Empty
        v-else-if="userStore.loggedIn"
        size="sm"
        icon="agents"
        title="还没有智能体"
        description="右侧填写后点「创建」即可。"
      />
      <Empty v-else size="sm" icon="profile" title="登录后查看" />
    </aside>

    <!-- ------------------------------ 编辑区 ------------------------------ -->
    <section class="agents__editor">
      <Empty
        v-if="!userStore.loggedIn"
        icon="agents"
        title="登录后配置智能体"
        description="智能体列表与编辑都走受保护接口，未登录时不发起请求。"
      >
        <Button type="primary" @click="requireLogin('配置智能体')">登录</Button>
      </Empty>

      <template v-else>
        <header class="agents__editor-head">
          <Avatar
            :src="agentAvatar({ id: selectedId, name: form.name })"
            :name="form.name || '新'"
            size="md"
            shape="square"
          />
          <h2 class="agents__editor-title">{{ isNew ? '新建智能体' : form.name }}</h2>
          <span v-if="!isNew" class="ui-mono agents__editor-id">#{{ selectedId }}</span>
          <Badge v-if="isPlatformSelected" tone="primary">平台公共 · 只读</Badge>
          <div class="agents__editor-spacer" />
          <Button v-if="!isNew && !isPlatformSelected" type="ghost" size="sm" @click="confirmDelete = true">
            删除
          </Button>
          <Button v-if="!isPlatformSelected" type="primary" size="sm" :loading="saving" @click="save">
            {{ isNew ? '创建' : '保存' }}
          </Button>
        </header>

        <div class="agents__form ui-scroll" :inert="isPlatformSelected">
          <p v-if="isPlatformSelected" class="field__hint">
            平台公共智能体：任何登录账号都能用它发起对话与流水线，但不能修改或删除。
          </p>
          <div class="field-row">
            <label class="field">
              <span class="field__label">名称</span>
              <Input v-model="form.name" placeholder="如：需求分析与开题工程师" maxlength="120" />
            </label>
            <label class="field field--narrow">
              <span class="field__label">图标（1–2 字符）</span>
              <Input v-model="form.icon" placeholder="✎" maxlength="2" />
            </label>
            <label class="field field--narrow">
              <span class="field__label">阶段序号</span>
              <Input v-model="form.stageNo" type="number" placeholder="0" />
            </label>
          </div>

          <!-- 系统提示词只属于自建智能体：接入智能体的提示词在来源平台维护 -->
          <label v-if="!isExternal" class="field">
            <span class="field__label">系统提示词</span>
            <Textarea v-model="form.systemPrompt" :rows="12" placeholder="描述该智能体的角色、输入、输出与约束" />
          </label>

          <div class="field">
            <span class="field__label">接入来源</span>
            <Tabs v-model="form.sourceType" variant="pill" :tabs="SOURCE_TABS">
              <div class="agents__source">
                <!-- ------------------- 自带模型 Key ------------------- -->
                <template v-if="!isExternal">
                  <p class="agents__source-note">
                    自建智能体：提示词、模型凭据与知识挂载都在本平台维护，用于你自己组建的团队与流水线。
                  </p>

                  <div class="field-row">
                    <label class="field">
                      <span class="field__label">绑定模型凭据</span>
                      <Select
                        v-model="form.providerCredId"
                        :options="providerOptions"
                        placeholder="未绑定（去「设置」新增凭据）"
                      />
                    </label>
                    <label class="field">
                      <span class="field__label">模型名</span>
                      <Input v-model="form.model" placeholder="如：deepseek-chat" maxlength="200" />
                    </label>
                  </div>

                  <div v-if="currentModels.length" class="agents__models">
                    <span class="field__label">该凭据已登记模型</span>
                    <div class="agents__models-row">
                      <button
                        v-for="model in currentModels"
                        :key="model"
                        class="agents__model-chip ui-mono"
                        type="button"
                        @click="form.model = model"
                      >
                        {{ model }}
                      </button>
                    </div>
                  </div>
                </template>

                <!-- ------------------- 接入智能体 ------------------- -->
                <template v-else>
                  <p class="agents__source-note">
                    此智能体的提示词、技能与知识库由来源平台维护，本平台只负责接入与编排。 这里不提供提示词 / 模型绑定 /
                    知识挂载——那些配置在来源平台上做，改完本平台按接入智能体 ID 直接调用。
                  </p>

                  <div class="field-row">
                    <label class="field">
                      <span class="field__label">接入地址（Base URL）</span>
                      <Input
                        v-model="form.externalBaseUrl"
                        :placeholder="
                          boundBaseUrl ? '已配置（出于安全不显示完整地址；重新输入即覆盖）' : EXTERNAL_BASE_URL_EXAMPLE
                        "
                        maxlength="300"
                      />
                    </label>
                    <label class="field">
                      <span class="field__label">接入智能体 ID</span>
                      <Input v-model="form.externalAgentId" placeholder="对方平台分配的智能体标识" maxlength="200" />
                    </label>
                  </div>

                  <div class="field">
                    <span class="field__label">访问令牌</span>

                    <!-- 已绑定且未点「更换」：只显示掩码，永不回填到输入框 -->
                    <div v-if="boundExternal && !changingToken" class="agents__bound">
                      <span class="ui-mono agents__bound-hint">{{ currentAgent.externalTokenHint }}</span>
                      <Badge tone="success" dot>已绑定</Badge>
                      <span class="agents__bound-spacer" />
                      <Button type="info" size="sm" @click="changingToken = true">更换</Button>
                      <Button type="ghost" size="sm" @click="confirmUnbind = true">解绑</Button>
                    </div>

                    <template v-else>
                      <Input
                        v-model="form.externalToken"
                        type="password"
                        placeholder="粘贴对方的访问令牌（服务端只回掩码）"
                        maxlength="400"
                        autocomplete="off"
                      />
                      <p class="field__hint">明文提交、掩码回传，所以这里永不回填；留空表示不修改。</p>
                    </template>
                  </div>

                  <div class="agents__test">
                    <Button
                      type="info"
                      size="sm"
                      :loading="testingExternal"
                      :disabled="!canTestExternal"
                      @click="testExternal"
                    >
                      测试连通性
                    </Button>

                    <span v-if="isNew" class="field__hint">先保存，再用已落库的配置测连通性。</span>
                    <template v-else-if="testResult">
                      <Badge :tone="testResult.ok ? 'success' : 'danger'" dot>
                        {{ testResult.ok ? '连通正常' : '连通失败' }}
                      </Badge>
                      <span v-if="testMeta" class="ui-mono agents__test-meta">{{ testMeta }}</span>
                      <span v-if="testResult.message" class="agents__test-error">
                        后端返回：{{ testResult.message }}
                      </span>
                    </template>
                  </div>
                </template>
              </div>
            </Tabs>
          </div>

          <!-- 知识挂载只属于自建智能体：接入智能体的知识库在来源平台维护 -->
          <div v-if="!isExternal" class="field">
            <span class="field__label">挂载知识文档（多选）</span>
            <div v-if="docs.length" class="agents__docs">
              <label v-for="doc in docs" :key="doc.id" class="agents__doc">
                <Checkbox :model-value="form.knowledgeDocIds.includes(doc.id)" @update:model-value="toggleDoc(doc.id)">
                  <span class="agents__doc-name">{{ doc.name }}</span>
                  <span class="ui-mono agents__doc-meta"> {{ formatBytes(doc.bytes) }} · #{{ shortId(doc.id) }} </span>
                </Checkbox>
              </label>
            </div>
            <p v-else class="field__hint">知识库为空，暂无可挂载文档。</p>
          </div>
          <p v-else class="agents__source-note">
            接入智能体的知识库不在这里挂载：其知识检索由来源平台按其自身数据集维护，本平台不做挂载与注入。
          </p>

          <p v-if="!isNew" class="agents__stamp ui-mono">
            创建时间 {{ formatDateTime(agents.find((a) => a.id === selectedId)?.createdAt) }}
          </p>
        </div>
      </template>
    </section>

    <Modal v-model="confirmDelete" title="删除智能体" width="420px">
      <p class="agents__confirm">
        删除后不可恢复，已产生的会话不会一并删除。确认删除
        <span class="ui-mono">{{ form.name }}</span
        >？
      </p>
      <template #footer>
        <Button type="ghost" @click="confirmDelete = false">取消</Button>
        <Button type="danger" @click="remove">确认删除</Button>
      </template>
    </Modal>

    <Modal v-model="confirmUnbind" title="解绑接入" width="420px">
      <p class="agents__confirm">
        解绑后该智能体不再走接入端点，已保存的令牌会被服务端清除。确认解绑
        <span class="ui-mono">{{ form.name }}</span
        >？
      </p>
      <template #footer>
        <Button type="ghost" @click="confirmUnbind = false">取消</Button>
        <Button type="danger" @click="unbindExternal">确认解绑</Button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.agents {
  display: flex;
  gap: var(--ui-space-4);
  height: calc(100vh - var(--ui-layout-navbar-height) - var(--ui-space-5) * 2);
}

.agents__list {
  flex: none;
  width: 268px;
  display: flex;
  flex-direction: column;
  background: var(--ui-bg-layer-1);
  -webkit-backdrop-filter: var(--ui-glass-blur);
  backdrop-filter: var(--ui-glass-blur);
  border: 1px solid var(--ui-border-l1);
  border-radius: var(--ui-radius-panel);
  overflow: hidden;
}

.agents__list-head {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  padding: var(--ui-space-3);
  border-bottom: 1px solid var(--ui-border-l1);
}

.agents__list-head h3 {
  flex: 1;
  font-size: var(--ui-font-size-base);
  color: var(--ui-text-label-primary);
}

.agents__filter {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
  padding: var(--ui-space-3);
  border-bottom: 1px solid var(--ui-border-l1);
}

.agents__items {
  flex: 1;
  padding: var(--ui-space-2);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
}

.agents__item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  padding: var(--ui-space-2);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--ui-radius-2);
  cursor: pointer;
  transition:
    background var(--ui-duration-fast) var(--ui-ease-standard),
    box-shadow var(--ui-duration-fast) var(--ui-ease-standard),
    transform var(--ui-duration-fast) var(--ui-ease-standard);
}

.agents__item:hover {
  background: var(--ui-interactive-hover-strong);
  box-shadow: var(--ui-shadow-hover);
  transform: var(--ui-lift-hover-sm);
}

.agents__item.is-active {
  background: var(--ui-interactive-active);
  border-color: var(--ui-border-l3);
}

.agents__item-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  text-align: left;
}

.agents__item-name {
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-label-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agents__item-id {
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-dimmed);
}

.agents__editor {
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

.agents__editor-head {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
  padding: var(--ui-space-3) var(--ui-space-4);
  border-bottom: 1px solid var(--ui-border-l1);
}

.agents__editor-title {
  font-size: var(--ui-font-size-base);
  font-weight: var(--ui-font-weight-medium);
  color: var(--ui-text-label-primary);
}

.agents__editor-id {
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-dimmed);
}

.agents__editor-spacer {
  flex: 1;
}

.agents__form {
  flex: 1;
  padding: var(--ui-space-4);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
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

.field--narrow {
  width: 160px;
}

.field-row > .field--narrow {
  flex: 0 0 160px;
  width: auto;
}

.field__label {
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-caption);
}

.field__hint {
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-caption);
}

.agents__models {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
}

/* ---------------------------- 接入来源 ---------------------------- */

.agents__source {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}

/* 两种来源的用途差异必须写在分支里，避免「在这里重建接入智能体」的误读 */
.agents__source-note {
  padding: var(--ui-space-2) var(--ui-space-3);
  background: var(--ui-bg-layer-2);
  border: 1px solid var(--ui-border-l1);
  border-left: 2px solid var(--ui-border-l3);
  border-radius: var(--ui-radius-2);
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-label-tertiary);
  line-height: var(--ui-line-height-loose);
}

.agents__bound {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  padding: var(--ui-space-2) var(--ui-space-3);
  background: var(--ui-bg-layer-2);
  border: 1px solid var(--ui-border-l1);
  border-radius: var(--ui-radius-2);
}

.agents__bound-hint {
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-label-primary);
}

.agents__bound-spacer {
  flex: 1;
}

.agents__test {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--ui-space-2);
}

.agents__test-meta {
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-caption);
}

.agents__test-error {
  font-size: var(--ui-font-size-caption);
  color: var(--ui-danger-label);
  word-break: break-all;
}

.agents__models-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-2);
}

.agents__model-chip {
  padding: 2px var(--ui-space-2);
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-label-secondary);
  background: var(--ui-bg-layer-2);
  border: 1px solid var(--ui-border-l1);
  border-radius: var(--ui-radius-2);
  cursor: pointer;
}

.agents__model-chip:hover {
  border-color: var(--ui-border-l3);
  color: var(--ui-primary-text);
}

.agents__docs {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--ui-space-1) var(--ui-space-3);
  padding: var(--ui-space-2);
  background: var(--ui-bg-layer-2);
  border: 1px solid var(--ui-border-l1);
  border-radius: var(--ui-radius-3);
  max-height: 220px;
  overflow-y: auto;
}

.agents__doc-name {
  display: block;
  color: var(--ui-text-label-primary);
}

.agents__doc-meta {
  display: block;
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-caption);
}

.agents__stamp {
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-caption);
}

.agents__confirm {
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-label-secondary);
  line-height: var(--ui-line-height-loose);
}
</style>

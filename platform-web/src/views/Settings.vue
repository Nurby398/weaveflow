<script setup>
/**
 * 设置：模型凭据（Provider / API Key）
 * 密钥只以掩码（apiKeyHint）展示，前端不保存明文；新建后立即清空表单。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import Empty from '@/components/ui/Empty.vue'
import Input from '@/components/ui/Input.vue'
import Modal from '@/components/ui/Modal.vue'
import Textarea from '@/components/ui/Textarea.vue'
import { logApiError, providerApi, toFriendlyError } from '@/api'
import { useAuthGuard } from '@/composables/useAuthGuard'
import { useToast } from '@/composables/useToast'
import { useUserStore } from '@/store/user'
import { formatDateTime, shortId } from '@/lib/format'

const toast = useToast()
const userStore = useUserStore()
const { requireLogin } = useAuthGuard()

const providers = ref([])
const loading = ref(false)
const saving = ref(false)
const createOpen = ref(false)
const confirmId = ref('')
/** provider.id → { ok, latencyMs, status, modelCount, error } */
const testResults = ref({})
const testingId = ref('')

const form = reactive({ label: '', baseUrl: '', apiKey: '', models: '' })

const confirmTarget = computed(() => providers.value.find((item) => item.id === confirmId.value) || null)

async function load() {
  if (!userStore.loggedIn) return
  loading.value = true
  try {
    providers.value = await providerApi.list()
  } catch (error) {
    logApiError(error, 'settings')
    toast.error(toFriendlyError(error))
  } finally {
    loading.value = false
  }
}

onMounted(load)

function openCreate() {
  if (!requireLogin('新增模型凭据')) return
  form.label = ''
  form.baseUrl = ''
  form.apiKey = ''
  form.models = ''
  createOpen.value = true
}

/** 换行 / 逗号分隔的模型名 → 数组 */
function parseModels(text) {
  return String(text || '')
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

async function create() {
  if (!form.label.trim() || !form.baseUrl.trim() || !form.apiKey.trim()) {
    toast.warning('label / baseUrl / apiKey 都不能为空')
    return
  }
  saving.value = true
  try {
    await providerApi.create({
      label: form.label.trim(),
      baseUrl: form.baseUrl.trim(),
      apiKey: form.apiKey.trim(),
      models: parseModels(form.models),
    })
    createOpen.value = false
    // 明文只存在于本次请求，提交后立刻丢弃
    form.apiKey = ''
    toast.success('凭据已保存')
    await load()
  } catch (error) {
    logApiError(error, 'settings')
    toast.error(toFriendlyError(error))
  } finally {
    saving.value = false
  }
}

async function test(provider) {
  testingId.value = provider.id
  try {
    const result = await providerApi.test(provider.id)
    testResults.value = { ...testResults.value, [provider.id]: result }
    if (result?.ok) toast.success('连通性正常')
    else toast.error('连通性测试未通过')
  } catch (error) {
    logApiError(error, 'settings')
    const friendly = toFriendlyError(error)
    testResults.value = { ...testResults.value, [provider.id]: { ok: false, error: friendly } }
    toast.error(friendly)
  } finally {
    testingId.value = ''
  }
}

async function remove() {
  const id = confirmId.value
  confirmId.value = ''
  try {
    await providerApi.remove(id)
    toast.success('已删除')
    await load()
  } catch (error) {
    logApiError(error, 'settings')
    toast.error(toFriendlyError(error))
  }
}
</script>

<template>
  <div class="settings">
    <header class="settings__head">
      <div>
        <h2>模型凭据</h2>
        <p class="settings__sub">密钥在服务端加密存储，列表只返回掩码（apiKeyHint）；前端不留明文。</p>
      </div>
      <div class="settings__head-spacer" />
      <Badge tone="neutral">{{ providers.length }} 条</Badge>
      <Button type="primary" size="sm" @click="openCreate">新增凭据</Button>
    </header>

    <Empty
      v-if="!userStore.loggedIn"
      icon="key"
      title="登录后管理模型凭据"
      description="凭据接口需要登录态，未登录时不发起请求。"
    >
      <Button type="primary" @click="requireLogin('管理模型凭据')">登录</Button>
    </Empty>

    <Empty
      v-else-if="!providers.length && !loading"
      icon="key"
      title="还没有模型凭据"
      description="填写 label / baseUrl / apiKey / models 后即可在智能体上绑定。"
    >
      <Button type="primary" @click="openCreate">新增凭据</Button>
    </Empty>

    <ul v-else class="settings__list">
      <li v-for="item in providers" :key="item.id" class="provider">
        <div class="provider__main">
          <div class="provider__line">
            <h3 class="provider__label">{{ item.label }}</h3>
            <span class="ui-mono provider__id">#{{ shortId(item.id) }}</span>
            <Badge v-if="testResults[item.id]?.ok" tone="success" dot>连通</Badge>
            <Badge v-else-if="testResults[item.id]" tone="danger" dot>不可用</Badge>
          </div>

          <div class="provider__meta">
            <span class="ui-mono provider__url">{{ item.baseUrl }}</span>
            <span class="ui-mono provider__key">{{ item.apiKeyHint }}</span>
            <span class="ui-mono provider__time">{{ formatDateTime(item.createdAt) }}</span>
          </div>

          <div v-if="item.models?.length" class="provider__models">
            <span v-for="model in item.models" :key="model" class="ui-mono provider__model">{{ model }}</span>
          </div>

          <p v-if="testResults[item.id]" class="provider__result ui-mono">
            <template v-if="testResults[item.id].ok">
              延迟 {{ testResults[item.id].latencyMs }} ms · 可用模型
              {{ testResults[item.id].modelCount ?? '未返回' }}
            </template>
            <template v-else>
              HTTP {{ testResults[item.id].status ?? '—' }} · {{ testResults[item.id].error }}
            </template>
          </p>
        </div>

        <div class="provider__actions">
          <Button type="info" size="sm" :loading="testingId === item.id" @click="test(item)"> 连通性测试 </Button>
          <Button type="ghost" size="sm" @click="confirmId = item.id">删除</Button>
        </div>
      </li>
    </ul>

    <!-- ------------------------------ 新增 ------------------------------ -->
    <Modal v-model="createOpen" title="新增模型凭据" width="560px">
      <div class="settings__form">
        <label class="field">
          <span class="field__label">label</span>
          <Input v-model="form.label" placeholder="如：DeepSeek 官方" maxlength="64" />
        </label>
        <label class="field">
          <span class="field__label">baseUrl</span>
          <Input v-model="form.baseUrl" placeholder="https://api.deepseek.com/v1" />
        </label>
        <label class="field">
          <span class="field__label">apiKey</span>
          <Input v-model="form.apiKey" type="password" placeholder="sk-..." />
        </label>
        <label class="field">
          <span class="field__label">models（每行一个，或用逗号分隔）</span>
          <Textarea v-model="form.models" :rows="4" placeholder="deepseek-chat&#10;deepseek-reasoner" />
        </label>
      </div>
      <template #footer>
        <Button type="ghost" @click="createOpen = false">取消</Button>
        <Button type="primary" :loading="saving" @click="create">保存</Button>
      </template>
    </Modal>

    <!-- ------------------------------ 删除 ------------------------------ -->
    <Modal :model-value="!!confirmId" title="删除凭据" width="420px" @update:model-value="confirmId = ''">
      <p class="settings__confirm">
        已绑定该凭据的智能体将无法发起对话。确认删除
        <span class="ui-mono">{{ confirmTarget?.label }}</span
        >？
      </p>
      <template #footer>
        <Button type="ghost" @click="confirmId = ''">取消</Button>
        <Button type="danger" @click="remove">确认删除</Button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}

.settings__head {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
  padding: var(--ui-space-4);
  background: var(--ui-bg-layer-1);
  -webkit-backdrop-filter: var(--ui-glass-blur);
  backdrop-filter: var(--ui-glass-blur);
  border: 1px solid var(--ui-border-l1);
  border-radius: var(--ui-radius-panel);
}

.settings__sub {
  margin-top: var(--ui-space-1);
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-label-tertiary);
}

.settings__head-spacer {
  flex: 1;
}

.settings__list {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}

.provider {
  display: flex;
  align-items: flex-start;
  gap: var(--ui-space-4);
  padding: var(--ui-space-3) var(--ui-space-4);
  background: var(--ui-bg-layer-1);
  -webkit-backdrop-filter: var(--ui-glass-blur);
  backdrop-filter: var(--ui-glass-blur);
  border: 1px solid var(--ui-border-l1);
  border-radius: var(--ui-radius-4);
  transition:
    box-shadow var(--ui-duration-fast) var(--ui-ease-standard),
    transform var(--ui-duration-fast) var(--ui-ease-standard);
}

/* 条目自身带操作按钮，鼠标进入即算交互态：抬起 + 交互态阴影 */
.provider:hover {
  box-shadow: var(--ui-shadow-hover);
  transform: var(--ui-lift-hover-sm);
}

.provider__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
}

.provider__line {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
}

.provider__label {
  font-size: var(--ui-font-size-base);
  font-weight: var(--ui-font-weight-medium);
  color: var(--ui-text-label-primary);
}

.provider__id,
.provider__time,
.provider__result {
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-caption);
}

.provider__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-3);
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-label-tertiary);
}

.provider__url,
.provider__key {
  font-size: var(--ui-font-size-caption);
}

.provider__key {
  color: var(--ui-text-caption);
}

.provider__models {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-1);
}

.provider__model {
  padding: 1px var(--ui-space-1);
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-label-secondary);
  background: var(--ui-bg-layer-2);
  border: 1px solid var(--ui-border-l1);
  border-radius: var(--ui-radius-1);
}

.provider__actions {
  display: flex;
  gap: var(--ui-space-2);
}

.settings__form {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
}

.field__label {
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-caption);
}

.settings__confirm {
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-label-secondary);
  line-height: var(--ui-line-height-loose);
}
</style>

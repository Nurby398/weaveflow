<script setup>
/**
 * 知识库管理页（设计评审 P0-4）
 * ------------------------------------------------------------------
 * 后端接口早已就绪（knowledgeApi.list/create/remove），只是此前没有前端界面。
 * 契约（真后端）：doc = { id, name, bytes, isPlatform, createdAt }；列表不带正文；
 * 创建收 { name(1..200), content(≤200000) }；平台文档（isPlatform）只读，删除回 403。
 */
import { computed, onMounted, ref } from 'vue'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import Empty from '@/components/ui/Empty.vue'
import Input from '@/components/ui/Input.vue'
import Modal from '@/components/ui/Modal.vue'
import Textarea from '@/components/ui/Textarea.vue'
import { knowledgeApi, logApiError, toFriendlyError } from '@/api'
import { relativeTime } from '@/lib/format'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const docs = ref([])
const loading = ref(false)
const loadError = ref('')

const createOpen = ref(false)
const form = ref({ name: '', content: '' })
const submitting = ref(false)
const formError = ref('')

const removing = ref(null)
const confirmRemove = ref(false)

const MAX_CONTENT = 200_000
const contentLength = computed(() => form.value.content.length)

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    docs.value = await knowledgeApi.list()
  } catch (error) {
    logApiError(error, 'knowledge')
    loadError.value = toFriendlyError(error)
  } finally {
    loading.value = false
  }
}

onMounted(load)

function openCreate() {
  form.value = { name: '', content: '' }
  formError.value = ''
  createOpen.value = true
}

async function submitCreate() {
  if (!form.value.name.trim()) {
    formError.value = '请填写文档名'
    return
  }
  if (!form.value.content) {
    formError.value = '请填写文档正文（纯文本）'
    return
  }
  if (form.value.content.length > MAX_CONTENT) {
    formError.value = `正文超长：${form.value.content.length} / ${MAX_CONTENT} 字符`
    return
  }
  submitting.value = true
  formError.value = ''
  try {
    await knowledgeApi.create({ name: form.value.name.trim(), content: form.value.content })
    toast.success('已创建知识文档')
    createOpen.value = false
    await load()
  } catch (error) {
    logApiError(error, 'knowledge')
    formError.value = toFriendlyError(error)
  } finally {
    submitting.value = false
  }
}

async function removeDoc() {
  const doc = removing.value
  if (!doc) return
  try {
    await knowledgeApi.remove(doc.id)
    toast.success('已删除知识文档')
    confirmRemove.value = false
    await load()
  } catch (error) {
    logApiError(error, 'knowledge')
    toast.error(toFriendlyError(error))
  } finally {
    removing.value = null
  }
}

function askRemove(doc) {
  removing.value = doc
  confirmRemove.value = true
}

function formatBytes(bytes) {
  const n = Number(bytes ?? 0)
  if (n >= 1_048_576) return `${(n / 1_048_576).toFixed(1)} MB`
  if (n >= 1024) return `${Math.round(n / 1024)} KB`
  return `${n} B`
}
</script>

<template>
  <section class="kb">
    <header class="kb__head">
      <h2 class="kb__title">知识库</h2>
      <Badge tone="neutral">{{ docs.length }}</Badge>
      <Button type="primary" size="sm" @click="openCreate">新建文档</Button>
    </header>

    <Empty v-if="loadError" icon="warning" title="读取知识库失败" :description="loadError">
      <Button type="info" @click="load()">重试</Button>
    </Empty>

    <Empty
      v-else-if="!loading && !docs.length"
      icon="knowledge"
      title="还没有知识文档"
      description="知识文档是给智能体注入的纯文本资料，新建后可在智能体编辑里挂载。"
    >
      <Button type="primary" @click="openCreate">新建文档</Button>
    </Empty>

    <div v-else class="kb__list">
      <div v-for="doc in docs" :key="doc.id" class="kb__row">
        <div class="kb__row-main">
          <span class="kb__row-name">{{ doc.name }}</span>
          <Badge v-if="doc.isPlatform" tone="primary">平台</Badge>
          <span class="ui-mono kb__row-meta">{{ formatBytes(doc.bytes) }} · {{ relativeTime(doc.createdAt) }}</span>
        </div>
        <Button v-if="!doc.isPlatform" type="ghost" size="sm" :aria-label="`删除 ${doc.name}`" @click="askRemove(doc)">
          删除
        </Button>
        <span v-else class="kb__row-readonly ui-mono">只读</span>
      </div>
    </div>

    <!-- 新建 -->
    <Modal v-model="createOpen" title="新建知识文档" width="560px">
      <div class="kb__form">
        <label class="kb__field">
          <span class="kb__label">文档名</span>
          <Input v-model="form.name" aria-label="文档名" maxlength="200" placeholder="如：毕业论文格式规范" />
        </label>
        <label class="kb__field">
          <span class="kb__label">正文（纯文本，≤ 200000 字符）</span>
          <Textarea v-model="form.content" aria-label="正文" :rows="10" placeholder="粘贴或输入要注入给智能体的资料…" />
          <span class="ui-mono kb__count">{{ contentLength }} / {{ MAX_CONTENT }}</span>
        </label>
        <p v-if="formError" class="kb__error" role="alert">{{ formError }}</p>
      </div>
      <template #footer>
        <Button type="ghost" @click="createOpen = false">取消</Button>
        <Button type="primary" :loading="submitting" @click="submitCreate">创建</Button>
      </template>
    </Modal>

    <!-- 删除确认 -->
    <Modal v-model="confirmRemove" title="删除知识文档" width="420px">
      <p class="kb__confirm">确认删除「{{ removing?.name }}」？挂载它的智能体将不再注入这份资料。</p>
      <template #footer>
        <Button type="ghost" @click="confirmRemove = false">取消</Button>
        <Button type="danger" @click="removeDoc">确认删除</Button>
      </template>
    </Modal>
  </section>
</template>

<style scoped>
.kb {
  padding: var(--ui-space-6);
}

.kb__head {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  margin-bottom: var(--ui-space-4);
}

.kb__title {
  margin: 0;
  font-family: var(--ui-font-display);
  font-size: var(--ui-font-size-lg);
  color: var(--ui-text-label-primary);
}

.kb__list {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}

.kb__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-3);
  padding: var(--ui-space-3);
  border: 1px solid var(--ui-border-l2);
  border-radius: var(--ui-radius-3);
}

.kb__row-main {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
}

.kb__row-name {
  color: var(--ui-text-label-primary);
}

.kb__row-meta {
  color: var(--ui-text-label-secondary);
  font-size: var(--ui-font-size-sm);
}

.kb__row-readonly {
  color: var(--ui-text-label-secondary);
  font-size: var(--ui-font-size-sm);
}

.kb__form {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
}

.kb__field {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}

.kb__label {
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-label-secondary);
}

.kb__count {
  align-self: flex-end;
  color: var(--ui-text-label-secondary);
  font-size: var(--ui-font-size-caption);
}

.kb__error {
  margin: 0;
  color: var(--ui-text-label-primary);
}

.kb__confirm {
  margin: 0;
  color: var(--ui-text-label-secondary);
}
</style>

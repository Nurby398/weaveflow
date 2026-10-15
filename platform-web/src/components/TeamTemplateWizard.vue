<script setup>
/**
 * 团队模板向导（Paperclip 参照 · §C2 团队模板）
 * ------------------------------------------------------------------
 * 一键把「毕设流水线」的骨架搭好：团队 + ①–⑤ 五个外部智能体（阶段号、角色提示词预填），
 * 用户只需填东软上游的 baseUrl / 每个智能体的 id 与 appKey。
 *
 * 为什么不做"静默全自动"：外部智能体的 appKey 明文只进不出，前端拿不到；
 * 平台公共智能体又只读（403），不能挂进私有团队 —— 所以模板 = 预填 + 收集密钥，逐个创建。
 * 后端可选的"模板接口"（FE-B22）到位后，这里可改成由服务端预置模板；当前纯前端。
 */
import { computed, reactive, ref } from 'vue'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Modal from '@/components/ui/Modal.vue'
import { agentApi, logApiError, teamApi, toFriendlyError } from '@/api'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'created'])

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

/** 模板预设：名称与阶段号与平台真实智能体一致；提示词为中性角色说明，不搬原始资产 */
const STAGES = [
  { name: '①毕设选题与立项顾问', stageNo: 1, prompt: '评估选题可行性，产出选题与立项建议。' },
  { name: '②需求分析与开题工程师', stageNo: 2, prompt: '把选题整理成可执行的需求与开题报告。' },
  { name: '③架构与数据库设计工程师', stageNo: 3, prompt: '产出系统架构、模块划分与数据库设计。' },
  { name: '④代码开发与测试工程师', stageNo: 4, prompt: '实现核心模块并补齐测试与运行说明。' },
  { name: '⑤毕业论文规范工程师', stageNo: 5, prompt: '按规范检查论文结构、格式与表述。' },
]

const EXAMPLE_BASE_URL = import.meta.env.VITE_EXTERNAL_AGENT_BASE_URL || 'https://your-agent.example.com'

const teamName = ref('我的毕设流水线')
const baseUrl = ref(EXAMPLE_BASE_URL)
const rows = reactive(STAGES.map((stage) => ({ ...stage, agentId: '', appKey: '' })))
const submitting = ref(false)
const done = ref(false)
const summary = ref('')

function reset() {
  teamName.value = '我的毕设流水线'
  baseUrl.value = EXAMPLE_BASE_URL
  for (const row of rows) {
    row.agentId = ''
    row.appKey = ''
  }
  done.value = false
  summary.value = ''
}

/** 必填校验：团队名 + 每个外部智能体的上游 id 与 appKey */
function invalidFields() {
  const missing = []
  if (!teamName.value.trim()) missing.push('团队名')
  if (!baseUrl.value.trim()) missing.push('接入地址')
  for (const row of rows) {
    if (!row.agentId.trim()) missing.push(`${row.name} 的上游 id`)
    if (!row.appKey.trim()) missing.push(`${row.name} 的 appKey`)
  }
  return missing
}

async function submit() {
  const missing = invalidFields()
  if (missing.length) {
    summary.value = `还缺：${missing.join('、')}`
    return
  }
  submitting.value = true
  summary.value = ''
  try {
    const team = await teamApi.create({ name: teamName.value.trim(), description: '毕设流水线（模板创建）' })
    let ok = 0
    let fail = 0
    for (const row of rows) {
      try {
        await agentApi.create({
          name: row.name,
          teamId: team.id,
          stageNo: row.stageNo,
          systemPrompt: row.prompt,
          providerCredId: null,
          model: null,
          knowledgeDocIds: [],
          outputSchema: null,
          sort: row.stageNo * 10,
          sourceType: 'external',
          externalBaseUrl: baseUrl.value.trim().replace(/\/+$/, ''),
          externalAgentId: row.agentId.trim(),
          externalToken: row.appKey.trim(),
        })
        ok += 1
      } catch (error) {
        logApiError(error, 'team-template')
        fail += 1
        summary.value = summary.value ? `${summary.value}；${row.name} 创建失败` : `${row.name} 创建失败`
      }
    }
    if (ok) {
      done.value = true
      summary.value = `已创建团队与 ${ok} 个智能体${fail ? `，${fail} 个失败` : ''}`
      emit('created')
    }
  } catch (error) {
    logApiError(error, 'team-template')
    summary.value = `创建团队失败：${toFriendlyError(error)}`
  } finally {
    submitting.value = false
  }
}

function close() {
  visible.value = false
  reset()
}
</script>

<template>
  <Modal v-model="visible" title="用模板创建毕设流水线" width="620px">
    <div v-if="!done" class="tw">
      <p class="tw__hint">预填 ①–⑤ 五个外部智能体的名称、阶段号与角色提示词；你只需填入东软上游信息。</p>

      <label class="tw__field">
        <span class="tw__label">团队名</span>
        <Input v-model="teamName" aria-label="团队名" maxlength="120" />
      </label>

      <label class="tw__field">
        <span class="tw__label">接入地址（五个智能体共用）</span>
        <Input v-model="baseUrl" aria-label="接入地址" placeholder="https://your-agent.example.com" />
      </label>

      <div class="tw__rows">
        <div v-for="row in rows" :key="row.stageNo" class="tw__row">
          <div class="tw__row-head">
            <span class="tw__row-name">{{ row.name }}</span>
            <Badge tone="neutral">阶段 {{ row.stageNo }}</Badge>
          </div>
          <div class="tw__row-inputs">
            <Input v-model="row.agentId" :aria-label="`${row.name} 上游 id`" placeholder="上游智能体 id" />
            <Input v-model="row.appKey" type="password" :aria-label="`${row.name} appKey`" placeholder="appKey" />
          </div>
        </div>
      </div>

      <p v-if="summary" class="tw__summary" role="alert">{{ summary }}</p>

      <div class="tw__actions">
        <Button type="ghost" size="sm" @click="close">取消</Button>
        <Button type="primary" size="sm" :loading="submitting" @click="submit">创建</Button>
      </div>
    </div>

    <div v-else class="tw tw--done">
      <p class="tw__done-text">{{ summary }}</p>
      <p class="tw__hint">到「智能体团队」页给成员排序，或去「运行历史」启动流水线。</p>
      <div class="tw__actions">
        <Button type="primary" size="sm" @click="close">完成</Button>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.tw {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}

.tw__hint {
  margin: 0;
  color: var(--ui-text-label-secondary);
  line-height: var(--ui-line-height-loose);
}

.tw__field {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}

.tw__label {
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-label-secondary);
}

.tw__rows {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
  max-height: 42vh;
  overflow: auto;
}

.tw__row {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
  padding: var(--ui-space-3);
  border: 1px solid var(--ui-border-l2);
  border-radius: var(--ui-radius-3);
}

.tw__row-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-2);
}

.tw__row-name {
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-label-primary);
}

.tw__row-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--ui-space-2);
}

.tw__summary {
  margin: 0;
  color: var(--ui-text-label-secondary);
}

.tw__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--ui-space-2);
}

.tw__done-text {
  margin: 0;
  color: var(--ui-text-label-primary);
}
</style>

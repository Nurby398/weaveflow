<script setup>
/**
 * 流水线运行页
 * ------------------------------------------------------------------
 * 后端契约（已按 platform-server 的真实响应定稿，见 src/services/pipeline.ts）：
 *   GET  /pipeline/:runId   → { run: { id, teamId, currentStage, status, stageCount, createdAt },
 *                              stages: [{ stageNo, agentId, agentName, conversationId, status,
 *                                         artifact: { validated, missingFields, contractJson, bodyChars } | null }] }
 *     · stages 与 run **平级**（由 api 层并进 run.stages）
 *     · stageNo 是 0 基，页面内部一律用 0 基做选中键，展示时 +1
 *     · status ∈ pending | waiting | validated | failed
 *   POST /pipeline/:runId/advance → 200 { run, stage, artifact, next, completed, injection }
 *                                   422 CONTRACT_INVALID（带 missing/orderIssues/typeIssues 与 retryAllowed）
 *
 * 页面的核心价值是把 422 的 details 渲染成人能读的清单：缺哪些字段、顺序错在哪、
 * 以及 retryAllowed（还能重试几次）——这些信息此前只在接口里存在，浏览器里看不到。
 *
 * 布局取舍：契约面板置于阶段进度条下方、通栏且内部滚动，流转按钮放页头。
 * 这样在窄窗口（内容区被压缩、甚至只露出上半屏）时，「能不能流转」与「还差什么」
 * 依然在第一屏可见，不必先滚动到页面底部。
 * ------------------------------------------------------------------
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import Empty from '@/components/ui/Empty.vue'
import Modal from '@/components/ui/Modal.vue'
import Steps from '@/components/ui/Steps.vue'
import Textarea from '@/components/ui/Textarea.vue'
import { logApiError, pipelineApi, toFriendlyError } from '@/api'
import { useToast } from '@/composables/useToast'
import {
  describeValueDrift,
  formatIndex,
  normalizeContractDetails,
  pickContractFailure,
  retryHint,
} from '@/lib/contract'
import { renderMarkdown } from '@/lib/markdown'
import { shortId } from '@/lib/format'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const runId = computed(() => String(route.params.runId || ''))

const run = ref(null)
const loading = ref(false)
const loadError = ref('')
const advancing = ref(false)
/** 最近一次 advance 返回的契约失败（422） */
const contractFailure = ref(null)
const selectedStageNo = ref('')
/** 人工打回（审批门 · FE-B21 未就绪时降级提示） */
const rejectOpen = ref(false)
const rejectReason = ref('')
const rejecting = ref(false)
const rejectNotice = ref('')

/** 后端阶段状态 → 文案 / Badge 配色（取值见 StageStatus） */
const STATUS_TEXT = { pending: '待开始', waiting: '等待产出', validated: '已校验', failed: '失败' }
const STATUS_TONE = { pending: 'neutral', waiting: 'primary', validated: 'success', failed: 'danger' }

function statusKeyOf(stage) {
  const status = String(stage?.status || 'pending').toLowerCase()
  return STATUS_TEXT[status] ? status : 'pending'
}

function statusTextOf(stage) {
  const status = String(stage?.status || 'pending').toLowerCase()
  return STATUS_TEXT[status] || status
}

function toneOf(stage) {
  return STATUS_TONE[statusKeyOf(stage)] || 'neutral'
}

/** 阶段标识：真后端 stageNo 为 0 基；缺失时退回数组下标，保持 0 基语义 */
function stageKeyOf(stage, index) {
  return Number.isInteger(stage?.stageNo) ? stage.stageNo : index
}

const stages = computed(() => (Array.isArray(run.value?.stages) ? run.value.stages : []))

const stepItems = computed(() =>
  stages.value.map((stage, index) => ({
    stageNo: stageKeyOf(stage, index),
    label: agentNameOf(stage, index),
    status: statusKeyOf(stage),
  })),
)

const selectedStage = computed(() => {
  const list = stages.value
  const bySelection = list.find((stage, index) => String(stageKeyOf(stage, index)) === String(selectedStageNo.value))
  if (bySelection) return bySelection
  const byCurrent = list.find((stage, index) => String(stageKeyOf(stage, index)) === String(run.value?.currentStage))
  return byCurrent || list[0] || null
})

const selectedIndex = computed(() => stages.value.indexOf(selectedStage.value))

/** 选中阶段的展示序号（1 基） */
const selectedStageLabel = computed(() =>
  selectedStage.value ? stageKeyOf(selectedStage.value, selectedIndex.value) + 1 : '—',
)

const selectedIsCurrent = computed(() => {
  if (!selectedStage.value) return false
  const no = stageKeyOf(selectedStage.value, selectedIndex.value)
  return String(no) === String(run.value?.currentStage)
})

/** 产出正文的来源：body（会话正文）/ contract-json（服务端只回契约块）/ none */
const outputSource = computed(() => {
  const stage = selectedStage.value
  if (!stage) return 'none'
  if (typeof stage.output === 'string' && stage.output) return 'body'
  return stage.artifact?.contractJson ? 'contract-json' : 'none'
})

const outputText = computed(() => {
  const stage = selectedStage.value
  if (!stage) return ''
  if (outputSource.value === 'body') return stage.output
  if (outputSource.value === 'contract-json') {
    return `\`\`\`json\n${JSON.stringify(stage.artifact.contractJson, null, 2)}\n\`\`\``
  }
  return ''
})

const renderedOutput = computed(() => renderMarkdown(outputText.value))

/** 面板优先展示「最近一次 advance 的失败」，前提是用户正看着当前阶段 */
const contract = computed(() => {
  if (contractFailure.value && selectedIsCurrent.value) return contractFailure.value
  return contractOf(selectedStage.value)
})

const contractPassed = computed(() => contract.value?.ok === true)

const hasIssueList = computed(() => {
  const value = contract.value
  if (!value) return false
  return (
    value.missing.length > 0 ||
    value.extra.length > 0 ||
    value.orderIssues.length > 0 ||
    value.typeIssues.length > 0 ||
    value.valueDrift.length > 0
  )
})

/* ---------------------------- 真实字段取值 ---------------------------- */

function agentNameOf(stage, index) {
  return stage?.agentName || `阶段 ${stageKeyOf(stage, index) + 1}`
}

/**
 * 阶段契约结论：真后端只把「通过与否 + 缺失字段」落库进 stage_artifacts，
 * 顺序 / 类型 / 多余字段的清单只出现在 advance 的 422 详情里（detail 面板会优先显示它）。
 */
function contractOf(stage) {
  const artifact = stage?.artifact
  if (!artifact || typeof artifact !== 'object') return null
  return normalizeContractDetails({
    ok: artifact.validated === true,
    missing: Array.isArray(artifact.missingFields) ? artifact.missingFields : [],
  })
}

/* ------------------------------- 加载 ------------------------------- */

async function load({ silent = false } = {}) {
  if (!runId.value) return
  if (!silent) loading.value = true
  try {
    const data = await pipelineApi.get(runId.value)
    run.value = data
    loadError.value = ''
    const known = stages.value.some(
      (stage, index) => String(stage.stageNo ?? index + 1) === String(selectedStageNo.value),
    )
    if (!known) {
      selectedStageNo.value = String(data?.currentStage ?? stages.value[0]?.stageNo ?? '')
    }
  } catch (error) {
    logApiError(error, 'pipeline')
    loadError.value = toFriendlyError(error)
  } finally {
    loading.value = false
  }
}

onMounted(load)

/* ------------------------------ 流转 ------------------------------ */

async function advance() {
  if (advancing.value) return
  advancing.value = true
  contractFailure.value = null
  try {
    const result = await pipelineApi.advance(runId.value)
    // 真后端 200：{ run, stage, artifact, next, completed }；next=null 即已是最后阶段
    if (result?.completed) {
      toast.success('最后阶段契约校验通过，流水线已完成')
      await load({ silent: true })
      return
    }
    const nextConversationId = result?.next?.conversationId || ''
    toast.success('契约校验通过，已流转到下一阶段')
    if (nextConversationId) {
      router.push(`/chat/${nextConversationId}`)
      return
    }
    // 后端未回下一阶段会话 id 时原地刷新，避免把用户丢到空白页
    await load({ silent: true })
  } catch (error) {
    const failure = pickContractFailure(error)
    if (failure) {
      contractFailure.value = failure
      selectedStageNo.value = String(run.value?.currentStage ?? selectedStageNo.value)
      toast.warning(failure.message)
      // 失败也已落库（stage_artifacts.validated=false），刷新一次让阶段状态与落库结论对齐
      load({ silent: true })
      return
    }
    logApiError(error, 'pipeline')
    toast.error(toFriendlyError(error))
  } finally {
    advancing.value = false
  }
}

/**
 * 人工打回当前阶段（审批门 · Paperclip 参照 §A2）。
 * 后端 `POST /api/pipeline/:runId/reject` 未实现（FE-B21）时回 404/501 → 明确降级提示，
 * 而不是让用户误以为是自己的操作失败。
 */
async function doReject() {
  if (!rejectReason.value.trim()) {
    rejectNotice.value = '请填写打回理由'
    return
  }
  rejecting.value = true
  rejectNotice.value = ''
  try {
    await pipelineApi.reject(runId.value, { reason: rejectReason.value.trim() })
    toast.success('已打回当前阶段')
    rejectOpen.value = false
    rejectReason.value = ''
    await load({ silent: true })
  } catch (error) {
    if (error?.status === 404 || error?.status === 501) {
      rejectNotice.value = '人工打回需后端支持（FE-B21 未就绪）；当前仅契约校验会自动打回。'
    } else {
      logApiError(error, 'pipeline-reject')
      toast.error(toFriendlyError(error))
    }
  } finally {
    rejecting.value = false
  }
}

function selectStage(step) {
  selectedStageNo.value = String(step?.stageNo ?? '')
}
</script>

<template>
  <div class="pipeline">
    <header class="pipeline__head">
      <h2>流水线</h2>
      <Badge v-if="run?.status" :tone="run.status === 'failed' ? 'danger' : 'info'" dot>
        {{ run.status }}
      </Badge>
      <span class="ui-mono pipeline__run-id">#{{ shortId(runId) }}</span>
      <!-- 主操作紧贴标题，窄窗口下也不会被挤出可视区；次操作用户会找，靠右即可 -->
      <Button v-if="run" type="primary" size="sm" :loading="advancing" @click="advance"> 审批通过并流转 </Button>
      <Button v-if="run" type="ghost" size="sm" :loading="rejecting" @click="rejectOpen = true"> 打回 </Button>
      <div class="pipeline__head-actions">
        <Button type="ghost" size="sm" :loading="loading" @click="load()">刷新</Button>
        <Button type="info" size="sm" @click="router.push('/')">返回工作台</Button>
      </div>
    </header>

    <Empty v-if="loadError" icon="warning" title="读取流水线失败" :description="loadError">
      <Button type="info" @click="load()">重试</Button>
    </Empty>

    <Empty v-else-if="!loading && !run" icon="box" title="没有这条流水线" description="请从团队或工作台重新启动。" />

    <template v-else-if="run">
      <Steps
        :steps="stepItems"
        :active-stage="selectedStage ? stageKeyOf(selectedStage, selectedIndex) : ''"
        @select="selectStage"
      />

      <!-- ---------------------------- 契约校验结果 ---------------------------- -->
      <section class="contract" :class="{ 'is-passed': contractPassed, 'is-failed': contract && !contractPassed }">
        <header class="contract__head">
          <span class="contract__title">审批门 · 契约校验</span>
          <Badge v-if="!contract" tone="neutral">待审批</Badge>
          <Badge v-else-if="contractPassed" tone="success">审批通过</Badge>
          <Badge v-else tone="danger">打回（校验未通过）</Badge>
          <span v-if="contract?.code" class="ui-mono contract__code">{{ contract.code }}</span>
          <span class="ui-mono contract__scope">流转对象：当前阶段 #{{ (run.currentStage ?? 0) + 1 }}</span>
        </header>

        <p v-if="contract?.message" class="contract__message">{{ contract.message }}</p>

        <template v-if="contract && !contractPassed">
          <!-- 重试预算：这个信息此前完全不可见，必须显式给出 -->
          <p class="contract__retry" :class="{ 'is-blocked': !contract.retryAllowed }">
            <span class="ui-mono contract__retry-budget">
              {{ contract.retryAllowed ? 'retryAllowed: true' : 'retryAllowed: false' }}
            </span>
            <span>{{ retryHint(contract) }}</span>
            <span v-if="contract.maxRetries" class="ui-mono contract__retry-max">
              maxRetries: {{ contract.maxRetries }}
            </span>
          </p>

          <div v-if="contract.missing.length" class="contract__group">
            <span class="contract__group-label">缺失字段（{{ contract.missing.length }}）</span>
            <ul class="contract__list">
              <li v-for="field in contract.missing" :key="field" class="ui-mono contract__item">
                {{ field }}
              </li>
            </ul>
          </div>

          <div v-if="contract.extra.length" class="contract__group">
            <span class="contract__group-label">多余字段（{{ contract.extra.length }}）</span>
            <ul class="contract__list">
              <li v-for="field in contract.extra" :key="field" class="ui-mono contract__item">{{ field }}</li>
            </ul>
          </div>

          <div v-if="contract.orderIssues.length" class="contract__group">
            <span class="contract__group-label">顺序问题（{{ contract.orderIssues.length }}）</span>
            <ul class="contract__list">
              <li v-for="(issue, index) in contract.orderIssues" :key="index" class="contract__item">
                <span class="ui-mono contract__field">{{ issue.field || '—' }}</span>
                <span class="contract__detail">应在{{ formatIndex(issue.expectedIndex) }}</span>
                <span class="contract__detail">实际在{{ formatIndex(issue.actualIndex) }}</span>
                <span class="contract__detail">
                  该位置被
                  <span class="ui-mono contract__field">{{ issue.occupiedBy || '—' }}</span>
                  占用
                </span>
              </li>
            </ul>
          </div>

          <div v-if="contract.typeIssues.length" class="contract__group">
            <span class="contract__group-label">类型问题（{{ contract.typeIssues.length }}）</span>
            <ul class="contract__list">
              <li v-for="(issue, index) in contract.typeIssues" :key="index" class="contract__item">
                <span class="ui-mono contract__field">{{ issue.field || '—' }}</span>
                <span class="contract__detail">期望 {{ issue.expected || '—' }}</span>
                <span class="contract__detail">实际 {{ issue.actual || '—' }}</span>
              </li>
            </ul>
          </div>

          <div v-if="contract.valueDrift.length" class="contract__group">
            <span class="contract__group-label">值漂移（{{ contract.valueDrift.length }}）</span>
            <ul class="contract__list">
              <li v-for="(drift, index) in contract.valueDrift" :key="index" class="contract__item">
                <span class="ui-mono contract__field">{{ drift.field }}</span>
                <span class="contract__detail">{{ describeValueDrift(drift) }}</span>
              </li>
            </ul>
          </div>

          <p v-if="!hasIssueList" class="contract__message">
            该阶段落库的结论只有「未通过」，清单未随详情返回：请在页头点「确认本阶段产出并流转」重新校验以取回完整清单。
          </p>
        </template>

        <p v-else-if="contractPassed" class="contract__message">本阶段产出符合契约，可以流转到下一阶段。</p>
        <p v-else class="contract__message">尚无校验结果：点击页头「审批通过并流转」后显示。</p>
      </section>

      <div class="pipeline__body">
        <!-- ---------------------------- 阶段列表 ---------------------------- -->
        <aside class="pipeline__list">
          <div class="pipeline__list-head">
            <span class="pipeline__list-title">阶段</span>
            <Badge tone="neutral">{{ stages.length }}</Badge>
          </div>
          <ul class="ui-scroll pipeline__stages">
            <li v-for="(stage, index) in stages" :key="stageKeyOf(stage, index)">
              <button
                class="stage"
                :class="{ 'is-active': stage === selectedStage }"
                type="button"
                @click="selectStage({ stageNo: stageKeyOf(stage, index) })"
              >
                <span class="stage__top">
                  <span class="ui-mono stage__no">{{ String(index + 1).padStart(2, '0') }}</span>
                  <span class="stage__name">{{ agentNameOf(stage, index) }}</span>
                </span>
                <span class="stage__meta">
                  <Badge :tone="toneOf(stage)">{{ statusTextOf(stage) }}</Badge>
                  <Badge v-if="contractOf(stage)?.ok === true" tone="success">已过门</Badge>
                  <Badge v-else-if="contractOf(stage)?.ok === false" tone="danger">打回</Badge>
                  <Badge v-else tone="neutral">待校验</Badge>
                </span>
              </button>
            </li>
          </ul>
        </aside>

        <!-- ---------------------------- 阶段产出 ---------------------------- -->
        <section class="pipeline__detail">
          <header class="pipeline__detail-head">
            <span class="pipeline__detail-title">
              {{ selectedIsCurrent ? '当前阶段产出' : '历史阶段产出' }}
            </span>
            <Badge tone="info">阶段 {{ selectedStageLabel }}</Badge>
            <!-- 真后端不回阶段正文，只回契约块：来源必须标出来，别让人误以为是模型正文 -->
            <Badge v-if="outputSource === 'contract-json'" tone="neutral">契约块 JSON</Badge>
            <span class="stage__agent">
              {{ selectedStage ? agentNameOf(selectedStage, selectedIndex) : '—' }}
            </span>
            <span v-if="selectedStage?.model" class="ui-mono pipeline__model">{{ selectedStage.model }}</span>
          </header>

          <div class="pipeline__content ui-scroll">
            <div v-if="outputText" class="md-body" v-html="renderedOutput" />
            <Empty
              v-else
              size="sm"
              icon="document"
              title="该阶段还没有产出"
              description="本阶段会话还没有 assistant 产出，服务端也没有落库契约块。"
            />
          </div>
        </section>
      </div>
    </template>

    <!-- 人工打回（审批门 · FE-B21 未就绪时接口回 404，降级为明确提示） -->
    <Modal v-model="rejectOpen" title="打回当前阶段" width="420px">
      <p class="pipeline__reject-hint">写明打回理由，智能体会据此修正后重新提交。</p>
      <Textarea
        v-model="rejectReason"
        :rows="3"
        placeholder="如：技术路线不明确，请补充可行性论证"
        aria-label="打回理由"
      />
      <p v-if="rejectNotice" class="pipeline__reject-notice" role="alert">{{ rejectNotice }}</p>
      <template #footer>
        <Button type="ghost" @click="rejectOpen = false">取消</Button>
        <Button type="danger" :loading="rejecting" @click="doReject">确认打回</Button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.pipeline {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
  height: calc(100vh - var(--ui-layout-navbar-height) - var(--ui-space-5) * 2);
}

.pipeline__head {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
}

.pipeline__head-actions {
  display: flex;
  gap: var(--ui-space-2);
  margin-left: auto;
}

.pipeline__run-id {
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-dimmed);
}

/* 契约面板限高并内部滚动：它是最关键的信息，永远留在第一屏，
   清单很长时也不把阶段列表和产出挤出可视区 */
.contract {
  flex: none;
  max-height: 240px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
  padding: var(--ui-space-3) var(--ui-space-4);
  background: var(--ui-bg-layer-1);
  -webkit-backdrop-filter: var(--ui-glass-blur);
  backdrop-filter: var(--ui-glass-blur);
  border: 1px solid var(--ui-border-l1);
  border-left: 3px solid var(--ui-border-l3);
  border-radius: var(--ui-radius-panel);
}

.contract.is-passed {
  border-left-color: var(--ui-success-label);
}

.contract.is-failed {
  border-left-color: var(--ui-danger-label);
  background: var(--ui-danger-fill);
}

.contract__head {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
}

.contract__title {
  font-size: var(--ui-font-size-base);
  font-weight: var(--ui-font-weight-medium);
  color: var(--ui-text-primary);
}

.contract__code {
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-caption);
}

.contract__scope {
  margin-left: auto;
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-caption);
}

.contract__message {
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-secondary);
}

.contract__retry {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  padding: var(--ui-space-1) var(--ui-space-3);
  background: var(--ui-warn-fill);
  border-radius: var(--ui-radius-2);
  font-size: var(--ui-font-size-sm);
  color: var(--ui-warn-label);
}

.contract__retry.is-blocked {
  background: var(--ui-danger-fill);
  color: var(--ui-danger-label);
}

.contract__retry-budget,
.contract__retry-max {
  font-size: var(--ui-font-size-caption);
  opacity: 0.8;
}

.contract__group {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
}

.contract__group-label {
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-caption);
}

.contract__list {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
}

.contract__item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ui-space-3);
  padding: var(--ui-space-1) var(--ui-space-2);
  background: var(--ui-bg-layer-2);
  border: 1px solid var(--ui-border-l1);
  border-radius: var(--ui-radius-1);
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-secondary);
}

.contract__field {
  color: var(--ui-text-primary);
}

.contract__detail {
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-tertiary);
}

.pipeline__body {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: var(--ui-space-3);
}

.pipeline__list {
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

.pipeline__list-head {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  padding: var(--ui-space-2) var(--ui-space-3);
  border-bottom: 1px solid var(--ui-border-l1);
}

.pipeline__list-title {
  flex: 1;
  font-size: var(--ui-font-size-base);
  color: var(--ui-text-primary);
}

.pipeline__stages {
  flex: 1;
  padding: var(--ui-space-2);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
}

.stage {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--ui-space-2);
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

.stage__top {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
}

.stage__meta {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
}

.stage:hover {
  background: var(--ui-interactive-hover-strong);
  box-shadow: var(--ui-shadow-hover);
  transform: var(--ui-lift-hover-sm);
}

.stage.is-active {
  background: var(--ui-interactive-active);
  border-color: var(--ui-border-l3);
}

.stage__no {
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-caption);
}

.stage__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-primary);
}

.pipeline__detail {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
}

.pipeline__detail-head {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
  padding: var(--ui-space-2) var(--ui-space-4);
  background: var(--ui-bg-layer-1);
  -webkit-backdrop-filter: var(--ui-glass-blur);
  backdrop-filter: var(--ui-glass-blur);
  border: 1px solid var(--ui-border-l1);
  border-radius: var(--ui-radius-panel);
}

.pipeline__detail-title {
  font-size: var(--ui-font-size-base);
  font-weight: var(--ui-font-weight-medium);
  color: var(--ui-text-primary);
}

.stage__agent {
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-secondary);
}

.pipeline__model {
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-caption);
}

.pipeline__content {
  flex: 1;
  min-height: 0;
  padding: var(--ui-space-4);
  background: var(--ui-bg-layer-1);
  -webkit-backdrop-filter: var(--ui-glass-blur);
  backdrop-filter: var(--ui-glass-blur);
  border: 1px solid var(--ui-border-l1);
  border-radius: var(--ui-radius-panel);
}

.pipeline__reject-hint {
  margin: 0 0 var(--ui-space-3);
  color: var(--ui-text-label-secondary);
  line-height: var(--ui-line-height-loose);
}

.pipeline__reject-notice {
  margin: var(--ui-space-2) 0 0;
  color: var(--ui-text-label-secondary);
  font-size: var(--ui-font-size-sm);
}
</style>

<script setup>
/**
 * DispatchCard 派发卡片（主对话 · 意图派发）
 * ------------------------------------------------------------------
 * 承载 `event: dispatch` 的四类帧，契约见 docs/主对话意图派发方案-v1.md §3.5：
 *   routed      识别到意图 → 派发给某智能体（阶段 N/M）+ reason
 *   stage-start 阶段进度（复用 ui/Steps）+ 当前阶段名
 *   stage-done  同上 +「确认并进入下一阶段」按钮（单阶段派发的人工确认闸口）
 *   need-confirm 低置信度：候选团队 + 「是」/「不是」，不擅自派发
 *
 * 展示型组件：不做任何请求，动作一律 emit 给使用方。
 * 视觉只取 --ui-* 令牌与既有 ui/* 组件，不自造基础组件。
 * ------------------------------------------------------------------
 */
import { computed } from 'vue'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import Icon from '@/components/ui/Icon.vue'
import Steps from '@/components/ui/Steps.vue'

const props = defineProps({
  /** dispatch 帧的 data 原文（对象） */
  data: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['confirm', 'choose', 'reject'])

/** 已知 kind → 卡片头部（未知 kind 整张不渲染，避免脏数据画出一张空卡） */
const KIND_META = {
  routed: { label: '已派发', tone: 'primary', icon: 'aim' },
  'stage-start': { label: '阶段进行中', tone: 'info', icon: 'timer' },
  'stage-done': { label: '阶段产出待确认', tone: 'success', icon: 'check' },
  'need-confirm': { label: '待你确认', tone: 'warn', icon: 'info' },
}

const meta = computed(() => KIND_META[props.data?.kind] || null)

const stageNo = computed(() => {
  const no = Number(props.data?.stageNo)
  return Number.isFinite(no) && no >= 0 ? no : 0
})

const stageCount = computed(() => {
  const count = Number(props.data?.stageCount)
  return Number.isFinite(count) && count > 0 ? count : 0
})

/** 「阶段 N/M」：stageCount 缺失时退化成「阶段 N」 */
const stageText = computed(() =>
  stageCount.value ? `阶段 ${stageNo.value + 1}/${stageCount.value}` : `阶段 ${stageNo.value + 1}`,
)

/** 当前阶段名：优先智能体名，其次「阶段 N」 */
const stageName = computed(() => props.data?.agentName || `阶段 ${stageNo.value + 1}`)

/**
 * 阶段进度：只从 stageNo/stageCount 推导，「当前及之前」的语义随 kind 变——
 * stage-start 时当前阶段是 running，stage-done 时是 completed。
 * 其它阶段的名称后端不在 dispatch 帧里给，用「阶段 N」占位（Steps 自身也接受不传 label）。
 */
const steps = computed(() => {
  const total = Math.max(stageCount.value, stageNo.value + 1)
  const current = stageNo.value
  const done = props.data?.kind === 'stage-done'
  return Array.from({ length: total }, (_, index) => ({
    stageNo: index,
    label: index === current ? stageName.value : `阶段 ${index + 1}`,
    status: index < current ? 'completed' : index === current ? (done ? 'completed' : 'running') : 'pending',
  }))
})

const candidates = computed(() => (Array.isArray(props.data?.candidates) ? props.data.candidates : []))
/** 「是」＝接受置信度最高的候选（后端按 confidence 降序给出；这里再兜一层） */
const topCandidate = computed(() =>
  candidates.value.reduce(
    (best, item) => (Number(item?.confidence) > Number(best?.confidence) ? item : best),
    candidates.value[0] || null,
  ),
)

const confirming = computed(() => Boolean(props.data?.confirmed))
const resolved = computed(() => Boolean(props.data?.resolved))

function confidenceText(value) {
  const num = Number(value)
  return Number.isFinite(num) ? `${Math.round(num * 100)}%` : '—'
}

function emitConfirm() {
  if (confirming.value) return
  emit('confirm')
}

function emitChoose() {
  if (resolved.value || !topCandidate.value) return
  emit('choose', topCandidate.value)
}

function emitReject() {
  if (resolved.value) return
  emit('reject')
}
</script>

<template>
  <article v-if="meta" class="dispatch" :class="`dispatch--${data.kind}`">
    <header class="dispatch__head">
      <Icon class="dispatch__icon" :name="meta.icon" :size="14" />
      <span class="dispatch__title">{{ meta.label }}</span>
      <Badge v-if="data.kind === 'stage-start' || data.kind === 'stage-done'" :tone="meta.tone">{{ stageText }}</Badge>
      <Badge v-if="data.teamName" tone="neutral">{{ data.teamName }}</Badge>
    </header>

    <!-- routed：识别到意图 → 派发给谁 -->
    <template v-if="data.kind === 'routed'">
      <p class="dispatch__line">
        识别到意图：<strong class="dispatch__intent">{{ data.intent || '（未给出）' }}</strong> → 派发给
        <strong class="dispatch__intent">{{ stageName }}</strong>
        <span class="ui-mono">（{{ stageText }}）</span>
      </p>
    </template>

    <!-- stage-start / stage-done：进度 + 当前阶段 -->
    <template v-else-if="data.kind === 'stage-start' || data.kind === 'stage-done'">
      <!-- 只读：卡片不做阶段点选，传 interactive=false 避免渲染一排可聚焦的空按钮 -->
      <Steps class="dispatch__steps" :steps="steps" :active-stage="stageNo" :interactive="false" />
      <p class="dispatch__line">
        当前阶段：<strong class="dispatch__intent">{{ stageName }}</strong>
        <span class="ui-mono">（{{ stageText }}）</span>
      </p>
    </template>

    <!-- need-confirm：低置信度候选 -->
    <template v-else-if="data.kind === 'need-confirm'">
      <p class="dispatch__line">
        你是想做「<strong class="dispatch__intent">{{ data.intent || '（意图不明）' }}</strong
        >」吗？以下是候选团队：
      </p>
      <ul class="dispatch__candidates">
        <li v-for="candidate in candidates" :key="candidate.teamId || candidate.teamName" class="dispatch__candidate">
          <span class="dispatch__candidate-name">{{ candidate.teamName }}</span>
          <span class="ui-mono dispatch__candidate-conf">置信度 {{ confidenceText(candidate.confidence) }}</span>
        </li>
      </ul>
      <p v-if="!candidates.length" class="dispatch__reason">没有可用候选，请补充一句你的目标再试。</p>
    </template>

    <p v-if="data.reason" class="dispatch__reason">
      <span class="dispatch__reason-label ui-mono">reason</span>
      {{ data.reason }}
    </p>

    <div v-if="data.kind === 'stage-done' || data.kind === 'need-confirm'" class="dispatch__actions">
      <template v-if="data.kind === 'stage-done'">
        <Button type="primary" size="sm" :disabled="confirming" @click="emitConfirm">
          {{ confirming ? '已确认' : '确认并进入下一阶段' }}
        </Button>
      </template>
      <template v-else>
        <Button type="primary" size="sm" :disabled="resolved" @click="emitChoose">是</Button>
        <Button type="ghost" size="sm" :disabled="resolved" @click="emitReject">不是</Button>
      </template>
    </div>
  </article>
</template>

<style scoped>
/* 卡片：与消息流同宽，靠 1px 描边 + 底色差和正文区分开（不加阴影，浮层才有阴影） */
.dispatch {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
  padding: var(--ui-space-4);
  border: 1px solid var(--ui-border-l2);
  border-radius: var(--ui-radius-panel);
  background: var(--ui-bg-layer-2);
  -webkit-backdrop-filter: var(--ui-glass-blur);
  backdrop-filter: var(--ui-glass-blur);
}

.dispatch__head {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
}

.dispatch__icon {
  color: var(--ui-primary-text);
}

.dispatch__title {
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-medium);
  color: var(--ui-text-primary);
}

.dispatch__line {
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-secondary);
  line-height: var(--ui-line-height-base);
}

/* 意图名与智能体名是全卡的信息核心，用主色字标出来 */
.dispatch__intent {
  color: var(--ui-primary-text);
  font-weight: var(--ui-font-weight-medium);
}

/* 理由：一行小字，比正文低一档，不抢主张 */
.dispatch__reason {
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-caption);
  line-height: var(--ui-line-height-base);
}

.dispatch__reason-label {
  margin-right: var(--ui-space-1);
  color: var(--ui-text-dimmed);
}

.dispatch__steps {
  margin: 0;
}

/* 只读窄容器里的「当前阶段」不再用橙底大色块。
   原因：卡片内每项只有一列宽、文字会折行，橙底+橙描边会被撑成一个大胶囊；
   且它与「进行中」的青色状态圈**打架**——而调度场景里"当前阶段"与"进行中"本就指向同一步，
   等于同一格强调两遍、还是两种颜色。改为：去掉色块，左侧留一条细橙条 + 标签加深，
   **序号圈的颜色完全交给状态**（进行中=青、已校验=绿、失败=红）。
   ⚠️ 只覆盖派发卡片内的表现；流水线页（可点选、宽横排）外观一个字都不变。 */
.dispatch__steps :deep(.ui-steps__item.is-active .ui-steps__button) {
  background: transparent;
  border-color: transparent;
  box-shadow: inset 2px 0 0 var(--ui-accent-orange-stroke);
}

.dispatch__steps :deep(.ui-steps__item.is-active .ui-steps__label) {
  color: var(--ui-text-primary);
}

.dispatch__candidates {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}

.dispatch__candidate {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  padding: var(--ui-space-2) var(--ui-space-3);
  border: 1px solid var(--ui-border-l1);
  border-radius: var(--ui-radius-2);
}

.dispatch__candidate-name {
  flex: 1;
  min-width: 0;
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-primary);
}

.dispatch__candidate-conf {
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-caption);
}

.dispatch__actions {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
}
</style>

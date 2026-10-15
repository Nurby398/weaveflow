<script setup>
/**
 * Steps 阶段进度条：序号 + 名称 + 状态色，用于流水线的阶段推进展示。
 * 状态集合与 platform-server 的 StageStatus 一致（pending / waiting / validated / failed），
 * 另保留 running / completed 供非流水线场景使用；未知状态降级为 pending，样式不会塌。
 * 序号一律按数组下标显示（1 基）：后端的 stageNo 是 0 基，直接展示会从 00 开始。
 * 只负责展示与选中，不发起任何请求（数据由使用方传入）。
 */
const props = defineProps({
  /** [{ stageNo, label, status }] */
  steps: { type: Array, default: () => [] },
  /** 当前选中阶段的 stageNo（0 基，与后端一致） */
  activeStage: { type: [Number, String], default: '' },
  /**
   * 是否可交互（可点选阶段）。默认 true，保持既有行为不变（流水线页带 @select）。
   * 只读场景（如主对话的派发卡片）传 false：阶段项渲染成非交互元素，
   * 不再产生一排可聚焦、点了什么也不发生的空按钮。
   */
  interactive: { type: Boolean, default: true },
})

const emit = defineEmits(['select'])

function onSelect(step) {
  if (!props.interactive) return
  emit('select', step)
}

const STATUS_TEXT = {
  pending: '待开始',
  waiting: '等待产出',
  validated: '已校验',
  failed: '失败',
  running: '进行中',
  completed: '已完成',
}

function statusOf(step) {
  const status = String(step?.status || 'pending').toLowerCase()
  return STATUS_TEXT[status] ? status : 'pending'
}

function statusTextOf(step) {
  return STATUS_TEXT[statusOf(step)]
}

function isActive(step, index) {
  const key = step?.stageNo ?? index
  return props.activeStage !== '' && String(props.activeStage) === String(key)
}
</script>

<template>
  <ol class="ui-steps">
    <li
      v-for="(step, index) in steps"
      :key="step.stageNo ?? index"
      class="ui-steps__item"
      :class="[`is-${statusOf(step)}`, { 'is-active': isActive(step, index) }]"
    >
      <component
        :is="interactive ? 'button' : 'div'"
        class="ui-steps__button"
        :class="{ 'is-static': !interactive }"
        :type="interactive ? 'button' : undefined"
        @click="onSelect(step)"
      >
        <span class="ui-steps__mark ui-mono">{{ String(index + 1).padStart(2, '0') }}</span>
        <span class="ui-steps__label">{{ step.label || `阶段 ${index + 1}` }}</span>
        <span class="ui-steps__status">{{ statusTextOf(step) }}</span>
      </component>
    </li>
  </ol>
</template>

<style scoped>
.ui-steps {
  display: flex;
  gap: var(--ui-space-2);
}

.ui-steps__item {
  position: relative;
  flex: 1;
  min-width: 0;
}

/* 阶段之间的连接线：从本项标记右侧延到下一项 */
.ui-steps__item:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 13px;
  left: 34px;
  right: calc(var(--ui-space-2) * -1);
  height: 1px;
  background: var(--ui-border-l2);
}

.ui-steps__button {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--ui-space-1);
  padding: var(--ui-space-2);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--ui-radius-pill);
  text-align: left;
  cursor: pointer;
  transition: background var(--ui-duration-fast) var(--ui-ease-standard);
}

.ui-steps__button:hover,
.ui-steps__item.is-active .ui-steps__button {
  background: var(--ui-bg-layer-2);
}

/* 只读态（interactive=false）：不显示手型、不响应 hover 底色；当前步的橙色点缀仍保留 */
.ui-steps__button.is-static {
  cursor: default;
}

.ui-steps__item:not(.is-active) .ui-steps__button.is-static:hover {
  background: transparent;
}

/* 当前步用活力橙点缀（放在 hover 规则之后，选中态不被 hover 覆盖）——
   依据（用户原话）：「在一些地方加一点活力橙啊这些颜色」 */
.ui-steps__item.is-active .ui-steps__button {
  background: var(--ui-accent-orange-fill);
  border-color: var(--ui-accent-orange-stroke);
}

.ui-steps__item.is-active .ui-steps__mark {
  color: var(--ui-accent-orange-text);
}

.ui-steps__mark {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 1px solid var(--ui-border-l3);
  border-radius: var(--ui-radius-circle);
  background: var(--ui-bg-layer-1);
  -webkit-backdrop-filter: var(--ui-glass-blur);
  backdrop-filter: var(--ui-glass-blur);
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-tertiary);
}

.ui-steps__label {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-secondary);
}

.ui-steps__status {
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-caption);
}

.ui-steps__item.is-active .ui-steps__label {
  color: var(--ui-text-primary);
}

.ui-steps__item.is-running .ui-steps__mark {
  border-color: var(--ui-primary);
  background: var(--ui-info-fill);
  color: var(--ui-primary-text);
}

.ui-steps__item.is-running .ui-steps__status {
  color: var(--ui-primary-text);
}

/* waiting：阶段会话已建、还没产出——用警示色区别于「进行中」 */
.ui-steps__item.is-waiting .ui-steps__mark {
  border-color: var(--ui-warn-label);
  background: var(--ui-warn-fill);
  color: var(--ui-warn-label);
}

.ui-steps__item.is-waiting .ui-steps__status {
  color: var(--ui-warn-label);
}

.ui-steps__item.is-validated .ui-steps__mark {
  border-color: var(--ui-success-label);
  background: var(--ui-success-fill);
  color: var(--ui-success-label);
}

.ui-steps__item.is-validated .ui-steps__status {
  color: var(--ui-success-label);
}

.ui-steps__item.is-completed .ui-steps__mark {
  border-color: var(--ui-success-label);
  background: var(--ui-success-fill);
  color: var(--ui-success-label);
}

.ui-steps__item.is-completed .ui-steps__status {
  color: var(--ui-success-label);
}

.ui-steps__item.is-failed .ui-steps__mark {
  border-color: var(--ui-danger-label);
  background: var(--ui-danger-fill);
  color: var(--ui-danger-label);
}

.ui-steps__item.is-failed .ui-steps__status {
  color: var(--ui-danger-label);
}
</style>

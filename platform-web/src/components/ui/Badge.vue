<script setup>
/**
 * Badge 状态标记：阶段序号、连接状态、语义标签
 * 数值与状态一律等宽（mono 默认开启），这是「科技感」最省力的来源。
 * 实现底座：Element Plus 的 <el-tag>（关闭过渡，避免挂载时出现 EP 的缩放动画）
 */
import { computed } from 'vue'

const props = defineProps({
  /** neutral | primary | info | success | warn | danger */
  tone: { type: String, default: 'neutral' },
  /** sm | md */
  size: { type: String, default: 'sm' },
  mono: { type: Boolean, default: true },
  /** 前置状态圆点 */
  dot: { type: Boolean, default: false },
})

const classes = computed(() => [`ui-badge--${props.tone}`, `ui-badge--${props.size}`, { 'is-mono': props.mono }])
</script>

<template>
  <el-tag class="ui-badge" :class="classes" disable-transitions>
    <span v-if="dot" class="ui-badge__dot" aria-hidden="true" />
    <slot />
  </el-tag>
</template>

<style scoped>
.ui-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-1);
  border: 1px solid transparent;
  /* 标签一律胶囊（用户原话：「我想要毛玻璃，胶囊，半透明的视觉感受」） */
  border-radius: var(--ui-radius-pill);
  font-weight: var(--ui-font-weight-medium);
  line-height: var(--ui-line-height-tight);
  white-space: nowrap;
  /* el-tag 自带 24px 定高与 vertical-align: middle；
     织流标签是内容撑高、按基线对齐，两者都要还原。 */
  height: auto;
  vertical-align: baseline;
}

/* el-tag 会把插槽内容包进 .el-tag__content，
   原来「圆点 + 文本」之间的间距要落到这一层才生效。 */
.ui-badge :deep(.el-tag__content) {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-1);
}

.ui-badge.is-mono {
  font-family: var(--ui-font-mono);
  letter-spacing: 0.02em;
}

.ui-badge--sm {
  padding: 2px var(--ui-space-1);
  font-size: var(--ui-font-size-caption);
}

.ui-badge--md {
  padding: var(--ui-space-1) var(--ui-space-2);
  font-size: var(--ui-font-size-sm);
}

.ui-badge__dot {
  width: 6px;
  height: 6px;
  border-radius: var(--ui-radius-circle);
  background: currentColor;
}

.ui-badge--neutral {
  background: var(--ui-bg-layer-3);
  border-color: var(--ui-border-l2);
  color: var(--ui-text-label-tertiary);
}

.ui-badge--primary,
.ui-badge--info {
  background: var(--ui-info-fill);
  border-color: var(--ui-border-l2);
  color: var(--ui-info-label);
}

.ui-badge--success {
  background: var(--ui-success-fill);
  border-color: var(--ui-border-l2);
  color: var(--ui-success-label);
}

.ui-badge--warn {
  background: var(--ui-warn-fill);
  border-color: var(--ui-border-l2);
  color: var(--ui-warn-label);
}

.ui-badge--danger {
  background: var(--ui-danger-fill);
  border-color: var(--ui-border-l2);
  color: var(--ui-danger-label);
}
</style>

<script setup>
/**
 * Checkbox 复选框：用于知识文档多选、团队智能体勾选
 * 原生 input 保留在可聚焦位置，视觉框由 span 绘制，保证键盘可达。
 * 实现底座：Element Plus 的 <el-checkbox>（勾选状态与键盘可达性由 EP 保证）
 */
defineProps({
  modelValue: { type: Boolean, default: false },
  label: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  /** 标签是否等宽（文档 ID 等场景） */
  mono: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'change'])

function onChange(value) {
  emit('update:modelValue', value)
  emit('change', value)
}
</script>

<template>
  <el-checkbox
    class="ui-checkbox"
    :class="{ 'is-disabled': disabled }"
    :model-value="modelValue"
    :disabled="disabled"
    @update:model-value="onChange"
  >
    <span class="ui-checkbox__label" :class="{ 'is-mono': mono, 'is-checked': modelValue }">
      <slot>{{ label }}</slot>
    </span>
  </el-checkbox>
</template>

<style scoped>
.ui-checkbox {
  display: inline-flex;
  align-items: flex-start;
  gap: var(--ui-space-2);
  cursor: pointer;
  user-select: none;
  /* el-checkbox 默认给每个复选框加 30px 右外边距，织流由使用方的布局控制间距 */
  margin-right: 0;
}

.ui-checkbox.is-disabled {
  cursor: not-allowed;
  color: var(--ui-text-dimmed);
}

/* 视觉框＝原来的 .ui-checkbox__box，现在是 el-checkbox 的 __inner */
.ui-checkbox :deep(.el-checkbox__inner) {
  flex: none;
  width: 14px;
  height: 14px;
  margin-top: 3px;
  border: 1px solid var(--ui-border-l3);
  border-radius: var(--ui-radius-1);
  background: var(--ui-bg-layer-3);
  transition:
    background var(--ui-duration-fast) var(--ui-ease-standard),
    border-color var(--ui-duration-fast) var(--ui-ease-standard);
}

.ui-checkbox :deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
  background: var(--ui-primary);
  border-color: var(--ui-primary);
}

/* 勾：沿用改造前的画法（用两条边拼出的 3×7 对勾） */
.ui-checkbox :deep(.el-checkbox__input.is-checked .el-checkbox__inner)::after {
  content: '';
  position: static;
  display: block;
  box-sizing: border-box;
  width: 3px;
  height: 7px;
  margin: 1px auto 0;
  border: solid var(--ui-primary-inverted);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.ui-checkbox :deep(.el-checkbox__input:not(.is-checked) .el-checkbox__inner)::after {
  content: none;
}

.ui-checkbox :deep(.el-checkbox__original:focus-visible + .el-checkbox__inner) {
  outline: none;
  box-shadow: var(--ui-focus-ring);
}

.ui-checkbox :deep(.el-checkbox__input.is-disabled .el-checkbox__inner) {
  background: var(--ui-bg-skeleton);
  border-color: var(--ui-border-l1);
}

/* el-checkbox 会给标签加 8px 左内边距，织流已用 gap 表达这段间距 */
.ui-checkbox :deep(.el-checkbox__label) {
  padding-left: 0;
  line-height: inherit;
}

.ui-checkbox__label {
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-label-secondary);
  line-height: var(--ui-line-height-base);
}

.ui-checkbox__label.is-mono {
  font-family: var(--ui-font-mono);
}

.ui-checkbox__label.is-checked {
  color: var(--ui-text-label-primary);
}
</style>

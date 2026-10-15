<script setup>
/**
 * Select 下拉选择
 * 实现底座：Element Plus 的 <el-select> + <el-option>。
 * 关闭态的外观（外框 / 字号 / 箭头）仍由本组件决定；
 * 展开后的浮层是 EP 的 popper，外观见 src/styles/element-overrides.css 的 .ui-select-dropdown 一节
 * —— 原生 select 的下拉菜单由操作系统绘制、无法参与主题，改成 EP 之后才真正跟随织流令牌。
 */
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: [String, Number, null], default: '' },
  /** 支持 ['a','b'] 或 [{ label, value, disabled }] */
  options: { type: Array, default: () => [] },
  id: { type: String, default: '' },
  placeholder: { type: String, default: '请选择' },
  disabled: { type: Boolean, default: false },
  invalid: { type: Boolean, default: false },
  /** sm | md */
  size: { type: String, default: 'md' },
  ariaLabel: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue', 'change'])

const normalized = computed(() =>
  props.options.map((item) =>
    typeof item === 'object' && item !== null
      ? { label: String(item.label ?? item.value ?? ''), value: item.value, disabled: !!item.disabled }
      : { label: String(item), value: item, disabled: false },
  ),
)

function onSelect(value) {
  emit('update:modelValue', value)
  emit('change', value)
}
</script>

<template>
  <el-select
    class="ui-select"
    :class="[`ui-select--${size}`, { 'is-disabled': disabled, 'is-invalid': invalid }]"
    :model-value="modelValue"
    :disabled="disabled"
    :placeholder="placeholder"
    :id="id || undefined"
    :aria-invalid="invalid ? 'true' : undefined"
    :aria-label="ariaLabel || undefined"
    popper-class="ui-select-dropdown"
    @update:model-value="onSelect"
  >
    <el-option
      v-for="option in normalized"
      :key="String(option.value)"
      :label="option.label"
      :value="option.value"
      :disabled="option.disabled"
    />
  </el-select>
</template>

<style scoped>
.ui-select {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 100%;
  background: var(--ui-bg-layer-3);
  border: 1px solid var(--ui-border-l2);
  border-radius: var(--ui-radius-2);
  transition: border-color var(--ui-duration-fast) var(--ui-ease-standard);
}

/* el-select 的边框 / 底色 / 阴影画在内层 wrapper 上，织流的外框在根节点上，
   所以内层还原成透明无边；左右内边距与「文字与箭头之间留 4px」对齐改造前
   .ui-select__inner（padding 右 24px）+ 绝对定位箭头（right 12px）的效果。 */
.ui-select :deep(.el-select__wrapper) {
  flex: 1;
  min-width: 0;
  height: 100%;
  min-height: 0;
  padding: 0 var(--ui-space-3);
  gap: var(--ui-space-1);
  border-radius: inherit;
  background: transparent;
  box-shadow: none;
}

.ui-select :deep(.el-select__selection) {
  color: var(--ui-text-label-primary);
  font-family: var(--ui-font-sans);
  font-size: inherit;
}

.ui-select--sm {
  height: 28px;
  font-size: var(--ui-font-size-sm);
}

.ui-select--md {
  height: 36px;
  font-size: var(--ui-font-size-base);
}

.ui-select:hover:not(.is-disabled) {
  border-color: var(--ui-border-l3);
}

.ui-select:focus-within {
  border-color: var(--ui-primary);
  box-shadow: 0 0 0 3px var(--ui-interactive-hover);
}

.ui-select.is-invalid {
  border-color: var(--ui-danger-label);
}

.ui-select.is-disabled {
  opacity: 0.55;
}

/* 箭头：沿用改造前自绘的三角，把 el-select 的 caret 图标换掉 */
.ui-select :deep(.el-select__caret) {
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 5px solid var(--ui-text-tertiary);
  transform: none;
  color: inherit;
  font-size: inherit;
}

.ui-select :deep(.el-select__caret svg) {
  display: none;
}

.ui-select :deep(.el-select__placeholder) {
  color: var(--ui-text-dimmed);
  font-size: inherit;
}

.ui-select :deep(.el-select__placeholder.is-transparent) {
  color: var(--ui-text-label-primary);
}

.ui-select :deep(.el-select__selected-item) {
  color: var(--ui-text-label-primary);
  font-family: var(--ui-font-sans);
  font-size: inherit;
}
</style>

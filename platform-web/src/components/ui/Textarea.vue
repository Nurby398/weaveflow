<script setup>
/**
 * Textarea 多行输入框
 * 实现底座：Element Plus 的 <el-input type="textarea">。
 * 根元素仍是 .ui-textarea（外框 / 焦点态 / 字数统计都挂在这一层，接口与 DOM 结构对外不变）。
 */
import { computed, ref } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  id: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  rows: { type: [String, Number], default: 4 },
  disabled: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false },
  invalid: { type: Boolean, default: false },
  maxlength: { type: [String, Number], default: undefined },
  /** 是否展示字数统计（需同时传 maxlength） */
  showCount: { type: Boolean, default: false },
  resize: { type: String, default: 'vertical' },
  ariaLabel: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue', 'focus', 'blur'])

const textareaRef = ref(null)

const count = computed(() => String(props.modelValue ?? '').length)
const countVisible = computed(() => props.showCount && props.maxlength != null)

function onInput(value) {
  emit('update:modelValue', value)
}

defineExpose({ focus: () => textareaRef.value?.focus() })
</script>

<template>
  <div class="ui-textarea" :class="{ 'is-disabled': disabled, 'is-invalid': invalid }">
    <el-input
      ref="textareaRef"
      type="textarea"
      :model-value="modelValue"
      :id="id || undefined"
      :rows="rows"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :maxlength="maxlength"
      :resize="resize"
      :aria-invalid="invalid ? 'true' : undefined"
      :aria-label="ariaLabel || undefined"
      @update:model-value="onInput"
      @focus="emit('focus', $event)"
      @blur="emit('blur', $event)"
    />
    <div v-if="countVisible" class="ui-textarea__count">{{ count }} / {{ maxlength }}</div>
  </div>
</template>

<style scoped>
.ui-textarea {
  position: relative;
  display: block;
  width: 100%;
  background: var(--ui-bg-layer-3);
  border: 1px solid var(--ui-border-l2);
  border-radius: var(--ui-radius-2);
  transition: border-color var(--ui-duration-fast) var(--ui-ease-standard);
}

.ui-textarea:hover:not(.is-disabled) {
  border-color: var(--ui-border-l3);
}

.ui-textarea:focus-within {
  border-color: var(--ui-primary);
  box-shadow: 0 0 0 3px var(--ui-interactive-hover);
}

.ui-textarea.is-invalid {
  border-color: var(--ui-danger-label);
}

.ui-textarea.is-disabled {
  opacity: 0.55;
}

/* el-textarea 的内层自带 inset 阴影（它自己的边框）、底色与 5px 11px 内边距，
   织流的外框在根节点上，这里把它们全部还原成透明无边。 */
.ui-textarea :deep(.el-textarea__inner) {
  display: block;
  width: 100%;
  padding: var(--ui-space-3);
  border: none;
  border-radius: inherit;
  background: transparent;
  box-shadow: none;
  outline: none;
  color: var(--ui-text-label-primary);
  font-family: var(--ui-font-sans);
  font-size: var(--ui-font-size-base);
  line-height: var(--ui-line-height-base);
  /* el-input 会按「一行」写行内 min-height，这里必须 !important 才能守住织流的下限 */
  min-height: 72px !important;
}

.ui-textarea :deep(.el-textarea__inner:hover),
.ui-textarea :deep(.el-textarea__inner:focus) {
  box-shadow: none;
  outline: none;
}

.ui-textarea :deep(.el-textarea__inner::placeholder) {
  color: var(--ui-text-dimmed);
}

.ui-textarea__count {
  padding: 0 var(--ui-space-3) var(--ui-space-2);
  text-align: right;
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-caption);
}
</style>

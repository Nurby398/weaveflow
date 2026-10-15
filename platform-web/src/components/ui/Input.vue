<script setup>
/**
 * Input 单行输入框
 * 支持 v-model、清除按钮、前后缀插槽、错误态与原生属性透传。
 * 实现底座：Element Plus 的 <el-input>（外框、焦点态、错误态仍由本组件控制）
 */
import { computed, ref } from 'vue'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  type: { type: String, default: 'text' },
  id: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false },
  invalid: { type: Boolean, default: false },
  /** sm | md */
  size: { type: String, default: 'md' },
  maxlength: { type: [String, Number], default: undefined },
  clearable: { type: Boolean, default: false },
  ariaLabel: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue', 'focus', 'blur', 'enter', 'clear'])

const inputRef = ref(null)
const showClear = computed(() => props.clearable && !props.disabled && !props.readonly && props.modelValue !== '')

function onInput(value) {
  emit('update:modelValue', value)
}

function onEnter(event) {
  emit('enter', event.target.value)
}

function clear() {
  emit('update:modelValue', '')
  emit('clear')
  inputRef.value?.focus()
}

defineExpose({ focus: () => inputRef.value?.focus() })
</script>

<template>
  <el-input
    ref="inputRef"
    class="ui-input"
    :class="[`ui-input--${size}`, { 'is-disabled': disabled, 'is-invalid': invalid, 'is-readonly': readonly }]"
    :model-value="modelValue"
    :type="type"
    :id="id || undefined"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
    :maxlength="maxlength"
    :aria-invalid="invalid ? 'true' : undefined"
    :aria-label="ariaLabel || undefined"
    @update:model-value="onInput"
    @focus="emit('focus', $event)"
    @blur="emit('blur', $event)"
    @keyup.enter="onEnter"
  >
    <template v-if="$slots.prefix" #prefix>
      <span class="ui-input__affix" aria-hidden="true"><slot name="prefix" /></span>
    </template>
    <template #suffix>
      <button v-if="showClear" class="ui-input__clear" type="button" aria-label="清空输入" @click="clear">×</button>
      <span v-if="$slots.suffix" class="ui-input__affix" aria-hidden="true"><slot name="suffix" /></span>
    </template>
  </el-input>
</template>

<style scoped>
.ui-input {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2);
  width: 100%;
  background: var(--ui-bg-layer-3);
  border: 1px solid var(--ui-border-l2);
  border-radius: var(--ui-radius-2);
  transition:
    border-color var(--ui-duration-fast) var(--ui-ease-standard),
    background var(--ui-duration-fast) var(--ui-ease-standard);
}

/* el-input 把边框 / 底色 / 内边距画在内层 wrapper 上，织流的外框在根节点上，
   所以内层要还原成「透明、无内边距、无阴影」，间距统一交给 flex gap。 */
.ui-input :deep(.el-input__wrapper) {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0;
  border-radius: inherit;
  background: transparent;
  box-shadow: none;
  gap: var(--ui-space-2);
}

/* el-input 用 margin 给前后缀留间距，这里改由同一套 gap 表达，避免叠加成双倍 */
.ui-input :deep(.el-input__prefix-inner),
.ui-input :deep(.el-input__suffix-inner) {
  gap: var(--ui-space-2);
}

.ui-input :deep(.el-input__prefix-inner) > :last-child,
.ui-input :deep(.el-input__suffix-inner) > :first-child {
  margin: 0;
}

.ui-input--sm {
  height: 28px;
  padding: 0 var(--ui-space-2);
  font-size: var(--ui-font-size-sm);
}

.ui-input--md {
  height: 36px;
  padding: 0 var(--ui-space-3);
  font-size: var(--ui-font-size-base);
}

.ui-input:hover:not(.is-disabled) {
  border-color: var(--ui-border-l3);
}

/* 焦点：只做「边框加粗 + 变色」——不加外发光、不加 box-shadow 环
   依据（用户原话）：「选中效果可以简单点直接加粗变色输入边框，视觉效果流畅自然优先」。
   outline 贴在内侧与 1px 边框叠成 2px，观感是"边框变粗变亮"，且不产生布局位移。
   :not(.is-disabled) 是为了让特异度与上面那条 :hover 规则持平——否则「已聚焦 + 鼠标悬停」
   时 hover 规则会把边框色抢回非焦点色，焦点态就丢了。 */
.ui-input:focus-within:not(.is-disabled) {
  border-color: var(--ui-primary);
  outline: 1px solid var(--ui-primary);
  outline-offset: -1px;
}

.ui-input.is-invalid {
  border-color: var(--ui-danger-label);
}

.ui-input.is-disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.ui-input :deep(.el-input__inner) {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: none;
  background: transparent;
  outline: none;
  /* el-input 把内层输入框的内边距清零并关掉原生外观（-webkit-appearance: none）；
     改造前的输入框用的是浏览器默认值，这里回退到默认值，保证文字起始位置与观感一致。 */
  padding: revert;
  -webkit-appearance: revert;
  appearance: revert;
  /* 跟随外框形状：内层输入的焦点环按元素自身圆角绘制，
     若与 .ui-input 的圆角不一致，就会出现"胶囊环套矩形框"的错位 */
  border-radius: inherit;
  color: var(--ui-text-label-primary);
  font-family: var(--ui-font-sans);
  font-size: inherit;
  /* el-input 会给行内元素设 line-height: 输入框内高，改回改造前的 normal */
  line-height: normal;
}

.ui-input :deep(.el-input__inner::placeholder) {
  color: var(--ui-text-dimmed);
}

/* 焦点由外框统一表达（边框加粗+变色），内层不再自画焦点环，避免两层形状叠在一起 */
.ui-input :deep(.el-input__inner:focus-visible) {
  box-shadow: none;
  outline: none;
}

.ui-input :deep(.el-input__inner:disabled) {
  cursor: not-allowed;
}

.ui-input__affix {
  display: inline-flex;
  align-items: center;
  color: var(--ui-text-tertiary);
  flex: none;
}

.ui-input__clear {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: var(--ui-bg-layer-2);
  color: var(--ui-text-tertiary);
  font-size: var(--ui-font-size-sm);
  line-height: 1;
  cursor: pointer;
}

.ui-input__clear:hover {
  background: var(--ui-interactive-hover-solid);
  color: var(--ui-text-label-primary);
}
</style>

<script setup>
/**
 * Button 基础按钮
 * 视觉变体用 type，原生按钮类型用 nativeType，避免二者冲突。
 * 实现底座：Element Plus 的 <el-button>（视觉变体仍由本组件的 class 决定，
 * 不把 type 透给 EP，否则会叠出 EP 自己的一套配色）。
 */
import { computed } from 'vue'

const props = defineProps({
  /** primary | danger | info | elevated | floating | ghost | text */
  type: { type: String, default: 'info' },
  /** sm | md */
  size: { type: String, default: 'md' },
  /** 原生 type 属性 */
  nativeType: { type: String, default: 'button' },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  block: { type: Boolean, default: false },
  ariaLabel: { type: String, default: '' },
})

const emit = defineEmits(['click'])

const inert = computed(() => props.disabled || props.loading)

const classes = computed(() => [
  `ui-btn--${props.type}`,
  `ui-btn--${props.size}`,
  {
    'is-block': props.block,
    'is-loading': props.loading,
  },
])

function handleClick(event) {
  // loading / disabled 时拦截事件，避免重复提交
  if (inert.value) {
    event.preventDefault()
    event.stopPropagation()
    return
  }
  emit('click', event)
}
</script>

<template>
  <el-button
    class="ui-btn"
    :class="classes"
    :native-type="nativeType"
    :disabled="disabled"
    :aria-disabled="inert ? 'true' : undefined"
    :aria-busy="loading ? 'true' : undefined"
    :aria-label="ariaLabel || undefined"
    @click="handleClick"
  >
    <span v-if="loading" class="ui-btn__spinner" aria-hidden="true" />
    <span v-if="$slots.icon" class="ui-btn__icon" aria-hidden="true"><slot name="icon" /></span>
    <span class="ui-btn__content"><slot /></span>
  </el-button>
</template>

<style scoped>
.ui-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--ui-space-2);
  border: 1px solid transparent;
  /* 胶囊造型（用户原话：「我想要毛玻璃，胶囊，半透明的视觉感受」） */
  border-radius: var(--ui-radius-pill);
  font-family: var(--ui-font-sans);
  font-weight: var(--ui-font-weight-medium);
  line-height: 1;
  cursor: pointer;
  white-space: nowrap;
  /* el-button 默认 vertical-align: middle，织流按钮保持基线对齐 */
  vertical-align: baseline;
  transition:
    background var(--ui-duration-fast) var(--ui-ease-standard),
    color var(--ui-duration-fast) var(--ui-ease-standard),
    border-color var(--ui-duration-fast) var(--ui-ease-standard),
    transform var(--ui-duration-fast) var(--ui-ease-standard);
}

/* el-button 会把默认插槽包进一个 span：原来直接是按钮 flex 子项的
   「转圈 / 图标 / 文字」现在挂到了这个 span 上，间距要下移一层才生效。 */
.ui-btn :deep(> span) {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2);
}

/* 焦点环沿用改造前的浏览器默认行为（el-button 会换成它的 2px 描边 + 1px offset） */
.ui-btn:focus-visible {
  outline: auto;
  outline-offset: 0;
}

/* 按压反馈：轻微缩小，不用变色闪烁 */
.ui-btn:active:not(.is-disabled) {
  transform: scale(0.97);
}

.ui-btn.is-block {
  width: 100%;
}

/* 禁用态一律以 EP 的 .is-disabled 为准：el-button 在 loading 时也会挂上原生 disabled
   属性，而织流原来的 loading 态只是转圈 + 拦截点击（不降透明度、不改光标）。 */
.ui-btn:disabled {
  cursor: pointer;
}

.ui-btn.is-disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

/* 织流自己也有 is-loading（转圈），语义与 EP 的 .is-loading（遮罩层 + 屏蔽指针）不同 */
.ui-btn.is-loading {
  pointer-events: auto;
}

.ui-btn.is-loading::before {
  content: none;
}

.ui-btn--sm {
  height: 28px;
  padding: 0 var(--ui-space-3);
  font-size: var(--ui-font-size-sm);
}

.ui-btn--md {
  height: 36px;
  padding: 0 var(--ui-space-4);
  font-size: var(--ui-font-size-base);
}

/* ------------------------------ 变体 ------------------------------
   变体选择器写两遍类名（.ui-btn.ui-btn--x）：el-button 的
   `.el-button.is-disabled` / `:hover` 等状态规则与单类选择器同特异度，
   这里提高一级，配色只由织流决定，与样式表顺序无关。 */
.ui-btn.ui-btn--primary {
  background: var(--ui-btn-primary-fill);
  /* 青底配深字（对比度高于反白） */
  color: var(--ui-text-on-accent);
  border-color: var(--ui-primary-stroke);
}

.ui-btn.ui-btn--primary:hover:not(.is-disabled) {
  background: var(--ui-btn-primary-hover);
  border-color: var(--ui-btn-primary-hover);
  box-shadow: var(--ui-shadow-1);
  transform: var(--ui-lift-hover-sm);
}

.ui-btn.ui-btn--primary:active:not(.is-disabled) {
  background: var(--ui-primary);
}

.ui-btn.ui-btn--danger {
  background: var(--ui-danger-label);
  color: var(--ui-primary-inverted);
  border-color: var(--ui-danger-label);
}

.ui-btn.ui-btn--danger:hover:not(.is-disabled) {
  filter: brightness(1.1);
}

.ui-btn.ui-btn--info {
  background: var(--ui-btn-info-fill);
  color: var(--ui-text-label-primary);
  border-color: var(--ui-border-l2);
}

.ui-btn.ui-btn--info:hover:not(.is-disabled) {
  background: var(--ui-btn-floating-hover);
  box-shadow: var(--ui-shadow-1);
}

/* 浮起型按钮（elevated / floating）静态就带 shadow-1，hover 升到交互态阴影并抬起 1px。
   依据（用户原话）：「ui 互动效果显著一点，可以适当增加悬浮，阴影等效果」——
   按钮是交互态，加阴影不违反「玻璃底板条不带阴影」的取舍（原则见 base.css）。 */
.ui-btn.ui-btn--elevated {
  background: var(--ui-btn-elevated-fill);
  color: var(--ui-text-label-primary);
  border-color: var(--ui-border-l3);
  box-shadow: var(--ui-shadow-1);
}

.ui-btn.ui-btn--elevated:hover:not(.is-disabled) {
  background: var(--ui-btn-floating-hover);
  box-shadow: var(--ui-shadow-hover);
  transform: var(--ui-lift-hover-sm);
}

.ui-btn.ui-btn--floating {
  background: var(--ui-btn-floating-fill);
  color: var(--ui-text-label-secondary);
  border-color: var(--ui-border-l1);
  box-shadow: var(--ui-shadow-1);
}

.ui-btn.ui-btn--floating:hover:not(.is-disabled) {
  background: var(--ui-btn-floating-hover);
  color: var(--ui-text-label-primary);
  box-shadow: var(--ui-shadow-hover);
  transform: var(--ui-lift-hover-sm);
}

.ui-btn.ui-btn--ghost {
  background: transparent;
  color: var(--ui-text-label-secondary);
}

.ui-btn.ui-btn--ghost:hover:not(.is-disabled) {
  background: var(--ui-interactive-hover);
  color: var(--ui-text-label-primary);
}

.ui-btn.ui-btn--ghost:active:not(.is-disabled) {
  background: var(--ui-btn-ghost-active-fill);
}

.ui-btn.ui-btn--text {
  background: transparent;
  color: var(--ui-primary-text);
  padding-left: var(--ui-space-1);
  padding-right: var(--ui-space-1);
}

.ui-btn.ui-btn--text:hover:not(.is-disabled) {
  color: var(--ui-primary-hover);
  background: var(--ui-interactive-hover);
}

/* ------------------------------ 内部元素 ------------------------------ */
.ui-btn__content {
  display: inline-flex;
  align-items: center;
}

.ui-btn__spinner {
  width: 1em;
  height: 1em;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: ui-btn-spin var(--ui-duration-slow) linear infinite;
}

@keyframes ui-btn-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ui-btn__spinner {
    animation-duration: 1s;
  }
}
</style>

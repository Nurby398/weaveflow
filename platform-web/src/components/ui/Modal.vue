<script setup>
/**
 * Modal 模态框：Teleport 到 body，支持 Esc 关闭、遮罩点击关闭、基础焦点管理
 */
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  width: { type: String, default: '520px' },
  /** 是否显示右上角关闭按钮 */
  closable: { type: Boolean, default: true },
  maskClosable: { type: Boolean, default: true },
  escClosable: { type: Boolean, default: true },
})

const emit = defineEmits(['update:modelValue', 'close', 'opened'])

const dialogRef = ref(null)
let lastActiveElement = null

function close() {
  emit('update:modelValue', false)
  emit('close')
}

function onMaskClick() {
  if (props.maskClosable) close()
}

/** Esc 关闭 + Tab 焦点循环（基础焦点陷阱） */
function onKeydown(event) {
  if (event.key === 'Escape' && props.escClosable) {
    event.stopPropagation()
    close()
    return
  }
  if (event.key !== 'Tab') return
  const nodes = dialogRef.value?.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  )
  const list = nodes ? Array.from(nodes).filter((el) => !el.disabled) : []
  if (!list.length) return
  const first = list[0]
  const last = list[list.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(
  () => props.modelValue,
  async (visible) => {
    if (typeof document === 'undefined') return
    if (visible) {
      lastActiveElement = document.activeElement
      document.body.style.overflow = 'hidden'
      await nextTick()
      dialogRef.value?.focus()
      emit('opened')
    } else {
      document.body.style.overflow = ''
      if (lastActiveElement?.focus) lastActiveElement.focus()
      lastActiveElement = null
    }
  },
)

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="ui-modal">
      <div v-if="modelValue" class="ui-modal" @keydown="onKeydown">
        <div class="ui-modal__mask" @click="onMaskClick" />
        <div
          ref="dialogRef"
          class="ui-modal__panel"
          role="dialog"
          aria-modal="true"
          :aria-label="title || undefined"
          tabindex="-1"
          :style="{ width }"
        >
          <header v-if="title || $slots.header || closable" class="ui-modal__header">
            <slot name="header">
              <h3 class="ui-modal__title">{{ title }}</h3>
            </slot>
            <button v-if="closable" class="ui-modal__close" type="button" aria-label="关闭" @click="close">×</button>
          </header>
          <div class="ui-modal__body">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="ui-modal__footer">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ui-modal {
  position: fixed;
  inset: 0;
  z-index: var(--ui-z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--ui-space-5);
}

.ui-modal__mask {
  position: absolute;
  inset: 0;
  background: var(--ui-mask-2);
}

.ui-modal__panel {
  position: relative;
  max-width: 100%;
  max-height: calc(100vh - var(--ui-space-6) * 2);
  display: flex;
  flex-direction: column;
  background: var(--ui-bg-overlay);
  -webkit-backdrop-filter: var(--ui-glass-blur);
  backdrop-filter: var(--ui-glass-blur);
  border: 1px solid var(--ui-border-l3);
  border-radius: var(--ui-radius-panel);
  /* 浮层阴影最高一档：模态压在所有东西之上（抽屉用 --ui-shadow-3，气泡/通知用 --ui-shadow-2） */
  box-shadow: var(--ui-shadow-4);
  outline: none;
}

.ui-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-3);
  padding: var(--ui-space-4) var(--ui-space-5);
  border-bottom: 1px solid var(--ui-border-l1);
}

.ui-modal__title {
  font-size: var(--ui-font-size-lg);
  font-weight: var(--ui-font-weight-semibold);
  color: var(--ui-text-label-primary);
}

.ui-modal__close {
  flex: none;
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--ui-radius-2);
  background: transparent;
  color: var(--ui-text-tertiary);
  font-size: var(--ui-font-size-lg);
  line-height: 1;
  cursor: pointer;
}

.ui-modal__close:hover {
  background: var(--ui-interactive-hover);
  color: var(--ui-text-label-primary);
}

.ui-modal__body {
  padding: var(--ui-space-5);
  overflow: auto;
  color: var(--ui-text-label-secondary);
}

.ui-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--ui-space-2);
  padding: var(--ui-space-4) var(--ui-space-5);
  border-top: 1px solid var(--ui-border-l1);
}

.ui-modal-enter-active,
.ui-modal-leave-active {
  transition: opacity var(--ui-duration-base) var(--ui-ease-standard);
}

.ui-modal-enter-active .ui-modal__panel,
.ui-modal-leave-active .ui-modal__panel {
  transition: transform var(--ui-duration-base) var(--ui-ease-standard);
}

.ui-modal-enter-from,
.ui-modal-leave-to {
  opacity: 0;
}

.ui-modal-enter-from .ui-modal__panel,
.ui-modal-leave-to .ui-modal__panel {
  transform: scale(0.97) translateY(6px);
}
</style>

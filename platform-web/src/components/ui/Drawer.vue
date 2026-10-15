<script setup>
/**
 * Drawer 抽屉：Teleport 到 body，四向可停靠，同样支持 Esc / 遮罩关闭
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  /** right | left | top | bottom */
  placement: { type: String, default: 'right' },
  size: { type: String, default: '360px' },
  closable: { type: Boolean, default: true },
  maskClosable: { type: Boolean, default: true },
  escClosable: { type: Boolean, default: true },
})

const emit = defineEmits(['update:modelValue', 'close', 'opened'])

const panelRef = ref(null)
let lastActiveElement = null

const panelStyle = computed(() => {
  if (props.placement === 'right' || props.placement === 'left') {
    return { width: props.size, height: '100%' }
  }
  return { height: props.size, width: '100%' }
})

const alignClass = computed(() => `ui-drawer--${props.placement}`)

function close() {
  emit('update:modelValue', false)
  emit('close')
}

function onMaskClick() {
  if (props.maskClosable) close()
}

function onKeydown(event) {
  if (event.key === 'Escape' && props.escClosable) {
    event.stopPropagation()
    close()
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
      panelRef.value?.focus()
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
    <Transition name="ui-drawer">
      <div v-if="modelValue" class="ui-drawer" :class="alignClass" @keydown="onKeydown">
        <div class="ui-drawer__mask" @click="onMaskClick" />
        <aside
          ref="panelRef"
          class="ui-drawer__panel"
          role="dialog"
          aria-modal="true"
          :aria-label="title || undefined"
          tabindex="-1"
          :style="panelStyle"
        >
          <header class="ui-drawer__header">
            <slot name="header">
              <h3 class="ui-drawer__title">{{ title }}</h3>
            </slot>
            <button v-if="closable" class="ui-drawer__close" type="button" aria-label="关闭" @click="close">×</button>
          </header>
          <div class="ui-drawer__body">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="ui-drawer__footer">
            <slot name="footer" />
          </footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ui-drawer {
  position: fixed;
  inset: 0;
  z-index: var(--ui-z-drawer);
}

.ui-drawer--right,
.ui-drawer--left {
  display: flex;
}

.ui-drawer--right {
  justify-content: flex-end;
}

.ui-drawer--left {
  justify-content: flex-start;
}

.ui-drawer--top,
.ui-drawer--bottom {
  display: flex;
  flex-direction: column;
}

.ui-drawer--top {
  justify-content: flex-start;
}

.ui-drawer--bottom {
  justify-content: flex-end;
}

.ui-drawer__mask {
  position: absolute;
  inset: 0;
  background: var(--ui-mask-2);
}

.ui-drawer__panel {
  position: relative;
  display: flex;
  flex-direction: column;
  max-width: 100%;
  max-height: 100%;
  background: var(--ui-bg-overlay);
  -webkit-backdrop-filter: var(--ui-glass-blur);
  backdrop-filter: var(--ui-glass-blur);
  border: 1px solid var(--ui-border-l2);
  box-shadow: var(--ui-shadow-3);
  outline: none;
}

.ui-drawer--right .ui-drawer__panel {
  border-right: none;
  border-radius: var(--ui-radius-panel) 0 0 var(--ui-radius-panel);
}

.ui-drawer--left .ui-drawer__panel {
  border-left: none;
  border-radius: 0 var(--ui-radius-panel) var(--ui-radius-panel) 0;
}

.ui-drawer--top .ui-drawer__panel {
  border-top: none;
  border-radius: 0 0 var(--ui-radius-panel) var(--ui-radius-panel);
}

.ui-drawer--bottom .ui-drawer__panel {
  border-bottom: none;
  border-radius: var(--ui-radius-panel) var(--ui-radius-panel) 0 0;
}

.ui-drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-3);
  padding: var(--ui-space-4) var(--ui-space-5);
  border-bottom: 1px solid var(--ui-border-l1);
}

.ui-drawer__title {
  font-size: var(--ui-font-size-lg);
  font-weight: var(--ui-font-weight-semibold);
  color: var(--ui-text-label-primary);
}

.ui-drawer__close {
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

.ui-drawer__close:hover {
  background: var(--ui-interactive-hover);
  color: var(--ui-text-label-primary);
}

.ui-drawer__body {
  flex: 1;
  padding: var(--ui-space-5);
  overflow: auto;
  color: var(--ui-text-label-secondary);
}

.ui-drawer__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--ui-space-2);
  padding: var(--ui-space-4) var(--ui-space-5);
  border-top: 1px solid var(--ui-border-l1);
}

.ui-drawer-enter-active,
.ui-drawer-leave-active {
  transition: opacity var(--ui-duration-base) var(--ui-ease-standard);
}

.ui-drawer-enter-active .ui-drawer__panel,
.ui-drawer-leave-active .ui-drawer__panel {
  transition: transform var(--ui-duration-base) var(--ui-ease-standard);
}

.ui-drawer-enter-from,
.ui-drawer-leave-to {
  opacity: 0;
}

.ui-drawer--right.ui-drawer-enter-from .ui-drawer__panel,
.ui-drawer--right.ui-drawer-leave-to .ui-drawer__panel {
  transform: translateX(16px);
}

.ui-drawer--left.ui-drawer-enter-from .ui-drawer__panel,
.ui-drawer--left.ui-drawer-leave-to .ui-drawer__panel {
  transform: translateX(-16px);
}

.ui-drawer--top.ui-drawer-enter-from .ui-drawer__panel,
.ui-drawer--top.ui-drawer-leave-to .ui-drawer__panel {
  transform: translateY(-16px);
}

.ui-drawer--bottom.ui-drawer-enter-from .ui-drawer__panel,
.ui-drawer--bottom.ui-drawer-leave-to .ui-drawer__panel {
  transform: translateY(16px);
}
</style>

<script setup>
/**
 * Toast 提示容器：读取全局提示栈并渲染，需在应用根节点挂载一次
 */
import { useToast } from '@/composables/useToast'

defineProps({
  /** top-right | top-center | bottom-right | bottom-center */
  position: { type: String, default: 'top-right' },
})

const { toasts, remove } = useToast()
</script>

<template>
  <Teleport to="body">
    <div class="ui-toast" :class="`ui-toast--${position}`" role="status" aria-live="polite">
      <TransitionGroup name="ui-toast-item">
        <div v-for="item in toasts.items" :key="item.id" class="ui-toast__item" :class="`is-${item.type}`">
          <div class="ui-toast__content">
            <p v-if="item.title" class="ui-toast__title">{{ item.title }}</p>
            <p class="ui-toast__message">{{ item.message }}</p>
          </div>
          <button class="ui-toast__close" type="button" aria-label="关闭提示" @click="remove(item.id)">×</button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.ui-toast {
  position: fixed;
  z-index: var(--ui-z-toast);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
  pointer-events: none;
  max-width: 360px;
}

.ui-toast--top-right {
  top: var(--ui-space-5);
  right: var(--ui-space-5);
}

.ui-toast--top-center {
  top: var(--ui-space-5);
  left: 50%;
  transform: translateX(-50%);
  align-items: center;
}

.ui-toast--bottom-right {
  bottom: var(--ui-space-5);
  right: var(--ui-space-5);
}

.ui-toast--bottom-center {
  bottom: var(--ui-space-5);
  left: 50%;
  transform: translateX(-50%);
  align-items: center;
}

.ui-toast__item {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: var(--ui-space-3);
  min-width: 240px;
  padding: var(--ui-space-3) var(--ui-space-4);
  background: var(--ui-bg-overlay);
  -webkit-backdrop-filter: var(--ui-glass-blur);
  backdrop-filter: var(--ui-glass-blur);
  border: 1px solid var(--ui-border-l2);
  border-left: 3px solid var(--ui-info-label);
  border-radius: var(--ui-radius-3);
  box-shadow: var(--ui-shadow-2);
}

.ui-toast__item.is-success {
  border-left-color: var(--ui-success-label);
}

.ui-toast__item.is-warning {
  border-left-color: var(--ui-warn-label);
}

.ui-toast__item.is-error {
  border-left-color: var(--ui-danger-label);
}

.ui-toast__content {
  flex: 1;
  min-width: 0;
}

.ui-toast__title {
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-medium);
  color: var(--ui-text-label-primary);
}

.ui-toast__message {
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-label-secondary);
  word-break: break-word;
}

.ui-toast__close {
  flex: none;
  border: none;
  background: transparent;
  color: var(--ui-text-tertiary);
  font-size: var(--ui-font-size-base);
  line-height: 1;
  cursor: pointer;
}

.ui-toast__close:hover {
  color: var(--ui-text-label-primary);
}

.ui-toast-item-enter-active,
.ui-toast-item-leave-active {
  transition:
    opacity var(--ui-duration-base) var(--ui-ease-standard),
    transform var(--ui-duration-base) var(--ui-ease-standard);
}

.ui-toast-item-enter-from,
.ui-toast-item-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>

<script setup>
/**
 * 错误态（设计评审 P0-7 · 三态规范之一）
 * ------------------------------------------------------------------
 * 统一错误提示 + 重试：替代各页面"错误文案 + 手写重试按钮"的重复组合。
 * 空态继续用已有 Empty（它已在 15 个文件里充当 EmptyState，不重复造轮子）。
 */
import Button from '@/components/ui/Button.vue'
import Icon from '@/components/ui/Icon.vue'

defineProps({
  /** 错误标题 */
  title: { type: String, default: '加载失败' },
  /** 错误描述（可放 toFriendlyError 的产物） */
  description: { type: String, default: '' },
  /** 重试按钮文案 */
  actionText: { type: String, default: '重试' },
})
const emit = defineEmits(['retry'])
</script>

<template>
  <div class="error-state" role="alert">
    <Icon name="warning" :size="20" class="error-state__icon" />
    <div class="error-state__body">
      <span class="error-state__title">{{ title }}</span>
      <span v-if="description" class="error-state__desc">{{ description }}</span>
    </div>
    <Button type="info" size="sm" @click="emit('retry')">{{ actionText }}</Button>
  </div>
</template>

<style scoped>
.error-state {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
  padding: var(--ui-space-4);
  border: 1px solid var(--ui-border-l2);
  border-radius: var(--ui-radius-panel);
  background: var(--ui-bg-layer-1);
}

.error-state__icon {
  color: var(--ui-danger-label);
}

.error-state__body {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
  flex: 1;
  min-width: 0;
}

.error-state__title {
  color: var(--ui-text-label-primary);
}

.error-state__desc {
  color: var(--ui-text-label-secondary);
  font-size: var(--ui-font-size-sm);
}
</style>

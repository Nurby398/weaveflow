<script setup>
/**
 * 加载态（设计评审 P0-7 · 三态规范之一）
 * ------------------------------------------------------------------
 * 统一骨架：`rows` 条占位行，替代各页面手写的 inline skeleton div。
 * 只走设计令牌，无硬编码颜色。
 */
defineProps({
  /** 占位行数 */
  rows: { type: Number, default: 3 },
})
</script>

<template>
  <div class="loading-state" role="status" aria-label="加载中" aria-live="polite">
    <div v-for="n in rows" :key="n" class="loading-state__row">
      <div class="loading-state__bar loading-state__bar--short" />
      <div class="loading-state__bar" />
    </div>
  </div>
</template>

<style scoped>
.loading-state {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
}

.loading-state__row {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
  padding: var(--ui-space-3);
  border: 1px solid var(--ui-border-l1);
  border-radius: var(--ui-radius-3);
}

.loading-state__bar {
  height: var(--ui-space-3);
  border-radius: var(--ui-radius-pill);
  background: var(--ui-bg-skeleton);
}

.loading-state__bar--short {
  width: 40%;
}
</style>

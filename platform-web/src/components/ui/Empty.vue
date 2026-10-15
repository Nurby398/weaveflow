<script setup>
/**
 * Empty 空状态：列表为空 / 未登录 / 加载失败时统一出口，避免每页各写一套
 * 图标优先用 icon（矢量图，走 Icon 统一入口）；glyph 保留给历史调用点（Unicode 字符），不推荐新代码使用。
 * 实现底座：Element Plus 的 <el-empty>（image / description 两个插槽装织流自己的内容）
 */
import Icon from './Icon.vue'

defineProps({
  /** 语义图标名（见 components/ui/Icon.vue 的 REGISTRY），推荐 */
  icon: { type: String, default: '' },
  /** 历史用法：Unicode 字符，仅在未传 icon 时生效 */
  glyph: { type: String, default: '◇' },
  title: { type: String, default: '暂无数据' },
  description: { type: String, default: '' },
  /** sm | md */
  size: { type: String, default: 'md' },
})
</script>

<template>
  <el-empty class="ui-empty" :class="`ui-empty--${size}`">
    <template #image>
      <span class="ui-empty__glyph" aria-hidden="true">
        <Icon v-if="icon" :name="icon" :size="26" />
        <template v-else>{{ glyph }}</template>
      </span>
    </template>
    <template #description>
      <p class="ui-empty__title">{{ title }}</p>
      <p v-if="description" class="ui-empty__desc">{{ description }}</p>
    </template>
    <div v-if="$slots.default" class="ui-empty__actions">
      <slot />
    </div>
  </el-empty>
</template>

<style scoped>
.ui-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--ui-space-2);
  text-align: center;
  border: 1px dashed var(--ui-border-l2);
  border-radius: var(--ui-radius-panel);
  background: var(--ui-bg-layer-1);
  -webkit-backdrop-filter: var(--ui-glass-blur);
  backdrop-filter: var(--ui-glass-blur);
}

.ui-empty--sm {
  padding: var(--ui-space-4);
}

.ui-empty--md {
  padding: var(--ui-space-6);
}

/* el-empty 的图片盒默认是固定宽度，织流的图标/字符需要按内容撑开再居中 */
.ui-empty :deep(.el-empty__image) {
  width: auto;
}

/* 标题与说明之间的间距：原来由 .ui-empty 的 gap 提供，现在它们同处描述层，就近补上 */
.ui-empty :deep(.el-empty__description) {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}

/* 空状态图标用活力橙点缀——
   依据（用户原话）：「在一些地方加一点活力橙啊这些颜色」 */
.ui-empty__glyph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--ui-font-mono);
  font-size: var(--ui-font-size-title);
  color: var(--ui-accent-orange-text);
}

.ui-empty__title {
  font-size: var(--ui-font-size-base);
  color: var(--ui-text-label-secondary);
}

.ui-empty__desc {
  max-width: 420px;
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-caption);
}

.ui-empty__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-2);
  margin-top: var(--ui-space-2);
}
</style>

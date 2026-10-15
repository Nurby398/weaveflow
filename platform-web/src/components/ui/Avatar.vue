<script setup>
/**
 * Avatar 头像：图片加载失败或未提供图片时回落为名称首字
 * 实现底座：Element Plus 的 <el-avatar>（图片加载失败由 EP 内部处理，不再自己维护 failed 状态）
 */
import { computed } from 'vue'

/** 尺寸名 → 像素（EP 的 size 接受数字，落到 --el-avatar-size 上） */
const SIZES = { sm: 24, md: 32, lg: 48 }

const props = defineProps({
  src: { type: String, default: '' },
  /** 用于生成回落文字与 alt */
  name: { type: String, default: '' },
  alt: { type: String, default: '' },
  /** sm | md | lg */
  size: { type: String, default: 'md' },
  /** circle | square */
  shape: { type: String, default: 'circle' },
})

const initial = computed(() => (props.name ? props.name.trim().charAt(0).toUpperCase() : '?'))
const pixelSize = computed(() => SIZES[props.size])
</script>

<template>
  <el-avatar
    class="ui-avatar"
    :class="[`ui-avatar--${size}`, `ui-avatar--${shape}`]"
    :size="pixelSize"
    :shape="shape"
    :src="src"
    :alt="alt || name"
    role="img"
    :aria-label="alt || name || 'avatar'"
  >
    <span class="ui-avatar__fallback" aria-hidden="true">{{ initial }}</span>
  </el-avatar>
</template>

<style scoped>
.ui-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  overflow: hidden;
  background: var(--ui-btn-info-fill);
  border: 1px solid var(--ui-border-l2);
  color: var(--ui-text-label-secondary);
  font-weight: var(--ui-font-weight-medium);
  user-select: none;
}

.ui-avatar--circle {
  border-radius: 50%;
}

.ui-avatar--square {
  border-radius: var(--ui-radius-2);
}

.ui-avatar--sm {
  width: 24px;
  height: 24px;
  font-size: var(--ui-font-size-caption);
}

.ui-avatar--md {
  width: 32px;
  height: 32px;
  font-size: var(--ui-font-size-sm);
}

.ui-avatar--lg {
  width: 48px;
  height: 48px;
  font-size: var(--ui-font-size-lg);
}

/* 图片由 EP 渲染（无自定义 class），因此按结构选择器覆盖，保持原有的铺满 + 裁切 */
.ui-avatar :deep(> img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>

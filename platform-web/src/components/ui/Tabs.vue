<script setup>
/**
 * Tabs 标签页：role=tablist/tab/tabpanel，支持左右方向键与 Home/End 导航
 * 实现底座：Element Plus 的 <el-tabs> + <el-tab-pane>（方向键导航由 EP 内置；
 * Home/End 由本组件补上，保持改造前的能力）。
 */
const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  /** [{ key, label, disabled }] */
  tabs: { type: Array, default: () => [] },
  /** line | pill */
  variant: { type: String, default: 'line' },
})

const emit = defineEmits(['update:modelValue', 'change'])

function onSelect(key) {
  emit('update:modelValue', key)
}

function onChange(key) {
  emit('change', key)
}

/** EP 的标签导航只认方向键，这里补齐 Home / End */
function onKeydown(event) {
  if (event.key !== 'Home' && event.key !== 'End') return
  const items = Array.from(event.currentTarget.querySelectorAll('[role="tab"]:not(.is-disabled)'))
  if (!items.length) return
  event.preventDefault()
  const index = event.key === 'Home' ? 0 : items.length - 1
  const enabled = props.tabs.filter((tab) => !tab.disabled)
  const target = enabled[index]
  items[index].focus()
  if (target && target.key !== props.modelValue) {
    emit('update:modelValue', target.key)
    emit('change', target.key)
  }
}
</script>

<template>
  <el-tabs
    class="ui-tabs"
    :class="`ui-tabs--${variant}`"
    :model-value="modelValue"
    @update:model-value="onSelect"
    @tab-change="onChange"
    @keydown="onKeydown"
  >
    <el-tab-pane v-for="tab in tabs" :key="tab.key" :name="tab.key" :label="tab.label" :disabled="tab.disabled">
      <template v-if="tab.key === modelValue">
        <slot :active="modelValue" />
      </template>
    </el-tab-pane>
  </el-tabs>
</template>

<style scoped>
.ui-tabs {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}

/* 标签条＝原来的 .ui-tabs__list（el-tabs 把它拆成了 header/nav-wrap/nav 三层） */
.ui-tabs :deep(.el-tabs__header) {
  display: flex;
  align-items: center;
  gap: var(--ui-space-1);
  border-bottom: 1px solid var(--ui-border-l1);
  margin: 0;
}

.ui-tabs--pill :deep(.el-tabs__header) {
  border-bottom: none;
  padding: var(--ui-space-1);
  background: var(--ui-bg-layer-2);
  -webkit-backdrop-filter: var(--ui-glass-blur);
  backdrop-filter: var(--ui-glass-blur);
  border-radius: var(--ui-radius-pill);
  width: fit-content;
}

/* el-tabs 自带一条 2px 底线和一个滑动指示条；织流两种变体各有自己的选中态表达
   （line 用标签自身的下划线、pill 用胶囊底），两条都要关掉。
   同时放开 nav 的裁剪：下划线画在标签下沿之外 1px 处，被 overflow:hidden 裁掉就看不见了。 */
.ui-tabs :deep(.el-tabs__nav-wrap) {
  margin-bottom: 0;
  overflow: visible;
}

.ui-tabs :deep(.el-tabs__nav-scroll) {
  overflow: visible;
}

.ui-tabs :deep(.el-tabs__nav-wrap)::after {
  content: none;
}

.ui-tabs :deep(.el-tabs__active-bar) {
  display: none;
}

.ui-tabs :deep(.el-tabs__nav) {
  gap: var(--ui-space-1);
}

/* 标签＝原来的 .ui-tabs__tab。
   选择器写深一层（header / nav-wrap / nav / item），才能稳定压过 el-tabs
   「第二个标签去掉左内边距、最后一个去掉右内边距」这类定位微调规则。 */
.ui-tabs :deep(.el-tabs__header .el-tabs__nav-wrap .el-tabs__nav .el-tabs__item) {
  position: relative;
  height: auto;
  padding: var(--ui-space-2) var(--ui-space-4);
  border: none;
  background: transparent;
  color: var(--ui-text-label-tertiary);
  font-family: var(--ui-font-sans);
  font-size: var(--ui-font-size-base);
  font-weight: var(--ui-font-weight-medium);
  line-height: inherit;
  border-radius: var(--ui-radius-pill);
  transition:
    color var(--ui-duration-fast) var(--ui-ease-standard),
    background var(--ui-duration-fast) var(--ui-ease-standard);
}

.ui-tabs :deep(.el-tabs__header .el-tabs__nav-wrap .el-tabs__nav .el-tabs__item:hover) {
  color: var(--ui-text-label-primary);
  background: var(--ui-interactive-hover);
}

.ui-tabs :deep(.el-tabs__header .el-tabs__nav-wrap .el-tabs__nav .el-tabs__item.is-active) {
  color: var(--ui-text-label-primary);
}

.ui-tabs--line :deep(.el-tabs__header .el-tabs__nav-wrap .el-tabs__nav .el-tabs__item.is-active)::after {
  content: '';
  position: absolute;
  left: var(--ui-space-3);
  right: var(--ui-space-3);
  bottom: -1px;
  height: 2px;
  border-radius: 2px;
  background: var(--ui-primary);
}

/* 选中态与侧栏导航一致：半透明青胶囊 + 白字 */
.ui-tabs--pill :deep(.el-tabs__header .el-tabs__nav-wrap .el-tabs__nav .el-tabs__item.is-active) {
  background: var(--ui-interactive-active);
  color: var(--ui-text-primary);
  box-shadow:
    0 0 0 1px var(--ui-glass-stroke) inset,
    var(--ui-glass-shadow-1);
}

.ui-tabs :deep(.el-tabs__header .el-tabs__nav-wrap .el-tabs__nav .el-tabs__item.is-disabled) {
  color: var(--ui-text-dimmed);
  cursor: not-allowed;
}

/* 焦点环沿用改造前的浏览器默认行为（el-tabs 会换成它的内阴影方块） */
.ui-tabs :deep(.el-tabs__item:focus-visible) {
  outline: auto;
  box-shadow: none;
}

.ui-tabs :deep(.el-tabs__content) {
  flex-grow: 0;
  overflow: visible;
  outline: none;
  color: var(--ui-text-label-secondary);
}
</style>

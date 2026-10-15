<script setup>
/**
 * Tooltip 文字提示：hover / focus 触发，Teleport 到 body 以避免被裁剪
 * 实现底座：Element Plus 的 <el-tooltip>。
 * 气泡本体由 EP 渲染在 body 上（组件内的 scoped 样式够不到），
 * 因此气泡外观写在 src/styles/element-overrides.css 的 .ui-tooltip 一节。
 */
defineProps({
  content: { type: String, default: '' },
  /** top | bottom | left | right */
  placement: { type: String, default: 'top' },
  delay: { type: Number, default: 120 },
  disabled: { type: Boolean, default: false },
})
</script>

<template>
  <el-tooltip
    :content="content"
    :placement="placement"
    :show-after="delay"
    :disabled="disabled || !content"
    :offset="8"
    :show-arrow="false"
    effect="light"
    popper-class="ui-tooltip"
  >
    <span class="ui-tooltip__trigger"><slot /></span>
  </el-tooltip>
</template>

<style scoped>
.ui-tooltip__trigger {
  display: inline-flex;
}
</style>

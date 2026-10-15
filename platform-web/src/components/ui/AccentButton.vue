<script setup>
/**
 * AccentButton 强调色 CTA
 * ------------------------------------------------------------------
 * 样式：青底（--ui-primary）+ 1px 描边（--ui-primary-stroke）+ 深色字
 * （--ui-text-on-accent）+ 大写 + letter-spacing .14em + 胶囊 + 尾部短线。
 * 登录 Hero 的 GET STARTED 与介绍页的 LEARN MORE 是同一套规格，
 * 因此抽成组件，避免两处各写一遍而慢慢走样。
 *
 * 发光用 filter: drop-shadow（光晕）：它贴着圆角轮廓发光，不会像 box-shadow
 * 那样再叠一层外描边，与玻璃材质更协调。
 */
defineProps({
  /** 是否显示尾部短线 */
  dash: { type: Boolean, default: true },
})

const emit = defineEmits(['click'])
</script>

<template>
  <button class="ui-accent-btn" type="button" @click="emit('click', $event)">
    <span><slot /></span>
    <span v-if="dash" class="ui-accent-btn__dash" aria-hidden="true" />
  </button>
</template>

<style scoped>
.ui-accent-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-4);
  padding: 18px 34px;
  border: 1px solid var(--ui-primary-stroke);
  border-radius: var(--ui-radius-pill);
  background: var(--ui-primary);
  color: var(--ui-text-on-accent);
  font-family: var(--ui-font-display);
  font-size: var(--ui-hero-font-cta);
  font-weight: var(--ui-font-weight-bold);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  filter: var(--ui-accent-glow);
  cursor: pointer;
  transition:
    background var(--ui-duration-fast) var(--ui-ease-standard),
    filter var(--ui-duration-fast) var(--ui-ease-standard);
}

.ui-accent-btn:hover {
  background: var(--ui-primary-hover);
  filter: var(--ui-accent-glow-hover);
}

.ui-accent-btn__dash {
  display: block;
  width: 22px;
  height: 1px;
  background: var(--ui-text-on-accent);
}
</style>

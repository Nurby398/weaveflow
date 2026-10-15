<script setup>
/**
 * ThemeToggle 主题切换按钮
 * ------------------------------------------------------------------
 * 依据（用户原话）：「做完明亮主题，把主题切换按钮放在页面上」。
 * 位置由调度者标定：Navbar 右侧（用户区左侧），登录页与介绍页的顶栏右上角各一个。
 *
 * 造型沿用现有语言：胶囊 + 玻璃底 + Icon 图标（语义名 sun / moon）。
 * 当前是明亮主题时按钮点亮活力橙——
 * 依据（用户原话）：「在一些地方加一点活力橙啊这些颜色」。
 *
 * 实现底座：Element Plus 的 <el-button>。
 */
import { computed } from 'vue'
import { useTheme } from '@/composables/useTheme'
import Icon from './Icon.vue'

const { theme, toggle } = useTheme()

const isLight = computed(() => theme.value === 'light')
const label = computed(() => (isLight.value ? '切换到深色主题' : '切换到明亮主题'))
</script>

<template>
  <el-button
    class="ui-theme-toggle"
    :class="{ 'is-light': isLight }"
    native-type="button"
    :aria-pressed="isLight ? 'true' : 'false'"
    :aria-label="label"
    :title="label"
    @click="toggle()"
  >
    <Icon :name="isLight ? 'sun' : 'moon'" :size="16" />
  </el-button>
</template>

<style scoped>
.ui-theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 34px;
  height: 34px;
  /* el-button 自带 8px 15px 内边距与 middle 对齐，这里回到织流的方按钮 */
  padding: 0;
  vertical-align: baseline;
  border: 1px solid var(--ui-border-l1);
  border-radius: var(--ui-radius-pill);
  background: var(--ui-glass-bg-soft);
  -webkit-backdrop-filter: var(--ui-glass-blur);
  backdrop-filter: var(--ui-glass-blur);
  color: var(--ui-text-secondary);
  cursor: pointer;
  transition:
    background var(--ui-duration-fast) var(--ui-ease-standard),
    border-color var(--ui-duration-fast) var(--ui-ease-standard),
    color var(--ui-duration-fast) var(--ui-ease-standard);
}

.ui-theme-toggle:hover {
  background: var(--ui-interactive-hover);
  border-color: var(--ui-border-l3);
  color: var(--ui-text-primary);
}

/* 焦点环沿用改造前的浏览器默认行为（el-button 会换成它的 2px 描边） */
.ui-theme-toggle:focus-visible {
  outline: auto;
  outline-offset: 0;
}

/* 明亮主题生效时点亮活力橙：一眼看出当前是哪套 */
.ui-theme-toggle.is-light {
  background: var(--ui-accent-orange-fill);
  border-color: var(--ui-accent-orange-stroke);
  color: var(--ui-accent-orange-text);
}
</style>

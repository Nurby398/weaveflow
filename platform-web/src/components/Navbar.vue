<script setup>
/**
 * Navbar 顶部栏（毛玻璃）：菜单开关、页面标题、主题切换、登录态入口
 * 主题两套（深色 / 明亮）都由 tokens.css 决定，这里只放切换按钮。
 * 视觉依据（用户原话）：「我想要毛玻璃，胶囊，半透明的视觉感受」——
 * 顶栏是毛玻璃，按钮与用户区是胶囊；切换按钮位置见任务书标定：右侧、用户区左侧。
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Avatar from './ui/Avatar.vue'
import Button from './ui/Button.vue'
import Icon from './ui/Icon.vue'
import ThemeToggle from './ui/ThemeToggle.vue'
import { useUserStore } from '@/store/user'

defineProps({
  collapsed: { type: Boolean, default: false },
})

const emit = defineEmits(['toggle-sidebar'])

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const pageTitle = computed(() => route.meta?.title || '')

async function handleLogout() {
  await userStore.logout()
  // 登出后必须离开受保护页面（新规则下所有业务页都要求登录）
  router.push('/login')
}
</script>

<template>
  <header class="navbar">
    <button
      class="navbar__icon-btn"
      type="button"
      :aria-expanded="collapsed ? 'false' : 'true'"
      aria-label="切换侧边导航"
      @click="emit('toggle-sidebar')"
    >
      <Icon name="menu" :size="18" />
    </button>

    <h2 class="navbar__title">{{ pageTitle }}</h2>

    <div class="navbar__spacer" />

    <ThemeToggle />

    <div v-if="userStore.loggedIn" class="navbar__user">
      <Avatar :name="userStore.displayName" size="sm" />
      <span class="navbar__user-name">{{ userStore.displayName }}</span>
      <Button type="ghost" size="sm" @click="handleLogout">退出</Button>
    </div>
    <RouterLink v-else class="navbar__login" to="/login">登录</RouterLink>
  </header>
</template>

<style scoped>
.navbar {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
  height: var(--ui-layout-navbar-height);
  padding: 0 var(--ui-space-4);
  /* 毛玻璃顶栏：sticky 时视频透过它可见 */
  background: var(--ui-glass-bg-strong);
  box-shadow: var(--ui-glass-outer);
  -webkit-backdrop-filter: var(--ui-glass-blur);
  backdrop-filter: var(--ui-glass-blur);
  border: none;
  border-bottom: 1px solid var(--ui-glass-stroke);
  position: sticky;
  top: 0;
  z-index: var(--ui-z-navbar);
}

.navbar__title {
  font-size: var(--ui-font-size-lg);
  font-weight: var(--ui-font-weight-medium);
  color: var(--ui-text-label-primary);
}

.navbar__spacer {
  flex: 1;
}

/* 图标按钮：胶囊（造型来自 base.css 的胶囊默认值 + 这里的尺寸） */
.navbar__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: none;
  background: transparent;
  color: var(--ui-text-label-tertiary);
  cursor: pointer;
  transition:
    background var(--ui-duration-fast) var(--ui-ease-standard),
    color var(--ui-duration-fast) var(--ui-ease-standard);
}

.navbar__icon-btn:hover {
  background: var(--ui-interactive-hover-strong);
  color: var(--ui-text-label-primary);
}

/* 用户区：胶囊玻璃容器，视觉成组 */
.navbar__user {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  height: 36px;
  padding: 0 var(--ui-space-1) 0 var(--ui-space-2);
  border-radius: var(--ui-radius-pill);
  background: var(--ui-glass-bg-soft);
  border: 1px solid var(--ui-glass-stroke);
}

.navbar__user-name {
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-label-secondary);
  padding-right: var(--ui-space-2);
}

.navbar__login {
  font-size: var(--ui-font-size-sm);
  color: var(--ui-primary-text);
  padding: 0 var(--ui-space-3);
}
</style>

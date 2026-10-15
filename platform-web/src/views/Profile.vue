<script setup>
/**
 * 个人中心（requiresAuth）：用于验证路由守卫的登录态分支与 redirect 回跳
 */
import Button from '@/components/ui/Button.vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/user'

const router = useRouter()
const userStore = useUserStore()

async function handleLogout() {
  await userStore.logout()
  // 登出后必须离开受保护页面（新规则下所有业务页都要求登录）
  router.push('/login')
}
</script>

<template>
  <div class="profile">
    <section class="profile__card">
      <h2>个人中心</h2>
      <dl class="profile__list">
        <div class="profile__row">
          <dt>登录状态</dt>
          <dd>{{ userStore.loggedIn ? '已登录' : '未登录' }}</dd>
        </div>
        <div class="profile__row">
          <dt>名称</dt>
          <dd>{{ userStore.displayName }}</dd>
        </div>
        <div class="profile__row">
          <dt>角色</dt>
          <dd>{{ userStore.role || '未分配' }}</dd>
        </div>
      </dl>
      <Button type="info" @click="handleLogout">退出登录</Button>
    </section>
  </div>
</template>

<style scoped>
.profile__card {
  max-width: 520px;
  padding: var(--ui-space-6);
  background: var(--ui-bg-layer-1);
  -webkit-backdrop-filter: var(--ui-glass-blur);
  backdrop-filter: var(--ui-glass-blur);
  border: 1px solid var(--ui-border-l1);
  border-radius: var(--ui-radius-panel);
}

.profile__list {
  margin: var(--ui-space-4) 0 var(--ui-space-5);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}

.profile__row {
  display: flex;
  gap: var(--ui-space-4);
  padding-bottom: var(--ui-space-2);
  border-bottom: 1px solid var(--ui-border-l1);
  font-size: var(--ui-font-size-sm);
}

.profile__row dt {
  width: 80px;
  flex: none;
  color: var(--ui-text-caption);
}

.profile__row dd {
  margin: 0;
  color: var(--ui-text-label-primary);
}
</style>

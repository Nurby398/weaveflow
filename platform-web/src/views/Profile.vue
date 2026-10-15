<script setup>
/**
 * 个人中心（requiresAuth）：资料展示 + 可编辑（昵称 / 改密码 / 退出全部会话）。
 * 写操作走 PATCH /api/me（FE-B12）；后端未实现时回 404 → 明确降级提示，不造假交互。
 */
import { ref } from 'vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import { useRouter } from 'vue-router'
import { logApiError, toFriendlyError, userApi } from '@/api'
import { useToast } from '@/composables/useToast'
import { useUserStore } from '@/store/user'

const router = useRouter()
const userStore = useUserStore()
const toast = useToast()

const nickname = ref(userStore.displayName)
const savingName = ref(false)
const nameNotice = ref('')

const currentPassword = ref('')
const newPassword = ref('')
const savingPassword = ref(false)
const passwordNotice = ref('')

const loggingOutAll = ref(false)
const logoutAllNotice = ref('')

const NOT_READY = '需后端支持（FE-B12 未就绪）：接口尚未开放，暂时无法提交。'

async function saveName() {
  const value = nickname.value.trim()
  if (!value) {
    nameNotice.value = '昵称不能为空'
    return
  }
  savingName.value = true
  nameNotice.value = ''
  try {
    const user = await userApi.updateProfile({ nickname: value })
    userStore.userInfo = { ...(userStore.userInfo || {}), nickname: user?.nickname ?? value }
    toast.success('昵称已更新')
  } catch (error) {
    if (error?.status === 404 || error?.status === 501) nameNotice.value = NOT_READY
    else {
      logApiError(error, 'profile-name')
      nameNotice.value = toFriendlyError(error)
    }
  } finally {
    savingName.value = false
  }
}

async function savePassword() {
  if (!currentPassword.value || !newPassword.value) {
    passwordNotice.value = '请填写当前密码与新密码'
    return
  }
  savingPassword.value = true
  passwordNotice.value = ''
  try {
    await userApi.changePassword({ currentPassword: currentPassword.value, newPassword: newPassword.value })
    toast.success('密码已更新')
    currentPassword.value = ''
    newPassword.value = ''
  } catch (error) {
    if (error?.status === 404 || error?.status === 501) passwordNotice.value = NOT_READY
    else {
      logApiError(error, 'profile-password')
      passwordNotice.value = toFriendlyError(error)
    }
  } finally {
    savingPassword.value = false
  }
}

async function handleLogoutAll() {
  loggingOutAll.value = true
  logoutAllNotice.value = ''
  try {
    await userApi.logoutAll()
    await userStore.logout()
    router.push('/login')
  } catch (error) {
    if (error?.status === 404 || error?.status === 501) logoutAllNotice.value = NOT_READY
    else {
      logApiError(error, 'profile-logout-all')
      logoutAllNotice.value = toFriendlyError(error)
    }
  } finally {
    loggingOutAll.value = false
  }
}

async function handleLogout() {
  await userStore.logout()
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

      <form class="profile__form" @submit.prevent="saveName">
        <label class="profile__field">
          <span class="profile__label">昵称</span>
          <Input v-model="nickname" aria-label="昵称" maxlength="60" />
        </label>
        <p v-if="nameNotice" class="profile__notice" role="alert">{{ nameNotice }}</p>
        <Button type="primary" size="sm" :loading="savingName" @click="saveName">保存昵称</Button>
      </form>

      <form class="profile__form" @submit.prevent="savePassword">
        <label class="profile__field">
          <span class="profile__label">当前密码</span>
          <Input v-model="currentPassword" type="password" aria-label="当前密码" />
        </label>
        <label class="profile__field">
          <span class="profile__label">新密码</span>
          <Input v-model="newPassword" type="password" aria-label="新密码" />
        </label>
        <p v-if="passwordNotice" class="profile__notice" role="alert">{{ passwordNotice }}</p>
        <Button type="primary" size="sm" :loading="savingPassword" @click="savePassword">修改密码</Button>
      </form>

      <div class="profile__actions">
        <Button type="ghost" :loading="loggingOutAll" @click="handleLogoutAll">退出全部会话</Button>
        <Button type="info" @click="handleLogout">退出登录</Button>
      </div>
      <p v-if="logoutAllNotice" class="profile__notice" role="alert">{{ logoutAllNotice }}</p>
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

.profile__form {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
  margin-bottom: var(--ui-space-4);
}

.profile__field {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}

.profile__label {
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-label-secondary);
}

.profile__notice {
  margin: 0;
  color: var(--ui-text-label-secondary);
  font-size: var(--ui-font-size-sm);
}

.profile__actions {
  display: flex;
  gap: var(--ui-space-2);
}
</style>

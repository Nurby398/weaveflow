<script setup>
/**
 * 全局登录弹窗：由 store/loginPopup.js 的可见状态驱动，
 * 登录成功后消费 redirect 并回跳（无 redirect 时留在当前页）。
 */
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Button from './ui/Button.vue'
import Input from './ui/Input.vue'
import Modal from './ui/Modal.vue'
import { closeLoginPopup, consumeRedirect, loginPopupState } from '@/store/loginPopup'
import { useUserStore } from '@/store/user'

const router = useRouter()
const userStore = useUserStore()

/** 后端 /auth/login 的账号字段是 email，这里不做 username 别名 */
const email = ref('')
const password = ref('')
const errorMessage = ref('')

const visible = computed({
  get: () => loginPopupState.visible,
  set: (value) => {
    if (!value) closeLoginPopup()
  },
})

watch(visible, (value) => {
  if (value) errorMessage.value = ''
})

async function handleSubmit() {
  errorMessage.value = ''
  try {
    await userStore.login({ email: email.value.trim(), password: password.value })
    const redirect = consumeRedirect()
    closeLoginPopup()
    password.value = ''
    if (redirect) router.push(redirect)
  } catch (error) {
    errorMessage.value = error?.message || '登录失败，请稍后重试'
  }
}
</script>

<template>
  <Modal v-model="visible" :title="loginPopupState.title" width="380px">
    <p class="login-popup__message">{{ loginPopupState.message }}</p>

    <form class="login-popup__form" @submit.prevent="handleSubmit">
      <label class="login-popup__field">
        <span class="login-popup__label">邮箱</span>
        <Input v-model="email" placeholder="you@example.com" aria-label="邮箱" />
      </label>
      <label class="login-popup__field">
        <span class="login-popup__label">密码</span>
        <Input v-model="password" type="password" placeholder="请输入密码" aria-label="密码" />
      </label>

      <p v-if="errorMessage" class="login-popup__error" role="alert">{{ errorMessage }}</p>

      <div class="login-popup__actions">
        <Button type="ghost" @click="closeLoginPopup">取消</Button>
        <Button type="primary" native-type="submit" :loading="userStore.loading">登录</Button>
      </div>
    </form>
  </Modal>
</template>

<style scoped>
.login-popup__message {
  margin-bottom: var(--ui-space-4);
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-label-tertiary);
}

.login-popup__form {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
}

.login-popup__field {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
}

.login-popup__label {
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-label-secondary);
}

.login-popup__error {
  font-size: var(--ui-font-size-sm);
  color: var(--ui-danger-label);
}

.login-popup__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--ui-space-2);
  margin-top: var(--ui-space-2);
}
</style>

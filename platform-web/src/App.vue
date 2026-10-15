<script setup>
/**
 * 应用根组件：全局背景视频 + 全局浮层（登录弹窗、Toast），页面内容交给路由
 * 背景视频只在这里挂一次，全站共用（见 components/AppBackground.vue）
 */
import AppBackground from '@/components/AppBackground.vue'
import LoginPopup from '@/components/LoginPopup.vue'
import Toast from '@/components/ui/Toast.vue'
</script>

<template>
  <AppBackground />
  <RouterView />
  <LoginPopup />
  <Toast />
</template>

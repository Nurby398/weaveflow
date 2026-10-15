<script setup>
/**
 * 应用根组件：全局背景视频 + 全局浮层（登录弹窗、Toast），页面内容交给路由
 * 背景视频只在这里挂一次，全站共用（见 components/AppBackground.vue）
 */
import AppBackground from '@/components/AppBackground.vue'
import LoginPopup from '@/components/LoginPopup.vue'
import ErrorBoundary from '@/components/ui/ErrorBoundary.vue'
import Toast from '@/components/ui/Toast.vue'
</script>

<template>
  <AppBackground />
  <!-- 最外层兜底：路由页面（含未登录的登录页/介绍页）渲染抛错时不至于整页白屏 -->
  <ErrorBoundary title="页面加载失败了">
    <RouterView />
  </ErrorBoundary>
  <LoginPopup />
  <Toast />
</template>

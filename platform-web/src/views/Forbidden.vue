<script setup>
import Button from '@/components/ui/Button.vue'
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="standalone">
    <p class="standalone__code">403</p>
    <h1>无访问权限</h1>
    <p class="standalone__desc">当前账号的角色不满足该页面的访问要求。</p>
    <Button type="primary" @click="router.push('/')">返回工作台</Button>
  </div>
</template>

<style scoped>
.standalone {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--ui-space-3);
  background: var(--ui-bg-base);
}

.standalone__code {
  font-family: var(--ui-font-mono);
  font-size: var(--ui-font-size-display);
  color: var(--ui-text-dimmed);
}

.standalone__desc {
  margin-bottom: var(--ui-space-4);
  color: var(--ui-text-label-tertiary);
}
</style>

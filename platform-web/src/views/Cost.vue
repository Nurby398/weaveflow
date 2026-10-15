<script setup>
/**
 * 成本（Paperclip 参照 · 支柱 D "支出追踪 & 预算"）
 * ------------------------------------------------------------------
 * 未来这里聚合各项目/阶段的 token 与费用，并给出预算与告警。
 * 现有 `usage_logs` 已记录 tokens（后端），聚合接口待做（FE-B 清单）；前端先占位。
 */
import { useRouter } from 'vue-router'
import Button from '@/components/ui/Button.vue'
import Empty from '@/components/ui/Empty.vue'

const router = useRouter()
</script>

<template>
  <section class="placeholder">
    <header class="placeholder__head">
      <h2 class="placeholder__title">成本</h2>
    </header>

    <Empty
      icon="coin"
      title="用量与预算会汇总在这里"
      description="按项目、阶段、会话聚合 token 与费用；超预算自动告警，避免空转烧钱。"
    >
      <p class="placeholder__note ui-mono">成本聚合接口待后端 · 当前为占位</p>
      <Button type="info" size="sm" @click="router.push('/settings')">管理模型凭据</Button>
    </Empty>
  </section>
</template>

<style scoped>
.placeholder {
  padding: var(--ui-space-6);
}

.placeholder__head {
  margin-bottom: var(--ui-space-4);
}

.placeholder__title {
  margin: 0;
  font-family: var(--ui-font-display);
  font-size: var(--ui-font-size-lg);
  color: var(--ui-text-label-primary);
}

.placeholder__note {
  margin: var(--ui-space-3) 0;
  color: var(--ui-text-label-secondary);
}
</style>

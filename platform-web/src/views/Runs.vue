<script setup>
/**
 * 运行历史（Paperclip 参照 · 支柱 D "运行历史 & 追踪"）
 * ------------------------------------------------------------------
 * 未来这里列出「历次流水线运行」：状态、当前阶段、各阶段耗时、失败原因、产出与成本。
 * 依赖后端 `GET /api/pipeline/runs`（见 docs/前端驱动-后端待实现清单-v1.md 的 FE-B11），
 * 接口未就绪前先占位；已有单条运行的详情页是 `/pipeline/:runId`。
 */
import { useRouter } from 'vue-router'
import Button from '@/components/ui/Button.vue'
import Empty from '@/components/ui/Empty.vue'

const router = useRouter()
</script>

<template>
  <section class="placeholder">
    <header class="placeholder__head">
      <h2 class="placeholder__title">运行历史</h2>
    </header>

    <Empty
      icon="gauge"
      title="历次流水线运行会列在这里"
      description="状态、当前阶段、各阶段耗时、失败原因、产出与成本，一眼看到每条运行的全貌。"
    >
      <p class="placeholder__note ui-mono">后端接口 FE-B11 未就绪 · 当前为占位</p>
      <Button type="info" size="sm" @click="router.push('/teams')">去启动一条流水线</Button>
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

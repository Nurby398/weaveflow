<script setup>
/**
 * 评测（Paperclip 参照 · 支柱 C "Agent Employee Training / Evals"）
 * ------------------------------------------------------------------
 * 未来这里对毕设智能体跑「测试用例 → 评分」：保存的输入、运行结果、质量指标与历史。
 * 评测运行接口待后端（FE-B 清单）；前端先占位。
 */
import { useRouter } from 'vue-router'
import Button from '@/components/ui/Button.vue'
import Empty from '@/components/ui/Empty.vue'

const router = useRouter()
</script>

<template>
  <section class="placeholder">
    <header class="placeholder__head">
      <h2 class="placeholder__title">评测</h2>
    </header>

    <Empty
      icon="aim"
      title="用测试用例检验每个毕设智能体"
      description="保存一批标准输入，对 ①–⑤ 逐个跑分：准确率、耗时、token，看谁在哪个阶段掉链子。"
    >
      <p class="placeholder__note ui-mono">评测运行接口待后端 · 当前为占位</p>
      <Button type="info" size="sm" @click="router.push('/agents')">查看智能体</Button>
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

<script setup>
/**
 * 运行历史（Paperclip 参照 · 支柱 D「运行历史 & 追踪」）
 * ------------------------------------------------------------------
 * 列出历次流水线运行：状态、当前阶段、起止时间、失败原因，点行进运行详情页。
 * 后端接口 `GET /api/pipeline/runs` 未就绪（FE-B11）：`VITE_MOCK_RUNS` 开启时走
 * lib/runsDemo.js 的受控演示数据（带「演示数据」徽标，生产不引入），否则显示占位。
 */
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Badge from '@/components/ui/Badge.vue'
import Empty from '@/components/ui/Empty.vue'
import { logApiError, runsApi } from '@/api'
import { RUNS_MOCK_ENABLED } from '@/lib/runsMode'
import { relativeTime } from '@/lib/format'

const router = useRouter()

const runs = ref([])
const loading = ref(false)
const notReady = ref(false)
const demo = ref(false)

async function load() {
  loading.value = true
  notReady.value = false
  try {
    if (RUNS_MOCK_ENABLED) {
      const mod = await import('@/lib/runsDemo')
      runs.value = mod.DEMO_RUNS
      demo.value = true
    } else {
      runs.value = await runsApi.list()
      demo.value = false
    }
  } catch (error) {
    logApiError(error, 'runs')
    notReady.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)

const STATUS = {
  running: { label: '运行中', tone: 'info' },
  completed: { label: '已完成', tone: 'success' },
  failed: { label: '失败', tone: 'danger' },
}
const statusOf = (run) => STATUS[run.status] || { label: run.status, tone: 'neutral' }
function stageText(run) {
  return `阶段 ${(run.currentStage ?? 0) + 1}/${run.stageCount ?? '—'}`
}
</script>

<template>
  <section class="runs">
    <header class="runs__head">
      <h2 class="runs__title">运行历史</h2>
      <Badge v-if="demo" tone="warn">演示数据</Badge>
      <p class="runs__sub">历次流水线运行的状态、阶段进度与失败原因；点行进详情页。</p>
    </header>

    <Empty
      v-if="notReady"
      icon="gauge"
      title="运行历史接口未就绪"
      description="后端还没有 GET /api/pipeline/runs（FE-B11）。开启 VITE_MOCK_RUNS 可预览界面。"
    />

    <Empty
      v-else-if="!loading && !runs.length"
      icon="gauge"
      title="还没有运行"
      description="从团队或工作台启动一条流水线后，这里会有记录。"
    />

    <div v-else class="runs__list">
      <button
        v-for="run in runs"
        :key="run.runId"
        class="runs__row"
        type="button"
        @click="router.push(`/pipeline/${run.runId}`)"
      >
        <div class="runs__row-main">
          <span class="runs__row-name">{{ run.teamName }}</span>
          <Badge v-if="run.isPlatform" tone="primary">平台</Badge>
          <Badge :tone="statusOf(run).tone">{{ statusOf(run).label }}</Badge>
        </div>
        <div class="runs__row-meta ui-mono">
          <span>{{ stageText(run) }}</span>
          <span>更新于 {{ relativeTime(run.updatedAt) }}</span>
        </div>
        <p v-if="run.failure" class="runs__failure">{{ run.failure }}</p>
      </button>
    </div>
  </section>
</template>

<style scoped>
.runs {
  padding: var(--ui-space-6);
}

.runs__head {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  margin-bottom: var(--ui-space-4);
}

.runs__title {
  margin: 0;
  font-family: var(--ui-font-display);
  font-size: var(--ui-font-size-lg);
  color: var(--ui-text-label-primary);
}

.runs__sub {
  margin: 0;
  color: var(--ui-text-label-secondary);
}

.runs__list {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}

.runs__row {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
  align-items: flex-start;
  padding: var(--ui-space-3);
  border: 1px solid var(--ui-border-l2);
  border-radius: var(--ui-radius-3);
  background: transparent;
  color: var(--ui-text-label-primary);
  text-align: left;
  cursor: pointer;
}

.runs__row-main {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
}

.runs__row-name {
  color: var(--ui-text-label-primary);
}

.runs__row-meta {
  display: flex;
  gap: var(--ui-space-3);
  color: var(--ui-text-label-secondary);
  font-size: var(--ui-font-size-sm);
}

.runs__failure {
  margin: 0;
  color: var(--ui-text-label-secondary);
  font-size: var(--ui-font-size-sm);
}
</style>

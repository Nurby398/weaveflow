<script setup>
/**
 * 评测（Paperclip 参照 · 支柱 C「Agent Employee Training / Evals」）
 * ------------------------------------------------------------------
 * 用标准测试用例检验每个毕设智能体：用例列表 + 最近跑分记录（得分/耗时/token）。
 * 后端接口未就绪（FE-B20）：`VITE_MOCK_EVALS` 开启时走 lib/evalsDemo.js 的受控演示数据
 * （带「演示数据」徽标，生产不引入），否则显示占位。
 */
import { onMounted, ref } from 'vue'
import Badge from '@/components/ui/Badge.vue'
import Empty from '@/components/ui/Empty.vue'
import { evalsApi, logApiError } from '@/api'
import { EVALS_MOCK_ENABLED } from '@/lib/evalsMode'
import { formatNumber, relativeTime } from '@/lib/format'

const cases = ref([])
const runs = ref([])
const loading = ref(false)
const notReady = ref(false)
const demo = ref(false)

async function load() {
  loading.value = true
  notReady.value = false
  try {
    if (EVALS_MOCK_ENABLED) {
      const mod = await import('@/lib/evalsDemo')
      cases.value = mod.DEMO_EVAL_CASES
      runs.value = mod.DEMO_EVAL_RUNS
      demo.value = true
    } else {
      ;[cases.value, runs.value] = await Promise.all([evalsApi.cases(), evalsApi.runs()])
      demo.value = false
    }
  } catch (error) {
    logApiError(error, 'evals')
    notReady.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)

function scoreTone(score) {
  if (score >= 80) return 'success'
  if (score >= 60) return 'info'
  return 'danger'
}
</script>

<template>
  <section class="evals">
    <header class="evals__head">
      <h2 class="evals__title">评测</h2>
      <Badge v-if="demo" tone="warn">演示数据</Badge>
      <p class="evals__sub">用测试用例检验每个毕设智能体的输出质量；跑分接口待后端（FE-B20）。</p>
    </header>

    <Empty
      v-if="notReady"
      icon="aim"
      title="评测接口未就绪"
      description="后端还没有 GET /api/evals/cases 与 POST /api/evals/run（FE-B20）。开启 VITE_MOCK_EVALS 可预览界面。"
    />

    <template v-else>
      <section class="evals__panel">
        <h3 class="evals__panel-title">测试用例（{{ cases.length }}）</h3>
        <div v-if="cases.length" class="evals__cases">
          <div v-for="item in cases" :key="item.caseId" class="evals__case">
            <span class="evals__case-name">{{ item.name }}</span>
            <span class="evals__case-input">{{ item.input }}</span>
          </div>
        </div>
        <Empty v-else-if="!loading" size="sm" icon="document" title="还没有用例" />
      </section>

      <section class="evals__panel">
        <h3 class="evals__panel-title">最近跑分（{{ runs.length }}）</h3>
        <div v-if="runs.length" class="evals__runs">
          <div v-for="run in runs" :key="run.runId" class="evals__run">
            <div class="evals__run-main">
              <span class="evals__run-agent">{{ run.agentName }}</span>
              <span class="evals__run-case">{{ run.caseName }}</span>
            </div>
            <div class="evals__run-meta">
              <Badge :tone="scoreTone(run.score)">{{ run.score }} 分</Badge>
              <span class="ui-mono">↑{{ formatNumber(run.tokensIn) }} ↓{{ formatNumber(run.tokensOut) }}</span>
              <span class="ui-mono">{{ relativeTime(run.createdAt) }}</span>
            </div>
          </div>
        </div>
        <Empty v-else-if="!loading" size="sm" icon="aim" title="还没有跑分" />
      </section>
    </template>
  </section>
</template>

<style scoped>
.evals {
  padding: var(--ui-space-6);
}

.evals__head {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  margin-bottom: var(--ui-space-4);
}

.evals__title {
  margin: 0;
  font-family: var(--ui-font-display);
  font-size: var(--ui-font-size-lg);
  color: var(--ui-text-label-primary);
}

.evals__sub {
  margin: 0;
  color: var(--ui-text-label-secondary);
}

.evals__panel {
  margin-bottom: var(--ui-space-4);
}

.evals__panel-title {
  margin: 0 0 var(--ui-space-2);
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-label-secondary);
}

.evals__cases,
.evals__runs {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}

.evals__case,
.evals__run {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-3);
  padding: var(--ui-space-3);
  border: 1px solid var(--ui-border-l2);
  border-radius: var(--ui-radius-3);
}

.evals__case-name,
.evals__run-agent {
  color: var(--ui-text-label-primary);
}

.evals__case-input,
.evals__run-case {
  color: var(--ui-text-label-secondary);
  font-size: var(--ui-font-size-sm);
}

.evals__run-main {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
}

.evals__run-meta {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  color: var(--ui-text-label-secondary);
  font-size: var(--ui-font-size-sm);
}
</style>

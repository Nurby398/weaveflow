<script setup>
/**
 * 成本面板（Paperclip 参照 · §D1 支出追踪）
 * ------------------------------------------------------------------
 * 聚合各项目的 token 与费用，并给出预算使用率与告警。
 * 后端接口 `GET /api/usage/summary` 未就绪（FE-B19）：`VITE_MOCK_COST` 开启时走
 * lib/costDemo.js 的受控演示数据（带「演示数据」徽标，生产不引入），否则显示占位。
 */
import { computed, onMounted, ref } from 'vue'
import Badge from '@/components/ui/Badge.vue'
import Empty from '@/components/ui/Empty.vue'
import { costApi, logApiError } from '@/api'
import { COST_MOCK_ENABLED } from '@/lib/costMode'
import { formatNumber } from '@/lib/format'

const summary = ref(null)
const loading = ref(false)
const notReady = ref(false)
const demo = ref(false)

async function load() {
  loading.value = true
  notReady.value = false
  try {
    if (COST_MOCK_ENABLED) {
      const mod = await import('@/lib/costDemo')
      summary.value = mod.DEMO_COST_SUMMARY
      demo.value = true
    } else {
      summary.value = await costApi.summary()
      demo.value = false
    }
  } catch (error) {
    logApiError(error, 'cost')
    notReady.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)

const percent = computed(() => (summary.value ? Math.round((summary.value.budgetUsedRatio ?? 0) * 100) : 0))
const overBudget = computed(
  () => summary.value && summary.value.budget > 0 && (summary.value.budgetUsedRatio ?? 0) >= 1,
)
const fmtMoney = (value) => `${Number(value ?? 0).toFixed(2)}`
</script>

<template>
  <section class="cost">
    <header class="cost__head">
      <h2 class="cost__title">成本</h2>
      <Badge v-if="demo" tone="warn">演示数据</Badge>
      <p class="cost__sub">按项目聚合 token 与费用；预算告警待后端（FE-B19）。</p>
    </header>

    <Empty
      v-if="notReady"
      icon="coin"
      title="成本接口未就绪"
      description="后端还没有 GET /api/usage/summary（FE-B19）。开启 VITE_MOCK_COST 可预览界面。"
    />

    <template v-else-if="summary">
      <div class="cost__stats">
        <div class="cost__stat">
          <span class="cost__stat-label">总费用</span>
          <span class="cost__stat-value ui-mono">{{ fmtMoney(summary.totalCost) }} {{ summary.currency }}</span>
        </div>
        <div class="cost__stat">
          <span class="cost__stat-label">总 token</span>
          <span class="cost__stat-value ui-mono">{{
            formatNumber(summary.totalTokensIn + summary.totalTokensOut)
          }}</span>
        </div>
        <div class="cost__stat">
          <span class="cost__stat-label">预算</span>
          <span class="cost__stat-value ui-mono">{{
            summary.budget ? `${fmtMoney(summary.budget)} ${summary.currency}` : '未设'
          }}</span>
        </div>
        <div class="cost__stat">
          <span class="cost__stat-label">预算使用</span>
          <span class="cost__stat-value ui-mono">{{ percent }}%</span>
          <div class="cost__bar">
            <div
              class="cost__bar-fill"
              :class="{ 'is-over': overBudget }"
              :style="{ width: `${Math.min(percent, 100)}%` }"
            />
          </div>
        </div>
      </div>

      <p v-if="overBudget" class="cost__alert" role="alert">预算已用尽：请到后端配预算或暂停自动流转（FE-B19）。</p>

      <div class="cost__list">
        <div v-for="team in summary.byTeam" :key="team.teamId" class="cost__row">
          <div class="cost__row-main">
            <span class="cost__row-name">{{ team.teamName }}</span>
            <Badge v-if="team.isPlatform" tone="primary">平台</Badge>
            <span class="ui-mono cost__row-meta">{{ team.runs }} 次运行</span>
          </div>
          <div class="cost__row-metrics ui-mono">
            <span>↑{{ formatNumber(team.tokensIn) }}</span>
            <span>↓{{ formatNumber(team.tokensOut) }}</span>
            <span>{{ fmtMoney(team.cost) }} {{ summary.currency }}</span>
          </div>
        </div>
      </div>
    </template>

    <Empty v-else-if="!loading" icon="coin" title="暂无成本数据" description="跑过一次流水线后这里会有数字。" />
  </section>
</template>

<style scoped>
.cost {
  padding: var(--ui-space-6);
}

.cost__head {
  margin-bottom: var(--ui-space-4);
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
}

.cost__title {
  margin: 0;
  font-family: var(--ui-font-display);
  font-size: var(--ui-font-size-lg);
  color: var(--ui-text-label-primary);
}

.cost__sub {
  margin: 0;
  color: var(--ui-text-label-secondary);
}

.cost__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--ui-space-3);
  margin-bottom: var(--ui-space-4);
}

.cost__stat {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
  padding: var(--ui-space-3);
  border: 1px solid var(--ui-border-l2);
  border-radius: var(--ui-radius-3);
}

.cost__stat-label {
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-label-secondary);
}

.cost__stat-value {
  color: var(--ui-text-label-primary);
}

.cost__bar {
  height: 6px;
  border-radius: var(--ui-radius-pill);
  background: var(--ui-border-l2);
  overflow: hidden;
}

.cost__bar-fill {
  height: 100%;
  background: var(--ui-primary);
  border-radius: var(--ui-radius-pill);
}

.cost__bar-fill.is-over {
  background: var(--ui-danger-fill);
}

.cost__alert {
  margin: 0 0 var(--ui-space-3);
  padding: var(--ui-space-3);
  border: 1px solid var(--ui-danger-fill);
  border-radius: var(--ui-radius-3);
  color: var(--ui-text-label-primary);
}

.cost__list {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}

.cost__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-3);
  padding: var(--ui-space-3);
  border: 1px solid var(--ui-border-l2);
  border-radius: var(--ui-radius-3);
}

.cost__row-main {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
}

.cost__row-name {
  color: var(--ui-text-label-primary);
}

.cost__row-meta {
  color: var(--ui-text-label-secondary);
  font-size: var(--ui-font-size-sm);
}

.cost__row-metrics {
  display: flex;
  gap: var(--ui-space-3);
  color: var(--ui-text-label-secondary);
}
</style>

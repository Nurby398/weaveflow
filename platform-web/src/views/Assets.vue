<script setup>
/**
 * 资产库（EvoFlow 参照 · §E5 资产中心）
 * ------------------------------------------------------------------
 * 阶段产出自动沉淀为资产（后端落库），前端提供检索与展示：
 * 关键词检索标题与正文 + 资产卡（阶段徽标 / 团队 / 时间 / 摘要）。
 * 后端接口未就绪（FE-B31）：`VITE_MOCK_ASSETS` 开启时走 lib/assetsDemo.js（带「演示数据」徽标，
 * 生产不引入）；关闭时走真实接口，404 → 占位。
 */
import { computed, onMounted, ref } from 'vue'
import Badge from '@/components/ui/Badge.vue'
import Empty from '@/components/ui/Empty.vue'
import Input from '@/components/ui/Input.vue'
import { assetsApi, logApiError } from '@/api'
import { ASSETS_MOCK_ENABLED } from '@/lib/assetsMode'
import { relativeTime } from '@/lib/format'

const assets = ref([])
const loading = ref(false)
const notReady = ref(false)
const demo = ref(false)
const query = ref('')

async function load() {
  loading.value = true
  notReady.value = false
  try {
    if (ASSETS_MOCK_ENABLED) {
      const mod = await import('@/lib/assetsDemo')
      assets.value = mod.DEMO_ASSETS
      demo.value = true
    } else {
      assets.value = await assetsApi.list()
      demo.value = false
    }
  } catch (error) {
    logApiError(error, 'assets')
    notReady.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)

const filteredAssets = computed(() => {
  const kw = query.value.trim().toLowerCase()
  if (!kw) return assets.value
  return assets.value.filter(
    (asset) =>
      String(asset.title ?? '')
        .toLowerCase()
        .includes(kw) ||
      String(asset.content ?? '')
        .toLowerCase()
        .includes(kw),
  )
})

const STAGE_PREFIX = ['', '①', '②', '③', '④', '⑤']
const stageLabel = (stageNo) => STAGE_PREFIX[stageNo] ?? `#${stageNo}`
</script>

<template>
  <section class="assets">
    <header class="assets__head">
      <h2 class="assets__title">资产库</h2>
      <Badge v-if="demo" tone="warn">演示数据</Badge>
      <p class="assets__sub">阶段产出自动沉淀为资产，供后续阶段检索复用；接口待后端（FE-B31）。</p>
    </header>

    <Empty
      v-if="notReady"
      icon="notebook"
      title="资产库接口未就绪"
      description="后端还没有 GET /api/assets（FE-B31）。开启 VITE_MOCK_ASSETS 可预览界面。"
    />

    <template v-else>
      <div class="assets__search">
        <Input v-model="query" aria-label="搜索资产" placeholder="搜索资产标题或正文" />
      </div>

      <Empty
        v-if="assets.length && !filteredAssets.length"
        icon="filter"
        title="没有匹配的资产"
        description="换个关键词试试。"
      />
      <Empty
        v-else-if="!loading && !assets.length"
        icon="notebook"
        title="还没有资产"
        description="流水线阶段产出沉淀后，这里会有内容。"
      />

      <div v-else class="assets__list">
        <article v-for="asset in filteredAssets" :key="asset.id" class="assets__card">
          <div class="assets__card-head">
            <span class="assets__card-title">{{ asset.title }}</span>
            <Badge tone="neutral">阶段 {{ stageLabel(asset.stageNo) }}</Badge>
          </div>
          <p class="assets__card-body">{{ asset.content }}</p>
          <div class="assets__card-meta ui-mono">
            <span>{{ asset.teamName }}</span>
            <span>{{ relativeTime(asset.createdAt) }}</span>
          </div>
        </article>
      </div>
    </template>
  </section>
</template>

<style scoped>
.assets {
  padding: var(--ui-space-6);
}

.assets__head {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  margin-bottom: var(--ui-space-4);
}

.assets__title {
  margin: 0;
  font-family: var(--ui-font-display);
  font-size: var(--ui-font-size-lg);
  color: var(--ui-text-label-primary);
}

.assets__sub {
  margin: 0;
  color: var(--ui-text-label-secondary);
}

.assets__search {
  margin-bottom: var(--ui-space-3);
  max-width: 320px;
}

.assets__list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--ui-space-3);
}

.assets__card {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
  padding: var(--ui-space-3);
  border: 1px solid var(--ui-border-l2);
  border-radius: var(--ui-radius-3);
}

.assets__card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-2);
}

.assets__card-title {
  color: var(--ui-text-label-primary);
  font-weight: var(--ui-font-weight-semibold, 600);
}

.assets__card-body {
  margin: 0;
  color: var(--ui-text-label-secondary);
  line-height: var(--ui-line-height-loose);
}

.assets__card-meta {
  display: flex;
  justify-content: space-between;
  gap: var(--ui-space-2);
  color: var(--ui-text-caption);
  font-size: var(--ui-font-size-caption);
}
</style>

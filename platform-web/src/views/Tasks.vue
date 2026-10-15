<script setup>
/**
 * 任务中心（EvoFlow 参照 · §E8）
 * ------------------------------------------------------------------
 * 后台任务列表：状态（运行中/已暂停/失败/已完成）+ 进度条 + 暂停/恢复/取消。
 * 后端接口未就绪（FE-B30）：`VITE_MOCK_TASKS` 开启时走 lib/tasksDemo.js（带「演示数据」徽标，
 * 生产不引入）；关闭时走真实接口，404 → 占位；操作按钮在演示态不可用、真实态 404 时降级提示。
 */
import { onMounted, ref } from 'vue'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import Empty from '@/components/ui/Empty.vue'
import { logApiError, tasksApi } from '@/api'
import { TASKS_MOCK_ENABLED } from '@/lib/tasksMode'
import { relativeTime } from '@/lib/format'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const tasks = ref([])
const loading = ref(false)
const notReady = ref(false)
const demo = ref(false)
const acting = ref('')

const STATUS = {
  running: { label: '运行中', tone: 'info' },
  paused: { label: '已暂停', tone: 'neutral' },
  failed: { label: '失败', tone: 'danger' },
  completed: { label: '已完成', tone: 'success' },
}
const statusOf = (task) => STATUS[task.status] || { label: task.status, tone: 'neutral' }

async function load() {
  loading.value = true
  notReady.value = false
  try {
    if (TASKS_MOCK_ENABLED) {
      const mod = await import('@/lib/tasksDemo')
      tasks.value = mod.DEMO_TASKS
      demo.value = true
    } else {
      tasks.value = await tasksApi.list()
      demo.value = false
    }
  } catch (error) {
    logApiError(error, 'tasks')
    notReady.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)

async function act(task, action) {
  if (demo.value) {
    toast.info('演示数据暂不支持操作；接入 FE-B30 后可暂停/恢复/取消。')
    return
  }
  acting.value = task.id
  try {
    await tasksApi[action](task.id)
    toast.success({ pause: '已暂停', resume: '已恢复', cancel: '已取消' }[action])
    await load()
  } catch (error) {
    if (error?.status === 404 || error?.status === 501) {
      toast.info('任务操作需后端支持（FE-B30 未就绪）。')
    } else {
      logApiError(error, 'task-action')
      toast.error(error?.message || '操作失败')
    }
  } finally {
    acting.value = ''
  }
}
</script>

<template>
  <section class="tasks">
    <header class="tasks__head">
      <h2 class="tasks__title">任务中心</h2>
      <Badge v-if="demo" tone="warn">演示数据</Badge>
      <p class="tasks__sub">后台长任务：状态、进度与暂停/恢复/取消；接口待后端（FE-B30）。</p>
    </header>

    <Empty
      v-if="notReady"
      icon="timer"
      title="任务中心接口未就绪"
      description="后端还没有 GET /api/tasks（FE-B30）。开启 VITE_MOCK_TASKS 可预览界面。"
    />

    <Empty
      v-else-if="!loading && !tasks.length"
      icon="timer"
      title="还没有后台任务"
      description="派发流水线并后台运行时，这里会有记录。"
    />

    <div v-else class="tasks__list">
      <div v-for="task in tasks" :key="task.id" class="tasks__row">
        <div class="tasks__row-main">
          <span class="tasks__row-title">{{ task.title }}</span>
          <Badge :tone="statusOf(task).tone">{{ statusOf(task).label }}</Badge>
          <span class="ui-mono tasks__row-meta"
            >阶段 {{ task.currentStage }} · 更新于 {{ relativeTime(task.updatedAt) }}</span
          >
        </div>
        <div class="tasks__bar">
          <div class="tasks__bar-fill" :style="{ width: `${Math.min(task.progress ?? 0, 100)}%` }" />
        </div>
        <div class="tasks__row-actions">
          <span class="ui-mono tasks__progress">{{ task.progress ?? 0 }}%</span>
          <Button
            v-if="task.status === 'running'"
            type="ghost"
            size="sm"
            :loading="acting === task.id"
            @click="act(task, 'pause')"
            >暂停</Button
          >
          <Button
            v-if="task.status === 'paused'"
            type="ghost"
            size="sm"
            :loading="acting === task.id"
            @click="act(task, 'resume')"
            >恢复</Button
          >
          <Button
            v-if="task.status === 'running' || task.status === 'paused'"
            type="ghost"
            size="sm"
            :loading="acting === task.id"
            @click="act(task, 'cancel')"
            >取消</Button
          >
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.tasks {
  padding: var(--ui-space-6);
}

.tasks__head {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  margin-bottom: var(--ui-space-4);
}

.tasks__title {
  margin: 0;
  font-family: var(--ui-font-display);
  font-size: var(--ui-font-size-lg);
  color: var(--ui-text-label-primary);
}

.tasks__sub {
  margin: 0;
  color: var(--ui-text-label-secondary);
}

.tasks__list {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}

.tasks__row {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
  padding: var(--ui-space-3);
  border: 1px solid var(--ui-border-l2);
  border-radius: var(--ui-radius-3);
}

.tasks__row-main {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
}

.tasks__row-title {
  color: var(--ui-text-label-primary);
}

.tasks__row-meta {
  color: var(--ui-text-label-secondary);
  font-size: var(--ui-font-size-sm);
}

.tasks__bar {
  height: 6px;
  border-radius: var(--ui-radius-pill);
  background: var(--ui-border-l2);
  overflow: hidden;
}

.tasks__bar-fill {
  height: 100%;
  background: var(--ui-primary);
  border-radius: var(--ui-radius-pill);
}

.tasks__row-actions {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
}

.tasks__progress {
  color: var(--ui-text-label-secondary);
  font-size: var(--ui-font-size-sm);
}
</style>

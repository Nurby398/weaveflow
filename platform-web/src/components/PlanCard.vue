<script setup>
/**
 * 计划卡（EvoFlow 参照 · §E1 Plan/Goal）
 * ------------------------------------------------------------------
 * 意图派发识别后**先展示可确认的计划**（阶段 + 负责智能体），用户点「确认并启动」
 * 才真正跑流水线；「取消」则丢弃本次计划。计划持久化与修订走 FE-B29，当前展示层先行。
 */
import Button from '@/components/ui/Button.vue'

defineProps({
  /** 用户意图（原话），用于确认时回显给宿主 */
  content: { type: String, default: '' },
  /** 计划阶段：{ agentName, stageNo }[] */
  stages: { type: Array, default: () => [] },
})
const emit = defineEmits(['confirm', 'cancel'])

function onConfirm() {
  emit('confirm')
}
function onCancel() {
  emit('cancel')
}
</script>

<template>
  <section class="plan" aria-label="派发计划">
    <header class="plan__head">
      <span class="plan__title">毕设流水线计划</span>
      <span class="ui-mono plan__count">{{ stages.length }} 个阶段</span>
    </header>

    <p class="plan__intent ui-mono">{{ content }}</p>

    <ol class="plan__stages">
      <li v-for="(stage, index) in stages" :key="stage.agentName || index" class="plan__stage">
        <span class="ui-mono plan__no">{{ String(index + 1).padStart(2, '0') }}</span>
        <span class="plan__agent">{{ stage.agentName }}</span>
      </li>
    </ol>

    <div class="plan__actions">
      <Button type="ghost" size="sm" @click="onCancel">取消</Button>
      <Button type="primary" size="sm" @click="onConfirm">确认并启动</Button>
    </div>
  </section>
</template>

<style scoped>
.plan {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
  padding: var(--ui-space-4);
  border: 1px solid var(--ui-border-l2);
  border-radius: var(--ui-radius-panel);
  background: var(--ui-bg-layer-1);
}

.plan__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-2);
}

.plan__title {
  font-family: var(--ui-font-display);
  color: var(--ui-text-label-primary);
}

.plan__count {
  color: var(--ui-text-caption);
  font-size: var(--ui-font-size-caption);
}

.plan__intent {
  margin: 0;
  color: var(--ui-text-label-secondary);
  font-size: var(--ui-font-size-sm);
}

.plan__stages {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}

.plan__stage {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
}

.plan__no {
  color: var(--ui-text-caption);
}

.plan__agent {
  color: var(--ui-text-label-primary);
}

.plan__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--ui-space-2);
}
</style>

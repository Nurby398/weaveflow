<script setup>
/**
 * SpeakerBar 消息流「发言人条」（方案 §3.7 视觉层）
 * ------------------------------------------------------------------
 * 团队成员的 assistant 消息在气泡顶部显示：头像 + 名字 + 阶段 + 状态。
 * 它取代了 batch 1 的「来自 ①…」来源 Badge —— 同一身份只留一处标识，不叠两套。
 * 参数由使用方从那份 activeDispatch（单一真源）里取好传进来，本组件不查状态。
 * ------------------------------------------------------------------
 */
import { computed } from 'vue'
import Avatar from '@/components/ui/Avatar.vue'
import Badge from '@/components/ui/Badge.vue'
import { statusText, statusTone } from '@/lib/dispatch'

const props = defineProps({
  name: { type: String, default: '' },
  /** 头像图（团队/智能体头像）；没有则回落为名字首字 */
  src: { type: String, default: '' },
  /** 阶段号（0 基，与后端一致）；未派发/非阶段成员时为空 */
  stageNo: { type: [Number, String], default: '' },
  stageCount: { type: [Number, String], default: '' },
  /** pending | waiting | running | validated | failed（流水线既有枚举） */
  status: { type: String, default: '' },
})

const stageText = computed(() => {
  if (props.stageNo === '' || props.stageNo === null) return ''
  const no = Number(props.stageNo)
  if (!Number.isFinite(no)) return ''
  const count = Number(props.stageCount)
  return Number.isFinite(count) && count > 0 ? `阶段 ${no + 1}/${count}` : `阶段 ${no + 1}`
})
</script>

<template>
  <span class="speaker">
    <Avatar class="speaker__avatar" :src="src" :name="name" size="sm" />
    <span class="speaker__name">{{ name }}</span>
    <Badge v-if="stageText" tone="info">{{ stageText }}</Badge>
    <Badge v-if="status" :tone="statusTone(status)">{{ statusText(status) }}</Badge>
  </span>
</template>

<style scoped>
/* 一条细横条：头像 + 名字 + 两枚标签，不加背景块（克制，见方案 §3.7） */
.speaker {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2);
  min-width: 0;
}

.speaker__avatar {
  flex: none;
}

.speaker__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-medium);
  color: var(--ui-text-primary);
}
</style>

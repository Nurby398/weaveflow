<script setup>
/**
 * 错误边界（Wave 2 · W2-1）
 * ------------------------------------------------------------------
 * 之前：任何页面组件渲染抛错 → 整页白屏，用户只看到空白。
 * 现在：这一层把子树错误接住，就地显示可读的兜底卡片（含错误编号），
 *       导航/其它区域仍可用；「重试」可原地重渲染子树。
 *
 * 约定：
 *   · 只接住**子树**的渲染/生命周期错误；事件回调里的异常走 main.js 的 errorHandler；
 *   · 不上报敏感数据：只上报 message / info / 组件栈摘要（见 lib/telemetry.js）；
 *   · onErrorCaptured 返回 false —— 不再往上层冒泡，避免外层把整个应用换掉。
 */
import { onErrorCaptured, ref } from 'vue'
import Button from './Button.vue'
import { reportError } from '@/lib/telemetry'

const props = defineProps({
  /** 兜底卡片标题（不同区域可给不同文案） */
  title: { type: String, default: '这一部分加载失败了' },
})

const failure = ref(null)

onErrorCaptured((error, instance, info) => {
  const record = reportError(error, { source: 'error-boundary', info })
  failure.value = { digest: record.digest, message: record.message }
  return false
})

function retry() {
  failure.value = null
}

function reload() {
  if (typeof window !== 'undefined') window.location.reload()
}
</script>

<template>
  <div v-if="failure" class="err-box ui-glass" role="alert">
    <h2 class="err-box__title">{{ props.title }}</h2>
    <p class="err-box__text">
      已经记录这次异常。可以点「重试」重新加载这一块；如果反复出现，请把下面的编号发给维护者。
    </p>
    <p class="err-box__digest ui-mono">编号 {{ failure.digest }}</p>
    <p class="err-box__detail ui-mono">{{ failure.message }}</p>
    <div class="err-box__actions">
      <Button type="primary" size="sm" @click="retry">重试</Button>
      <Button type="ghost" size="sm" @click="reload">刷新页面</Button>
    </div>
  </div>
  <slot v-else />
</template>

<style scoped>
.err-box {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
  align-items: flex-start;
  padding: var(--ui-space-6);
  margin: var(--ui-space-4);
  border: 1px solid var(--ui-border-l2);
  border-radius: var(--ui-radius-3);
}

.err-box__title {
  margin: 0;
  font-family: var(--ui-font-display);
  font-size: var(--ui-font-size-lg);
  color: var(--ui-text-label-primary);
}

.err-box__text {
  margin: 0;
  max-width: 60ch;
  color: var(--ui-text-label-secondary);
  line-height: var(--ui-line-height-loose);
}

.err-box__digest,
.err-box__detail {
  margin: 0;
  color: var(--ui-text-label-secondary);
  font-size: var(--ui-font-size-sm);
  word-break: break-all;
}

.err-box__actions {
  display: flex;
  gap: var(--ui-space-2);
  margin-top: var(--ui-space-2);
}
</style>

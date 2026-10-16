<script setup>
/**
 * 输入区（P1-1 · 从 Chat.vue 抽出的第 2 块）
 * ------------------------------------------------------------------
 * 只负责「输入区怎么画」：输入框、字数、附件进度列表、发送/中断按钮。
 * 输入内容用 v-model 进出；发送/中断/选文件/移除附件全部 emit 给宿主。
 * 上传状态（uploads）仍在宿主（与消息流共享），这里纯展示 + 转发操作。
 */
import { ref } from 'vue'
import Button from '@/components/ui/Button.vue'
import Icon from '@/components/ui/Icon.vue'
import Textarea from '@/components/ui/Textarea.vue'
import { formatBytes } from '@/lib/format'

defineProps({
  modelValue: { type: String, default: '' },
  streaming: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
  uploads: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue', 'send', 'abort', 'upload', 'remove-upload'])

const composerRef = ref(null)
defineExpose({ focus: () => composerRef.value?.focus() })
</script>

<template>
  <div class="chat__composer">
    <div class="chat__composer-inner">
      <ul v-if="uploads.length" class="chat__uploads">
        <li v-for="item in uploads" :key="item.key" class="chat__upload">
          <span class="chat__upload-name">{{ item.name }}</span>
          <span class="ui-mono chat__upload-size">{{ formatBytes(item.size) }}</span>
          <span class="chat__upload-bar" aria-hidden="true">
            <span
              class="chat__upload-fill"
              :class="{ 'is-error': item.status === 'error' }"
              :style="{ width: `${Math.round(item.progress * 100)}%` }"
            />
          </span>
          <span class="ui-mono chat__upload-pct">
            {{ item.status === 'error' ? '失败' : `${Math.round(item.progress * 100)}%` }}
          </span>
          <button class="chat__upload-del" type="button" aria-label="移除附件" @click="emit('remove-upload', item)">
            ×
          </button>
        </li>
      </ul>

      <div class="chat__box" @keydown.enter.exact.prevent="emit('send')">
        <Textarea
          ref="composerRef"
          :model-value="modelValue"
          @update:model-value="emit('update:modelValue', $event)"
          :rows="2"
          resize="none"
          :placeholder="placeholder"
          aria-label="消息输入"
        />

        <div class="chat__box-bar">
          <label class="chat__file">
            <input type="file" multiple class="chat__file-input" @change="emit('upload', $event)" />
            <Icon name="attach" :size="16" />
            添加附件
          </label>
          <span v-if="modelValue.length" class="ui-mono chat__count">{{ modelValue.length }} 字</span>
          <span class="chat__box-spacer" />
          <Button v-if="streaming" type="ghost" size="sm" @click="emit('abort')">中断生成</Button>
          <Button
            type="primary"
            size="sm"
            :disabled="!modelValue.trim() || streaming"
            :loading="streaming"
            @click="emit('send')"
          >
            发送
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat__composer {
  flex: none;
  padding: var(--ui-space-3) var(--ui-space-5) var(--ui-space-4);
  border-top: 1px solid var(--ui-border-l1);
  background: var(--ui-bg-layer-1);
  -webkit-backdrop-filter: var(--ui-glass-blur);
  backdrop-filter: var(--ui-glass-blur);
  position: relative;
  z-index: 1;
}

.chat__composer-inner {
  max-width: var(--ui-layout-content-max);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}

/* 输入框外框统一由 .chat__box 提供，内部 Textarea 去掉自己的边框与底色，避免双层描边 */
.chat__box {
  border: 1px solid var(--ui-border-l2);
  border-radius: var(--ui-radius-panel);
  background: var(--ui-bg-layer-1);
  -webkit-backdrop-filter: var(--ui-glass-blur);
  backdrop-filter: var(--ui-glass-blur);
  transition:
    border-color var(--ui-duration-fast) var(--ui-ease-standard),
    box-shadow var(--ui-duration-fast) var(--ui-ease-standard);
}

.chat__box:hover {
  border-color: var(--ui-border-l3);
}

.chat__box:focus-within {
  border-color: var(--ui-primary);
  box-shadow: 0 0 0 3px var(--ui-interactive-hover);
}

.chat__box :deep(.ui-textarea) {
  background: transparent;
  border: none;
  border-radius: var(--ui-radius-panel) var(--ui-radius-panel) 0 0;
}

.chat__box :deep(.ui-textarea:focus-within) {
  box-shadow: none;
}

.chat__box :deep(.ui-textarea__inner) {
  min-height: 56px;
  padding: var(--ui-space-3) var(--ui-space-4) var(--ui-space-1);
}

.chat__box-bar {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
  padding: var(--ui-space-2) var(--ui-space-3) var(--ui-space-2) var(--ui-space-4);
}

.chat__box-spacer {
  flex: 1;
}

.chat__count {
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-dimmed);
}

.chat__file {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-1);
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-tertiary);
  cursor: pointer;
  transition: color var(--ui-duration-fast) var(--ui-ease-standard);
}

.chat__file:hover {
  color: var(--ui-primary-text);
}

.chat__file-input {
  display: none;
}

/* 附件进度：单行细条，不占视觉重量 */
.chat__uploads {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
}

.chat__upload {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  padding: var(--ui-space-1) var(--ui-space-2);
  border: 1px solid var(--ui-border-l1);
  border-radius: var(--ui-radius-2);
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-secondary);
}

.chat__upload-name {
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat__upload-size,
.chat__upload-pct {
  color: var(--ui-text-caption);
}

.chat__upload-bar {
  flex: 1;
  height: 3px;
  background: var(--ui-bg-layer-3);
  border-radius: var(--ui-radius-1);
  overflow: hidden;
}

.chat__upload-fill {
  display: block;
  height: 100%;
  background: var(--ui-primary);
  transition: width var(--ui-duration-fast) var(--ui-ease-standard);
}

.chat__upload-fill.is-error {
  background: var(--ui-danger-label);
}

.chat__upload-del {
  border: none;
  background: transparent;
  color: var(--ui-text-caption);
  cursor: pointer;
  line-height: 1;
}
</style>

<script setup>
/**
 * 意见反馈弹窗（登录页「Contact us」的入口）
 * ------------------------------------------------------------------
 * 后端 `POST /api/feedback` **尚未实现**（按用户决定，随 Java 后端一起做，
 * 见 docs/平台开发进度与交接.md §5.1），所以这里做**优雅降级**：
 * 接口未开放时给一句明确的话，而不是把一个 404 原文丢给用户。
 * 接口一旦就绪，本组件无需任何改动。
 *
 * ⚠️ 本弹窗出现在**登录页（未登录态）**，因此该接口必须是匿名可调用的。
 */
import { computed, ref, watch } from 'vue'
import Button from './ui/Button.vue'
import Input from './ui/Input.vue'
import Modal from './ui/Modal.vue'
import Select from './ui/Select.vue'
import Textarea from './ui/Textarea.vue'
import { feedbackApi } from '@/api'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const typeOptions = [
  { label: '功能建议', value: 'suggestion' },
  { label: '问题反馈', value: 'bug' },
  { label: '其他', value: 'other' },
]

/** 与后端约定的内容长度下限（后端上线后应对齐同一约束） */
const MIN_LENGTH = 5

const type = ref('suggestion')
const content = ref('')
const contact = ref('')
const submitting = ref(false)
const errorMessage = ref('')
const done = ref(false)

// 每次打开重置状态：已提交的成败提示不应残留到下一次
watch(visible, (value) => {
  if (!value) return
  done.value = false
  errorMessage.value = ''
})

async function handleSubmit() {
  errorMessage.value = ''

  const text = content.value.trim()
  if (text.length < MIN_LENGTH) {
    errorMessage.value = `请至少填写 ${MIN_LENGTH} 个字，便于我们理解你说的问题`
    return
  }

  submitting.value = true
  try {
    await feedbackApi.create({
      type: type.value,
      content: text,
      contact: contact.value.trim(),
    })
    done.value = true
    content.value = ''
    contact.value = ''
  } catch (error) {
    const status = error?.status
    // 404 / 501：后端路由还没写（Java 版一起做）——说清楚，别让用户以为是自己操作错了
    if (status === 404 || status === 501) {
      errorMessage.value = '反馈通道正在建设中：后端接口尚未开放，暂时无法提交。'
    } else {
      errorMessage.value = error?.message || '提交失败，请稍后重试'
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Modal v-model="visible" title="意见反馈" width="460px">
    <div v-if="done" class="feedback__done">
      <p class="feedback__done-text">已收到你的反馈，感谢！</p>
      <div class="feedback__actions">
        <Button type="primary" @click="visible = false">知道了</Button>
      </div>
    </div>

    <form v-else class="feedback__form" @submit.prevent="handleSubmit">
      <p class="feedback__hint">遇到问题或有想法都可以写在这里。</p>

      <label class="feedback__field">
        <span class="feedback__label">反馈类型</span>
        <Select v-model="type" :options="typeOptions" aria-label="反馈类型" />
      </label>

      <label class="feedback__field">
        <span class="feedback__label">反馈内容</span>
        <Textarea
          v-model="content"
          :rows="5"
          :maxlength="500"
          show-count
          placeholder="请描述你遇到的问题或建议"
          aria-label="反馈内容"
          :invalid="!!errorMessage"
        />
      </label>

      <label class="feedback__field">
        <span class="feedback__label">联系方式（选填）</span>
        <Input v-model="contact" placeholder="邮箱或 QQ，便于我们回复你" aria-label="联系方式" />
      </label>

      <p v-if="errorMessage" class="feedback__error" role="alert">{{ errorMessage }}</p>

      <div class="feedback__actions">
        <Button type="ghost" @click="visible = false">取消</Button>
        <Button type="primary" native-type="submit" :loading="submitting">提交</Button>
      </div>
    </form>
  </Modal>
</template>

<style scoped>
.feedback__form,
.feedback__done {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
}

.feedback__hint {
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-label-tertiary);
}

.feedback__done-text {
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-label-secondary);
}

.feedback__field {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
}

.feedback__label {
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-label-secondary);
}

.feedback__error {
  font-size: var(--ui-font-size-sm);
  color: var(--ui-danger-label);
}

.feedback__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--ui-space-2);
  margin-top: var(--ui-space-2);
}
</style>

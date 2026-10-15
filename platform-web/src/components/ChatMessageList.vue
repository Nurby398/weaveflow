<script setup>
/**
 * 消息流渲染（P1-1 · 从 Chat.vue 抽出的第 1 块）
 * ------------------------------------------------------------------
 * 只负责「每条消息怎么画」：用户/助手气泡、附件、发言人条、思考条、派发卡片、
 * 消息级操作工具条（复制/重新生成/删除）。
 * 数据与动作全部由 props / emits 进出，本组件不碰 SSE、路由、store。
 */
import Avatar from '@/components/ui/Avatar.vue'
import Badge from '@/components/ui/Badge.vue'
import DispatchCard from '@/components/DispatchCard.vue'
import SpeakerBar from '@/components/SpeakerBar.vue'
import { attachmentRawUrl } from '@/api'
import { agentAvatar, BRAND_AVATAR, DEFAULT_ASSISTANT_NAME } from '@/lib/avatars'
import { memberOf } from '@/lib/dispatch'
import { formatDateTime, formatNumber, shortId } from '@/lib/format'
import { renderMarkdown, renderStreamingMarkdown } from '@/lib/markdown'

const props = defineProps({
  messages: { type: Array, default: () => [] },
  agents: { type: Array, default: () => [] },
  headerAgent: { type: Object, default: null },
  activeDispatch: { type: Object, default: null },
  thinkingSeconds: { type: Number, default: 0 },
  thinkingGif: { type: String, default: '' },
})
const emit = defineEmits(['copy', 'regenerate', 'remove', 'confirm', 'choose', 'reject'])

function speakerOf(message) {
  return memberOf(props.activeDispatch, { agentId: message.agentId, name: message.agentName })
}

/**
 * 发言人条头像：成员落到已接入 agent → 用其头像；落不到（调度器自己）→ 品牌标。
 * 刻意不走 agentAvatar 的哈希兜底，避免给未知发言人随机贴一张子智能体的脸。
 */
function speakerAvatar(message) {
  const member = speakerOf(message)
  const agentId = member?.agentId || message.agentId || ''
  const name = member?.name || message.agentName || ''
  const agent = props.agents.find((item) => item.id && item.id === agentId)
  if (agent) return agentAvatar(agent)
  return agentAvatar({ name }) || BRAND_AVATAR
}

/** 普通会话 assistant 头像：消息 agentId > 会话对应智能体 > 品牌标（不留空 src） */
function assistantAvatar(message) {
  const agent = props.agents.find((item) => item.id && item.id === message?.agentId) || props.headerAgent
  return agentAvatar(agent) || BRAND_AVATAR
}

/** 思考条发言人：消息自带身份 > 会话智能体 > 默认助手 */
function thinkingName(message) {
  return message?.agentName || props.headerAgent?.name || DEFAULT_ASSISTANT_NAME
}

/** 助手正文：生成中走流式渲染，结束后走常规渲染 */
function renderAssistant(message) {
  return message.streaming ? renderStreamingMarkdown(message.content) : renderMarkdown(message.content)
}
</script>

<template>
  <article v-for="message in messages" :key="message.id" class="msg" :class="`msg--${message.role}`">
    <!-- 派发卡片：识别意图 / 阶段进度 / 阶段完成确认 / 低置信度回问 -->
    <DispatchCard
      v-if="message.dispatch"
      :data="message.dispatch"
      @confirm="emit('confirm', message.dispatch)"
      @choose="emit('choose', message.dispatch, $event)"
      @reject="emit('reject', message.dispatch)"
    />

    <template v-else-if="message.role === 'user'">
      <div class="msg__bubble">{{ message.content }}</div>
      <ul v-if="message.attachments?.length" class="msg__files">
        <li v-for="id in message.attachments" :key="id">
          <a class="msg__file ui-mono" :href="attachmentRawUrl(id)" target="_blank" rel="noopener">
            附件 #{{ shortId(id) }}
          </a>
        </li>
      </ul>
    </template>

    <template v-else>
      <div class="msg__who">
        <SpeakerBar
          v-if="message.agentName"
          :name="message.agentName"
          :src="speakerAvatar(message)"
          :stage-no="speakerOf(message)?.stageNo ?? ''"
          :stage-count="activeDispatch?.stageCount || ''"
          :status="speakerOf(message)?.status || ''"
        />
        <Avatar v-else :src="assistantAvatar(message)" :name="headerAgent?.name || 'AI'" size="sm" />
        <Badge v-if="message.interrupted" tone="warn" dot>已中断</Badge>
      </div>
      <div class="md-body" v-html="renderAssistant(message)" />

      <p v-if="message.streaming" class="msg__thinking" role="status" aria-live="polite">
        <span class="msg__thinking-glyph" aria-hidden="true"
          ><img class="msg__thinking-gif" :src="thinkingGif" alt=""
        /></span>
        <span class="msg__thinking-text"> {{ thinkingName(message) }}思考中 · 用时 {{ thinkingSeconds }} 秒 </span>
        <span class="msg__thinking-dots" aria-hidden="true">…</span>
      </p>
      <ul v-if="message.attachments?.length" class="msg__files">
        <li v-for="id in message.attachments" :key="id">
          <a class="msg__file ui-mono" :href="attachmentRawUrl(id)" target="_blank" rel="noopener">
            附件 #{{ shortId(id) }}
          </a>
        </li>
      </ul>
      <p v-if="!message.streaming" class="msg__meta ui-mono">
        {{ formatDateTime(message.createdAt) }}
        <template v-if="message.tokensIn || message.tokensOut">
          · ↑{{ formatNumber(message.tokensIn) }} ↓{{ formatNumber(message.tokensOut) }}
        </template>
      </p>
    </template>

    <!-- 消息级操作（P0-2）：hover / 键盘聚焦出现；流式中的占位气泡不给 -->
    <div v-if="!message.streaming && message.content" class="msg__actions">
      <button type="button" class="msg__action" @click="emit('copy', message)">复制</button>
      <button
        v-if="message.role === 'assistant'"
        type="button"
        class="msg__action"
        @click="emit('regenerate', message)"
      >
        重新生成
      </button>
      <button type="button" class="msg__action msg__action--danger" @click="emit('remove', message)">删除</button>
    </div>
  </article>
</template>

<style scoped>
.msg {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
  min-width: 0;
}

/* 消息级操作（P0-2）：hover / 键盘聚焦出现，默认不占位、不打扰阅读 */
.msg__actions {
  display: flex;
  gap: var(--ui-space-2);
  opacity: 0;
  transition: opacity var(--ui-duration-fast) var(--ui-ease-standard);
}

.msg:hover .msg__actions,
.msg:focus-within .msg__actions {
  opacity: 1;
}

.msg__action {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--ui-text-caption);
  font-size: var(--ui-font-size-caption);
  cursor: pointer;
}

.msg__action:hover {
  color: var(--ui-text-label-secondary);
}

.msg__action--danger:hover {
  color: var(--ui-danger-label);
}

/* 用户消息：右对齐浅灰气泡，无边框、无阴影（气泡本身就是容器） */
.msg--user {
  align-items: flex-end;
}

.msg__bubble {
  max-width: 78%;
  padding: var(--ui-space-2) var(--ui-space-4);
  background: var(--ui-bg-layer-2);
  -webkit-backdrop-filter: var(--ui-glass-blur);
  backdrop-filter: var(--ui-glass-blur);
  border-radius: var(--ui-radius-panel);
  color: var(--ui-text-primary);
  font-size: var(--ui-font-size-base);
  line-height: var(--ui-line-height-base);
  white-space: pre-wrap;
  overflow-wrap: break-word;
}

/* 助手消息：正文直接铺在底色上，不加气泡——长回答套气泡会显得拥挤 */
.msg--assistant {
  align-items: stretch;
}

.msg__who {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-caption);
}

.msg__meta {
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-dimmed);
}

/*
 * 生成中提示（batch 6a）：小图标 + 「XX 思考中 · 用时 N 秒」 + 呼吸的省略号。
 * 轻量、落在消息流里，不铺底色、不遮内容；动效时长与缓动一律走令牌，不写死数值。
 * ⚠️ 白标铁律：措辞只用中性的「思考中」，绝不透出上游模型的中文公司名。
 */
.msg__thinking {
  display: flex;
  align-items: center;
  gap: var(--ui-space-1);
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-caption);
}

.msg__thinking-glyph {
  display: inline-flex;
  align-items: center;
  line-height: 1;
}

/* 思考动图：**必须显式定尺寸**——GIF 原始尺寸是 150×151，不约束会把整行撑开 */
.msg__thinking-gif {
  display: block;
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.msg__thinking-dots {
  animation: msg-thinking-pulse var(--ui-duration-slow) var(--ui-ease-standard) infinite alternate;
}

@keyframes msg-thinking-pulse {
  from {
    opacity: 0.25;
  }

  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .msg__thinking-dots {
    animation: none;
  }

  /* 动图无法用 CSS 暂停：减少动态偏好下直接隐藏，状态仍由文字（织流思考中 · 用时 N 秒）传达 */
  .msg__thinking-gif {
    display: none;
  }
}

.msg__files {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-2);
}

.msg__file {
  display: inline-block;
  padding: 2px var(--ui-space-2);
  border: 1px solid var(--ui-border-l2);
  border-radius: var(--ui-radius-pill);
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-tertiary);
}

.msg__file:hover {
  border-color: var(--ui-primary);
  color: var(--ui-primary-text);
}

/* 派发卡片消息：与 assistant 消息同宽铺满，不缩进 */
.msg--dispatch {
  align-items: stretch;
}
</style>

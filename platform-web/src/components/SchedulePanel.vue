<script setup>
/**
 * SchedulePanel 侧栏「当前调度」面板（方案 §3.6）
 * ------------------------------------------------------------------
 * 位置：插在 `.chat__rail`（264px）里、会话列表**上方**，可折叠；会话列表保留并滚动。
 * 硬约束：264px 塞不下横向 Steps → 用「一条细进度条 + 1/5 文字」；成员行 = 序号 + 名字
 * （超长截断）+ 状态点，当前发言人高亮。
 *
 * 展示型组件：**不持有也不另拉任何状态**。面板的全部内容从传入的 `state`
 * （＝ Chat.vue 里那份 activeDispatch，见 lib/dispatch.js）派生 —— 单一真源。
 * 成员状态只用流水线既有枚举 pending/waiting/running/validated/failed。
 * ------------------------------------------------------------------
 */
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import Icon from '@/components/ui/Icon.vue'
import {
  isDispatched,
  overallText,
  overallTone,
  progressLabel,
  progressRatio,
  statusOf,
  statusText,
} from '@/lib/dispatch'

const props = defineProps({
  /** 单一真源：activeDispatch（见 lib/dispatch.js） */
  state: { type: Object, required: true },
  /** 未派发时的示例意图芯片（字符串数组，演示通道提供） */
  examples: { type: Array, default: () => [] },
  collapsed: { type: Boolean, default: false },
  /** 演示通道开关：开启时面板顶部带「演示数据」标注 */
  mock: { type: Boolean, default: false },
})

const emit = defineEmits(['update:collapsed', 'member', 'pause', 'resume', 'takeover', 'release', 'intent'])

function toggle() {
  emit('update:collapsed', !props.collapsed)
}

function memberLabel(member) {
  return `${member.name} · ${statusText(member.status)}`
}
</script>

<template>
  <section class="sched" :class="{ 'is-collapsed': collapsed }" aria-label="当前调度">
    <header class="sched__head">
      <button class="sched__toggle" type="button" :aria-expanded="!collapsed" @click="toggle">
        <Icon class="sched__toggle-icon" :name="collapsed ? 'expand' : 'fold'" :size="14" />
        <span class="sched__title">当前调度</span>
      </button>
      <Badge v-if="mock" tone="warn" dot>演示数据</Badge>
    </header>

    <div v-if="!collapsed" class="sched__body">
      <!-- 已派发：团队 + 进度 + 成员 + 控制权 -->
      <template v-if="isDispatched(state)">
        <div class="sched__team">
          <span class="sched__team-name">{{ state.teamName || '未命名团队' }}</span>
          <Badge :tone="overallTone(state.status)">{{ overallText(state.status) }}</Badge>
        </div>

        <div class="sched__progress">
          <span class="sched__bar" aria-hidden="true">
            <span class="sched__bar-fill" :style="{ width: `${Math.round(progressRatio(state) * 100)}%` }" />
          </span>
          <span class="sched__count ui-mono">{{ progressLabel(state) }}</span>
        </div>

        <ul class="sched__members ui-scroll">
          <li v-for="(member, index) in state.members" :key="member.agentId || member.name" class="sched__member">
            <button
              class="sched__member-btn"
              :class="{ 'is-speaking': member.agentId && member.agentId === state.currentAgentId }"
              type="button"
              :title="memberLabel(member)"
              :aria-label="memberLabel(member)"
              @click="emit('member', member)"
            >
              <span class="sched__no ui-mono">{{ index + 1 }}</span>
              <span class="sched__name">{{ member.name }}</span>
              <span class="sched__dot" :class="`is-${statusOf(member.status)}`" aria-hidden="true" />
            </button>
          </li>
        </ul>

        <div class="sched__actions">
          <Button size="sm" type="ghost" @click="state.paused ? emit('resume') : emit('pause')">
            {{ state.paused ? '继续调度' : '暂停调度' }}
          </Button>
          <Button
            size="sm"
            :type="state.takeover ? 'info' : 'ghost'"
            @click="state.takeover ? emit('release') : emit('takeover')"
          >
            {{ state.takeover ? '交还调度' : '接管' }}
          </Button>
        </div>
        <p v-if="state.paused" class="sched__hint">调度已暂停：阶段不再推进，「确认并进入下一阶段」被拦下。</p>
        <p v-else-if="state.takeover" class="sched__hint">已接管：输入框里的消息直接发给当前成员，不再走阶段派发。</p>
      </template>

      <!-- 未派发：一个说明 + 2–3 个示例意图芯片（点击即派发） -->
      <template v-else>
        <p class="sched__empty">尚未派发 · 说说你想做什么</p>
        <div class="sched__chips">
          <button
            v-for="example in examples"
            :key="example"
            class="sched__chip"
            type="button"
            @click="emit('intent', example)"
          >
            {{ example }}
          </button>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
/* 面板底色比侧栏再深一档，靠 1px 描边与下方会话列表分开（不用阴影） */
.sched {
  flex: none;
  margin: 0 var(--ui-space-2) var(--ui-space-2);
  border: 1px solid var(--ui-border-l1);
  border-radius: var(--ui-radius-3);
  background: var(--ui-bg-layer-1);
  -webkit-backdrop-filter: var(--ui-glass-blur);
  backdrop-filter: var(--ui-glass-blur);
}

.sched__head {
  display: flex;
  align-items: center;
  gap: var(--ui-space-1);
  padding: var(--ui-space-2) var(--ui-space-2) var(--ui-space-2) var(--ui-space-1);
}

.sched__toggle {
  flex: 1;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-1);
  padding: var(--ui-space-1);
  border: none;
  border-radius: var(--ui-radius-2);
  background: transparent;
  color: var(--ui-text-caption);
  cursor: pointer;
}

.sched__toggle:hover {
  background: var(--ui-interactive-hover);
  color: var(--ui-text-primary);
}

.sched__toggle-icon {
  color: var(--ui-text-caption);
}

.sched__title {
  font-size: var(--ui-font-size-caption);
  color: inherit;
}

.sched__body {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
  padding: 0 var(--ui-space-2) var(--ui-space-2);
}

.sched__team {
  display: flex;
  align-items: center;
  gap: var(--ui-space-1);
}

.sched__team-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-medium);
  color: var(--ui-text-primary);
}

.sched__progress {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
}

.sched__bar {
  flex: 1;
  min-width: 0;
  height: 3px;
  overflow: hidden;
  border-radius: var(--ui-radius-1);
  background: var(--ui-bg-layer-3);
}

.sched__bar-fill {
  display: block;
  height: 100%;
  background: var(--ui-primary);
  transition: width var(--ui-duration-base) var(--ui-ease-standard);
}

.sched__count {
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-caption);
}

.sched__members {
  display: flex;
  flex-direction: column;
  gap: 1px;
  max-height: 140px;
}

.sched__member-btn {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  width: 100%;
  height: 26px;
  padding: 0 var(--ui-space-1);
  border: none;
  border-radius: var(--ui-radius-2);
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background var(--ui-duration-fast) var(--ui-ease-standard);
}

.sched__member-btn:hover {
  background: var(--ui-interactive-hover);
}

/* 当前发言人：底色 + 主色字（不靠字号变化，避免行高跳动） */
.sched__member-btn.is-speaking {
  background: var(--ui-interactive-active);
}

.sched__member-btn.is-speaking .sched__name {
  color: var(--ui-primary-text);
  font-weight: var(--ui-font-weight-medium);
}

.sched__no {
  flex: none;
  width: 12px;
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-dimmed);
}

.sched__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-secondary);
}

.sched__dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: var(--ui-radius-circle);
  background: var(--ui-text-dimmed);
}

.sched__dot.is-pending {
  background: var(--ui-text-dimmed);
}

.sched__dot.is-waiting {
  background: var(--ui-warn-label);
}

.sched__dot.is-running {
  background: var(--ui-primary);
}

.sched__dot.is-validated {
  background: var(--ui-success-label);
}

.sched__dot.is-failed {
  background: var(--ui-danger-label);
}

/* 当前发言人的点加一圈光晕，与高亮色同源 */
.sched__member-btn.is-speaking .sched__dot {
  box-shadow: 0 0 0 2px var(--ui-interactive-active);
}

.sched__actions {
  display: flex;
  gap: var(--ui-space-2);
}

.sched__hint {
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-caption);
  line-height: var(--ui-line-height-base);
}

.sched__empty {
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-caption);
  line-height: var(--ui-line-height-base);
}

.sched__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-1);
}

.sched__chip {
  max-width: 100%;
  padding: 2px var(--ui-space-2);
  border: 1px solid var(--ui-border-l2);
  border-radius: var(--ui-radius-pill);
  background: transparent;
  color: var(--ui-text-tertiary);
  font-size: var(--ui-font-size-caption);
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition:
    border-color var(--ui-duration-fast) var(--ui-ease-standard),
    color var(--ui-duration-fast) var(--ui-ease-standard);
}

.sched__chip:hover {
  border-color: var(--ui-primary);
  color: var(--ui-primary-text);
}
</style>

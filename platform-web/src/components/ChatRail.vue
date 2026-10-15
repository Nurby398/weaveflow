<script setup>
/**
 * 会话侧栏（P1-1 · 从 Chat.vue 抽出的第 3 块）
 * ------------------------------------------------------------------
 * 只负责「侧栏怎么画」：新建对话、调度面板、搜索、时间分组、会话行（打开/改名/⋯菜单）。
 * 所有数据与动作经 props / emits 进出；本组件不碰 SSE、路由、store。
 * 会话行上的 ⋯ 浮层菜单仍在宿主渲染（它是 body 级定位，不受本组件滚动容器裁剪）。
 */
import Avatar from '@/components/ui/Avatar.vue'
import Badge from '@/components/ui/Badge.vue'
import Input from '@/components/ui/Input.vue'
import Icon from '@/components/ui/Icon.vue'
import SchedulePanel from '@/components/SchedulePanel.vue'
import { agentAvatar, BRAND_AVATAR } from '@/lib/avatars'
import { shortId } from '@/lib/format'

const props = defineProps({
  conversations: { type: Array, default: () => [] },
  conversationGroups: { type: Array, default: () => [] },
  conversationId: { type: String, default: '' },
  renamingId: { type: String, default: '' },
  renameDraft: { type: String, default: '' },
  menuForId: { type: String, default: '' },
  loggedIn: { type: Boolean, default: false },
  agents: { type: Array, default: () => [] },
  conversationQuery: { type: String, default: '' },
  hasDispatch: { type: Boolean, default: false },
  activeDispatch: { type: Object, default: null },
  demoExamples: { type: Array, default: () => [] },
  panelCollapsed: { type: Boolean, default: false },
  mockDispatch: { type: Boolean, default: false },
})
const emit = defineEmits([
  'new',
  'open',
  'update:conversationQuery',
  'rename-input-ref',
  'rename-submit',
  'rename-cancel',
  'update:renameDraft',
  'toggle-menu',
  'update:panelCollapsed',
  'open-member-drawer',
  'pause',
  'resume',
  'takeover',
  'release',
  'intent',
])

function conversationAvatar(item) {
  const agentId = item?.agentDefId || ''
  const agent = agentId ? props.agents.find((entry) => entry.id === agentId) : null
  return (agent ? agentAvatar(agent) : '') || BRAND_AVATAR
}
</script>

<template>
  <aside class="chat__rail">
    <div class="chat__rail-head">
      <button class="chat__new" type="button" @click="emit('new')">
        <span class="chat__new-icon" aria-hidden="true">＋</span>
        <span>新建对话</span>
      </button>
    </div>

    <SchedulePanel
      v-if="hasDispatch"
      :state="activeDispatch"
      :examples="demoExamples"
      :collapsed="panelCollapsed"
      :mock="mockDispatch"
      @update:collapsed="emit('update:panelCollapsed', $event)"
      @member="emit('open-member-drawer', $event)"
      @pause="emit('pause')"
      @resume="emit('resume')"
      @takeover="emit('takeover', $event)"
      @release="emit('release')"
      @intent="emit('intent', $event)"
    />

    <div class="chat__rail-title-row">
      <span class="chat__rail-label">会话</span>
      <Badge tone="neutral">{{ conversations.length }}</Badge>
    </div>

    <div class="chat__rail-search">
      <Input
        :model-value="conversationQuery"
        aria-label="搜索会话"
        placeholder="搜索会话"
        @update:model-value="emit('update:conversationQuery', $event)"
      />
    </div>

    <ul class="chat__rail-list ui-scroll">
      <template v-for="group in conversationGroups" :key="group.key">
        <li class="chat__rail-group">{{ group.label }}</li>
        <li
          v-for="item in group.items"
          :key="item.id"
          class="chat__row"
          :class="{ 'is-active': item.id === conversationId, 'is-editing': item.id === renamingId }"
        >
          <Avatar class="chat__row-avatar" :src="conversationAvatar(item)" :name="item.title || '会话'" size="sm" />
          <button
            v-if="item.id !== renamingId"
            class="chat__row-open"
            type="button"
            :title="`阶段 ${item.stageNo ?? '—'} · #${shortId(item.id)}`"
            @click="emit('open', item.id)"
          >
            <span class="chat__row-title">{{ item.title || '未命名会话' }}</span>
          </button>

          <input
            v-else
            :ref="(el) => emit('rename-input-ref', el)"
            :value="renameDraft"
            class="chat__row-input"
            type="text"
            maxlength="100"
            aria-label="会话标题"
            @input="emit('update:renameDraft', $event.target.value)"
            @keydown.enter.prevent="emit('rename-submit', item)"
            @keydown.esc.prevent="emit('rename-cancel')"
            @blur="emit('rename-submit', item)"
          />

          <button
            v-if="item.id !== renamingId"
            class="chat__row-more"
            :class="{ 'is-open': menuForId === item.id }"
            type="button"
            data-chat-more
            aria-haspopup="menu"
            :aria-expanded="menuForId === item.id"
            aria-label="会话操作"
            @click="emit('toggle-menu', item.id, $event)"
          >
            <Icon name="more" :size="16" />
          </button>
        </li>
      </template>
      <li v-if="!conversations.length" class="chat__rail-empty">
        {{ loggedIn ? '还没有会话，点上方「新建对话」开始' : '登录后加载会话' }}
      </li>
      <li v-else-if="!conversationGroups.length" class="chat__rail-empty">没有匹配的会话</li>
    </ul>
  </aside>
</template>

<style scoped>
.chat__rail {
  flex: none;
  width: 264px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--ui-bg-layer-2);
  -webkit-backdrop-filter: var(--ui-glass-blur);
  backdrop-filter: var(--ui-glass-blur);
  border-right: 1px solid var(--ui-glass-stroke);
}

.chat__rail-head {
  padding: var(--ui-space-4) var(--ui-space-3) var(--ui-space-3);
}

/* 「新建对话」是全页主操作，用活力橙点缀做强调——
   依据（用户原话）：「在一些地方加一点活力橙啊这些颜色」 */
.chat__new {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--ui-space-2);
  width: 100%;
  height: 40px;
  border: 1px solid var(--ui-accent-orange-stroke);
  border-radius: var(--ui-radius-pill);
  background: var(--ui-accent-orange-fill);
  -webkit-backdrop-filter: var(--ui-glass-blur);
  backdrop-filter: var(--ui-glass-blur);
  color: var(--ui-accent-orange-text);
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-medium);
  cursor: pointer;
  transition:
    border-color var(--ui-duration-fast) var(--ui-ease-standard),
    background var(--ui-duration-fast) var(--ui-ease-standard),
    color var(--ui-duration-fast) var(--ui-ease-standard);
}

.chat__new:hover {
  border-color: var(--ui-accent-orange);
  background: var(--ui-accent-orange);
  color: var(--ui-text-on-accent);
}

.chat__new-icon {
  font-size: var(--ui-font-size-base);
  line-height: 1;
}

.chat__rail-title-row {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  padding: 0 var(--ui-space-4) var(--ui-space-2);
}

.chat__rail-label {
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-caption);
}

.chat__rail-search {
  padding: 0 var(--ui-space-4) var(--ui-space-2);
}

.chat__rail-list {
  flex: 1;
  min-height: 0;
  padding: 0 var(--ui-space-2) var(--ui-space-3);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* 月份分组标题：12px + 辅助文字色，与列表其它说明文字同一档 */
.chat__rail-group {
  padding: var(--ui-space-3) var(--ui-space-4) var(--ui-space-1);
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-caption);
}

/*
 * 会话行：几何照参照页实测 —— 高 40px、圆角 12px、内边距 9px 10px、字号 14px。
 * 行内是「小头像 + 标题 + ⋯ 按钮」的 flex 单行（batch 6a 在标题左侧加了头像）；
 * 参照页同高的行也是单行，原先的两行（标题 + 阶段/ID）在 40px 内放不下，
 * 故阶段与 ID 改挂 title 属性不丢信息。
 * ⚠️ 行高、内边距、文字截断行为是既有几何：头像只占标题左侧的位置，
 *    不参与撑高（24px 头像落在 40px 行的居中位置），⋯ 按钮仍 flex: none 不被挤。
 */
.chat__row {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--ui-space-1);
  height: 40px;
  padding: 9px 10px;
  border-radius: var(--ui-radius-4);
  transition:
    background var(--ui-duration-fast) var(--ui-ease-standard),
    box-shadow var(--ui-duration-fast) var(--ui-ease-standard);
}

/* hover 反馈加强一档（依据用户原话「ui 互动效果显著一点，可以适当增加悬浮，阴影等效果」）：
   只调样式，会话列表的增删改逻辑一行未动。 */
.chat__row:hover {
  background: var(--ui-interactive-hover-strong);
  box-shadow: var(--ui-shadow-hover);
}

/* 选中态：浅底 + 主色字，不用左侧色条，保持安静 */
.chat__row.is-active {
  background: var(--ui-interactive-active);
}

/*
 * 会话行的小头像（batch 6a）：尺寸走 ui/Avatar 的 size="sm"（24px），
 * 这里只补一条「不吃行高、不压缩」；颜色/圆角/边框仍由 Avatar 自己按令牌画。
 * flex: none —— 标题再长也不能把头像压扁，截断仍只发生在标题上。
 */
.chat__row-avatar {
  flex: none;
}

.chat__row-open {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0;
  border: none;
  /* 圆角跟随行（12px），避免全局按钮胶囊默认值画出与行不同形的焦点环 */
  border-radius: inherit;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.chat__row-title {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--ui-font-size-base);
  color: var(--ui-text-secondary);
}

.chat__row.is-active .chat__row-title {
  color: var(--ui-primary-text);
  font-weight: var(--ui-font-weight-medium);
}

/*
 * 行内改名：外层仍与会话行同位同形（40px / 12px 圆角），内层输入框透明无边框无阴影。
 * 焦点态用「同形的 1px 内贴描边」——与项目统一的输入框焦点语言一致，
 * 不是胶囊、也不加 box-shadow 外环。
 */
.chat__row.is-editing:focus-within {
  outline: 1px solid var(--ui-primary);
  outline-offset: -1px;
  box-shadow: none;
}

.chat__row-input {
  flex: 1;
  min-width: 0;
  width: 100%;
  height: 100%;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--ui-text-primary);
  font-size: var(--ui-font-size-base);
  /* 焦点描边画在外层行上，内层不再画自己的 outline */
  outline: none;
  box-shadow: none;
}

/*
 * ⋯ 按钮：28×28 圆形。
 * 默认 opacity:0 而不是 display/visibility —— 后两者会把按钮移出 Tab 顺序，
 * 键盘就走不到它；opacity 不改变可聚焦性，聚焦时靠 :focus-within 浮出。
 */
.chat__row-more {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: var(--ui-radius-circle);
  background: transparent;
  color: var(--ui-text-caption);
  cursor: pointer;
  opacity: 0;
  transition:
    opacity var(--ui-duration-fast) var(--ui-ease-standard),
    background var(--ui-duration-fast) var(--ui-ease-standard),
    color var(--ui-duration-fast) var(--ui-ease-standard);
}

.chat__row:hover .chat__row-more,
.chat__row:focus-within .chat__row-more,
.chat__row-more.is-open {
  opacity: 1;
}

.chat__row-more:hover {
  background: var(--ui-interactive-active);
  color: var(--ui-text-primary);
}

.chat__rail-empty {
  padding: var(--ui-space-3);
  font-size: var(--ui-font-size-caption);
  color: var(--ui-text-caption);
  line-height: var(--ui-line-height-base);
}
</style>

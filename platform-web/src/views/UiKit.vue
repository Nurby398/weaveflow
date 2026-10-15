<script setup>
/**
 * /__ui 视觉验收页 —— 开发者工具，不是业务页
 * ------------------------------------------------------------------
 * 一页展示全部设计令牌与全部基础组件。
 * 令牌取值不写死在模板里，而是用 getComputedStyle 从根节点读取。
 *
 * 入口只在开发时出现：判定写在 Layout.vue，取值来自 vite.config.js 的 define
 * 注入的 __SHOW_DEVTOOLS__（dev 为 true / build 为 false），不受 NODE_ENV 影响。
 * 路由本身保留，生产环境可按 URL 直达，便于排查线上令牌问题。
 * 依据（用户原话）：「目前的视觉验收页面还没有按照你说的隐藏到开发者模式下，
 *   这一块你要设计一下，要合理且要让开发知道它的作用，要有简单介绍」。
 */
import { computed, onMounted, ref } from 'vue'
import Avatar from '@/components/ui/Avatar.vue'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import Drawer from '@/components/ui/Drawer.vue'
import Empty from '@/components/ui/Empty.vue'
import Input from '@/components/ui/Input.vue'
import Modal from '@/components/ui/Modal.vue'
import Select from '@/components/ui/Select.vue'
import Tabs from '@/components/ui/Tabs.vue'
import Textarea from '@/components/ui/Textarea.vue'
import Tooltip from '@/components/ui/Tooltip.vue'
import { useToast } from '@/composables/useToast'

// Toast 用于演示四种提示。本页原有的明暗切换按钮已删除（主题切换统一放在 Navbar 的 ThemeToggle）。
const toast = useToast()
/** Badge / Checkbox 演示状态 */
const kitChecked = ref(true)

/* ---------------------------- 令牌清单 ---------------------------- */
const colorGroups = [
  {
    title: '背景分层',
    tokens: [
      '--ui-bg-base',
      '--ui-bg-layer-1',
      '--ui-bg-layer-2',
      '--ui-bg-layer-3',
      '--ui-bg-overlay',
      '--ui-bg-module',
      '--ui-bg-skeleton',
    ],
  },
  { title: '遮罩', tokens: ['--ui-mask-1', '--ui-mask-2', '--ui-mask-3'] },
  {
    title: '玻璃族（毛玻璃三层配方）',
    tokens: [
      '--ui-glass-bg',
      '--ui-glass-bg-strong',
      '--ui-glass-bg-soft',
      '--ui-glass-bg-inset',
      '--ui-glass-stroke',
      '--ui-glass-highlight',
      '--ui-glass-outer',
      '--ui-glass-shadow-1',
      '--ui-glass-shadow-2',
      '--ui-glass-blur',
      '--ui-glass-bg-fallback',
      '--ui-glass-bg-strong-fallback',
    ],
  },
  { title: '视频背景与蒙版', tokens: ['--ui-app-scrim', '--ui-app-fallback', '--ui-bg-void'] },
  { title: '描边四级坡', tokens: ['--ui-border-l1', '--ui-border-l2', '--ui-border-l3', '--ui-border-l4'] },
  {
    title: '品牌色',
    tokens: ['--ui-primary', '--ui-primary-hover', '--ui-primary-text', '--ui-primary-inverted'],
  },
  {
    title: '交互态',
    tokens: [
      '--ui-interactive-hover',
      '--ui-interactive-hover-strong',
      '--ui-interactive-active',
      '--ui-interactive-hover-solid',
    ],
  },
  {
    title: '按钮',
    tokens: [
      '--ui-btn-primary-fill',
      '--ui-btn-primary-hover',
      '--ui-btn-info-fill',
      '--ui-btn-elevated-fill',
      '--ui-btn-floating-fill',
      '--ui-btn-floating-hover',
      '--ui-btn-ghost-active-fill',
    ],
  },
  {
    title: '文本层级',
    tokens: [
      '--ui-text-label-primary',
      '--ui-text-label-secondary',
      '--ui-text-label-tertiary',
      '--ui-text-caption',
      '--ui-text-dimmed',
      '--ui-text-inverted',
    ],
  },
  {
    title: '状态语义',
    tokens: [
      '--ui-warn-fill',
      '--ui-warn-label',
      '--ui-danger-fill',
      '--ui-danger-label',
      '--ui-success-fill',
      '--ui-success-label',
      '--ui-info-fill',
      '--ui-info-label',
    ],
  },
  {
    title: '滚动条与选区',
    tokens: [
      '--ui-scrollbar-size',
      '--ui-scrollbar-thumb',
      '--ui-scrollbar-thumb-hover',
      '--ui-scrollbar-track',
      '--ui-selection-bg',
      '--ui-selection-text',
    ],
  },
  { title: '焦点环', tokens: ['--ui-focus-ring'] },
]

const metricGroups = [
  { title: '阴影', tokens: ['--ui-shadow-1', '--ui-shadow-2', '--ui-shadow-3', '--ui-shadow-4', '--ui-shadow-hover'] },
  /* 悬浮位移：hover 抬升用的 transform（卡片 -2px / 控件 -1px） */
  { title: '悬浮位移', tokens: ['--ui-lift-hover', '--ui-lift-hover-sm'] },
  {
    title: '圆角',
    tokens: [
      '--ui-radius-1',
      '--ui-radius-2',
      '--ui-radius-3',
      '--ui-radius-4',
      '--ui-radius-5',
      '--ui-radius-panel',
      '--ui-radius-pill',
    ],
  },
  {
    title: '动效',
    tokens: ['--ui-duration-fast', '--ui-duration-base', '--ui-duration-slow', '--ui-ease-standard'],
  },
  { title: '字体栈', tokens: ['--ui-font-sans', '--ui-font-mono'] },
  {
    title: '字号',
    tokens: [
      '--ui-font-size-caption',
      '--ui-font-size-sm',
      '--ui-font-size-base',
      '--ui-font-size-lg',
      '--ui-font-size-title',
      '--ui-font-size-display',
    ],
  },
  {
    title: '字重与行高',
    tokens: [
      '--ui-font-weight-regular',
      '--ui-font-weight-medium',
      '--ui-font-weight-semibold',
      '--ui-line-height-tight',
      '--ui-line-height-base',
      '--ui-line-height-loose',
    ],
  },
  {
    title: '间距',
    tokens: ['--ui-space-1', '--ui-space-2', '--ui-space-3', '--ui-space-4', '--ui-space-5', '--ui-space-6'],
  },
  {
    title: '布局',
    tokens: ['--ui-layout-navbar-height', '--ui-layout-sidebar-width', '--ui-layout-sidebar-collapsed-width'],
  },
  {
    title: '层级',
    tokens: ['--ui-z-navbar', '--ui-z-drawer', '--ui-z-modal', '--ui-z-tooltip', '--ui-z-toast'],
  },
]

const allTokens = [...colorGroups, ...metricGroups].flatMap((group) => group.tokens)
const resolved = ref({})

function readTokens() {
  const styles = getComputedStyle(document.documentElement)
  const map = {}
  for (const name of allTokens) map[name] = styles.getPropertyValue(name).trim()
  resolved.value = map
}

const missingTokens = computed(() => allTokens.filter((name) => !resolved.value[name]))

onMounted(readTokens)
// 令牌只在挂载时读一次：在别处切换主题后，刷新本页才能看到新取值（本页是自查用，不做响应式）

/* ---------------------------- 组件演示状态 ---------------------------- */
const inputValue = ref('')
const inputDisabled = ref('不可编辑')
const inputInvalid = ref('格式错误')
const textareaValue = ref('')
const selectValue = ref('')
const modalOpen = ref(false)
const drawerOpen = ref(false)
const activeTab = ref('token')
const activePillTab = ref('a')

const selectOptions = [
  { label: '规划型智能体', value: 'planner' },
  { label: '检索型智能体', value: 'retriever' },
  { label: '编码型智能体', value: 'coder', disabled: true },
]

const tabs = [
  { key: 'token', label: '令牌' },
  { key: 'component', label: '组件' },
  { key: 'disabled', label: '禁用项', disabled: true },
]

const pillTabs = [
  { key: 'a', label: '概览' },
  { key: 'b', label: '日志' },
]

function fireToast(type) {
  const text = { info: '这是一条信息提示', success: '操作已成功', warning: '请注意配额', error: '请求失败，请重试' }
  toast.push({ type, message: text[type], title: `Toast · ${type}` })
}
</script>

<template>
  <div class="uikit">
    <header class="uikit__head">
      <div class="uikit__badges">
        <Badge tone="info" dot>开发工具</Badge>
      </div>
      <h1>视觉验收页</h1>
      <p class="uikit__intro">
        这是设计令牌与基础组件的自查页，不是业务页面：改完 tokens.css
        后打开它，一页就能确认颜色、尺度、组件的取值有没有跑偏。每张色板与每个尺度行下方是 getComputedStyle 从 :root
        读到的实时取值，和代码里的定义对不上就说明漏改了。入口只在 npm run dev 的侧栏出现，npm run build
        的产物里没有它（路由保留，按 URL 直达可用于排查线上令牌）。
      </p>
      <p class="uikit__sub">
        共 {{ allTokens.length }} 个令牌，缺失
        <strong :class="{ 'is-bad': missingTokens.length }">{{ missingTokens.length }}</strong> 个。
      </p>
    </header>

    <!-- ------------------------- 令牌色板 ------------------------- -->
    <section class="uikit__section">
      <h2>设计令牌 · 颜色</h2>
      <div v-for="group in colorGroups" :key="group.title" class="uikit__group">
        <h3 class="uikit__group-title">{{ group.title }}</h3>
        <div class="uikit__swatches">
          <div v-for="name in group.tokens" :key="name" class="uikit__swatch">
            <span class="uikit__chip" :style="{ background: `var(${name})` }" aria-hidden="true" />
            <span class="uikit__swatch-text">
              <code class="uikit__name">{{ name }}</code>
              <span class="uikit__value">{{ resolved[name] || '读取失败' }}</span>
            </span>
          </div>
        </div>
      </div>
    </section>

    <!-- ------------------------- 其他令牌 ------------------------- -->
    <section class="uikit__section">
      <h2>设计令牌 · 尺度与动效</h2>
      <div v-for="group in metricGroups" :key="group.title" class="uikit__group">
        <h3 class="uikit__group-title">{{ group.title }}</h3>
        <ul class="uikit__metrics">
          <li v-for="name in group.tokens" :key="name" class="uikit__metric">
            <code class="uikit__name">{{ name }}</code>
            <span class="uikit__value">{{ resolved[name] || '读取失败' }}</span>
          </li>
        </ul>
      </div>
    </section>

    <!-- --------------------------- 按钮 --------------------------- -->
    <section class="uikit__section">
      <h2>Button</h2>
      <div class="uikit__row">
        <Button type="primary">主要按钮</Button>
        <Button type="info">次要按钮</Button>
        <Button type="elevated">抬升按钮</Button>
        <Button type="floating">悬浮按钮</Button>
        <Button type="ghost">幽灵按钮</Button>
        <Button type="text">文字按钮</Button>
        <Button type="danger">危险按钮</Button>
      </div>
      <div class="uikit__row">
        <Button type="primary" size="sm">小号</Button>
        <Button type="primary" loading>加载中</Button>
        <Button type="primary" disabled>禁用</Button>
        <Button type="info" block>块级按钮</Button>
      </div>
    </section>

    <!-- --------------------------- 输入 --------------------------- -->
    <section class="uikit__section">
      <h2>Input / Textarea / Select</h2>
      <div class="uikit__grid">
        <Input v-model="inputValue" placeholder="基础输入框" aria-label="基础输入" clearable />
        <Input v-model="inputValue" placeholder="带前后缀" aria-label="带前后缀输入">
          <template #prefix>⌘</template>
          <template #suffix>↵</template>
        </Input>
        <Input v-model="inputDisabled" disabled aria-label="禁用输入" />
        <Input v-model="inputInvalid" invalid aria-label="错误态输入" />
        <Input v-model="inputValue" size="sm" placeholder="小号输入框" aria-label="小号输入" />
        <Select v-model="selectValue" :options="selectOptions" placeholder="请选择智能体" aria-label="智能体选择" />
      </div>
      <Textarea
        v-model="textareaValue"
        :maxlength="200"
        show-count
        placeholder="请输入编排目标…"
        aria-label="编排目标"
      />
    </section>

    <!-- --------------------------- 浮层 --------------------------- -->
    <section class="uikit__section">
      <h2>Modal / Drawer</h2>
      <div class="uikit__row">
        <Button type="primary" @click="modalOpen = true">打开 Modal</Button>
        <Button type="info" @click="drawerOpen = true">打开 Drawer</Button>
      </div>
      <Modal v-model="modalOpen" title="编排确认" width="420px">
        <p>Esc 可关闭，遮罩点击可关闭，Tab 焦点被限制在弹窗内。</p>
        <template #footer>
          <Button type="ghost" @click="modalOpen = false">取消</Button>
          <Button type="primary" @click="modalOpen = false">确认</Button>
        </template>
      </Modal>
      <Drawer v-model="drawerOpen" title="运行日志" placement="right" size="360px">
        <p>抽屉同样使用 Teleport 渲染到 body，支持 Esc 与遮罩关闭。</p>
        <template #footer>
          <Button type="info" @click="drawerOpen = false">关闭</Button>
        </template>
      </Drawer>
    </section>

    <!-- --------------------------- Toast --------------------------- -->
    <section class="uikit__section">
      <h2>Toast</h2>
      <div class="uikit__row">
        <Button type="info" @click="fireToast('info')">信息</Button>
        <Button type="info" @click="fireToast('success')">成功</Button>
        <Button type="info" @click="fireToast('warning')">警告</Button>
        <Button type="info" @click="fireToast('error')">错误</Button>
      </div>
    </section>

    <!-- --------------------------- Tabs --------------------------- -->
    <section class="uikit__section">
      <h2>Tabs</h2>
      <Tabs v-model="activeTab" :tabs="tabs" variant="line">
        <template #default="{ active }">
          <p>当前标签：{{ active }}（方向键可切换，Home/End 跳到首尾）</p>
        </template>
      </Tabs>
      <Tabs v-model="activePillTab" :tabs="pillTabs" variant="pill">
        <template #default="{ active }"
          ><p>切角标签样式当前标签：{{ active }}</p></template
        >
      </Tabs>
    </section>

    <!-- ------------------------ Avatar / Tooltip ------------------------ -->
    <section class="uikit__section">
      <h2>Avatar / Tooltip</h2>
      <div class="uikit__row">
        <Avatar name="编" size="sm" />
        <Avatar name="排" size="md" />
        <Avatar name="平台" size="lg" />
        <Avatar name="占位" shape="square" />
        <Tooltip content="上方提示">
          <Button type="info">悬停我 · top</Button>
        </Tooltip>
        <Tooltip content="下方提示" placement="bottom">
          <Button type="info">bottom</Button>
        </Tooltip>
        <Tooltip content="左侧提示" placement="left">
          <Button type="info">left</Button>
        </Tooltip>
        <Tooltip content="右侧提示" placement="right">
          <Button type="info">right</Button>
        </Tooltip>
      </div>
    </section>

    <!-- --------------------- Badge / Checkbox / Empty --------------------- -->
    <section class="uikit__section">
      <h2>Badge / Checkbox / Empty</h2>
      <div class="uikit__row">
        <Badge tone="neutral">阶段 3</Badge>
        <Badge tone="info" dot>streaming</Badge>
        <Badge tone="success" dot>连通</Badge>
        <Badge tone="warn">已截断</Badge>
        <Badge tone="danger" dot>不可用</Badge>
        <Badge tone="neutral" :mono="false">非等宽</Badge>
      </div>
      <div class="uikit__row">
        <Checkbox v-model="kitChecked">挂载知识文档（等宽数值走 ui-mono）</Checkbox>
        <Checkbox :model-value="true" mono>文档 8f2c41d0</Checkbox>
        <Checkbox :model-value="false" disabled>禁用态</Checkbox>
      </div>
      <Empty icon="box" title="空状态" description="列表为空 / 未登录 / 加载失败统一用 Empty，避免每页各写一套。" />
    </section>
  </div>
</template>

<style scoped>
.uikit {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-6);
  padding-bottom: var(--ui-space-6);
}

.uikit__head {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
  padding: var(--ui-space-5);
  background: var(--ui-bg-layer-1);
  -webkit-backdrop-filter: var(--ui-glass-blur);
  backdrop-filter: var(--ui-glass-blur);
  border: 1px solid var(--ui-border-l1);
  border-radius: var(--ui-radius-panel);
}

/* 「开发工具」标识：让人一眼看出这不是业务页 */
.uikit__badges {
  display: flex;
  gap: var(--ui-space-2);
}

/* 页顶介绍（面向开发者）：说清是什么、什么时候用、怎么用 */
.uikit__intro {
  max-width: 72ch;
  font-size: var(--ui-font-size-base);
  line-height: var(--ui-line-height-base);
  color: var(--ui-text-label-secondary);
}

.uikit__sub {
  margin-top: var(--ui-space-2);
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-label-tertiary);
}

.uikit__sub strong {
  color: var(--ui-success-label);
}

.uikit__sub strong.is-bad {
  color: var(--ui-danger-label);
}

.uikit__section {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
  padding: var(--ui-space-5);
  background: var(--ui-bg-layer-1);
  -webkit-backdrop-filter: var(--ui-glass-blur);
  backdrop-filter: var(--ui-glass-blur);
  border: 1px solid var(--ui-border-l1);
  border-radius: var(--ui-radius-panel);
}

.uikit__group-title {
  margin-bottom: var(--ui-space-2);
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-medium);
  color: var(--ui-text-caption);
}

.uikit__swatches {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--ui-space-3);
}

.uikit__swatch {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
  padding: var(--ui-space-2);
  background: var(--ui-bg-layer-2);
  border: 1px solid var(--ui-border-l1);
  border-radius: var(--ui-radius-3);
}

.uikit__chip {
  flex: none;
  width: 28px;
  height: 28px;
  border: 1px solid var(--ui-border-l3);
  border-radius: var(--ui-radius-2);
}

.uikit__swatch-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.uikit__metrics {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: var(--ui-space-2);
}

.uikit__metric {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--ui-space-1) var(--ui-space-3);
  padding: var(--ui-space-2) var(--ui-space-3);
  background: var(--ui-bg-layer-2);
  border: 1px solid var(--ui-border-l1);
  border-radius: var(--ui-radius-2);
}

.uikit__metric .uikit__name {
  flex: 1;
  min-width: 0;
}

.uikit__name {
  font-size: var(--ui-font-size-caption);
  font-family: var(--ui-font-mono);
  color: var(--ui-text-label-secondary);
  /* 令牌名是原子：不允许在词中断行，空间不足时让容器换行 / 伸缩 */
  word-break: keep-all;
  overflow-wrap: normal;
}

.uikit__value {
  font-size: var(--ui-font-size-caption);
  font-family: var(--ui-font-mono);
  color: var(--ui-text-caption);
  /* 只在空格处折行，长值整体下移到第二行 */
  word-break: normal;
  overflow-wrap: break-word;
  text-align: right;
  margin-left: auto;
}

.uikit__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ui-space-3);
}

.uikit__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--ui-space-3);
}
</style>

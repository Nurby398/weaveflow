<script setup>
/**
 * Layout 主布局：玻璃侧栏（胶囊导航项）+ 顶部栏 + 内容区
 * ------------------------------------------------------------------
 * 导航项：工作台 / 对话 / 智能体创建 / 智能体团队 / 设置 / 个人中心，共六项；
 * 「视觉验收」（/__ui）**只在开发时**追加为第七项——见下面 navItems 的注释。
 *
 * 历史（勿再改回去）：
 *   · 上一轮曾有子代理在未获授权的情况下把入口**永久**砍成五项（删掉工作台与视觉验收），
 *     用户没有提出过这项要求，因此这里恢复成七项；
 *   · 随后按用户要求把「视觉验收」收进开发者模式（用户原话：「目前的视觉验收页面还没有
 *     按照你说的隐藏到开发者模式下，这一块你要设计一下，要合理且要让开发知道它的作用，
 *     要有简单介绍」）。一开始用 import.meta.env.DEV 判定，但实测它会被 NODE_ENV 带偏：
 *     同一台机器上带 NODE_ENV=production 启动的 dev server 把 DEV 算成 false，入口凭空消失。
 *     现在改用 vite.config.js 里 define 注入的 __SHOW_DEVTOOLS__——它只看跑的是哪条命令
 *     （dev 为 true / build 为 false），本地 `npm run dev` 一定看得见，
 *     `npm run build` 的产物里一定没有，且该分支会被构建期直接消除。
 *     路由本身保留（生产环境仍可按 URL 直达，便于排查线上令牌问题）。
 *     这与「未授权砍入口」是两件事：那次是删功能，这次是按用户要求做环境限定。
 *
 * 品牌标记：与介绍页 / 登录页共用同一套「深色圆 + 内部白色旋转椭圆」结构
 *   （依据用户原话：「左侧图标我希望和介绍页的图标一致，我喜欢那个 logo 标志」——
 *    原话里点名的那一页就是 chat 对话页；引文只略去平台旧名，平台名本轮已改为「织流 · WEAVEFLOW」）。
 *   此前侧栏用的是 element-plus 的 Cpu 图标，故两处不一致。
 *
 * 视觉依据（用户原话）：「我想要毛玻璃，胶囊，半透明的视觉感受……所有页面风格统一」。
 *   - 侧栏是毛玻璃（--ui-glass-*），背景视频透过它可见；
 *   - 导航项是胶囊，选中态是半透明青胶囊 + 白字；
 *   - 内页只取视觉语言：玻璃材质、强调色、文字色、胶囊、大写标题。
 * 折叠状态持久化在 localStorage，刷新后保持。
 */
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import Icon from './ui/Icon.vue'
import ErrorBoundary from './ui/ErrorBoundary.vue'
import Navbar from './Navbar.vue'

const route = useRoute()
const plainContent = computed(() => route.meta?.plain === true)

const STORAGE_KEY = 'platform_sidebar_collapsed'

const collapsed = ref(readCollapsed())

function readCollapsed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

watch(collapsed, (value) => {
  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
  } catch {
    // 忽略不可写的存储环境
  }
})

/** 侧栏导航项：固定项 + 开发环境追加「视觉验收」，顺序与路由一致（Paperclip 参照新增运行历史/成本/评测） */
const navItems = [
  { to: '/', label: '工作台', icon: 'home' },
  { to: '/chat', label: '对话', icon: 'chat' },
  { to: '/agents', label: '智能体创建', icon: 'agents' },
  { to: '/teams', label: '智能体团队', icon: 'teams' },
  { to: '/runs', label: '运行历史', icon: 'gauge' },
  { to: '/tasks', label: '任务中心', icon: 'timer' },
  { to: '/cost', label: '成本', icon: 'coin' },
  { to: '/evals', label: '评测', icon: 'aim' },
  { to: '/knowledge', label: '知识库', icon: 'knowledge' },
  { to: '/settings', label: '设置', icon: 'settings' },
  { to: '/profile', label: '个人中心', icon: 'profile' },
  // 视觉验收（/__ui）只在开发时出现在导航里；生产构建时这一项不存在。
  // 判定用配置期注入的 __SHOW_DEVTOOLS__（见 vite.config.js）：它只看跑的是哪条命令，
  // 不受 NODE_ENV 影响，因此 `npm run dev` 必现、`npm run build` 必无。
  // 路由本身仍在（router/index.js 未动），生产环境可按 URL 直达，便于排查线上令牌问题。
  ...(__SHOW_DEVTOOLS__ ? [{ to: '/__ui', label: '视觉验收', icon: 'view' }] : []),
]

/**
 * 当前项判定：必须自己算，不能只靠 router-link 的 active 类。
 * 原因：/chat 与 /chat/:conversationId 是**兄弟路由**（不是父子嵌套），
 * 访问 /chat/xxx 时 router-link 既不加 active 也不加 exact-active，
 * 结果「对话」在会话页里完全不高亮，用户看不出自己在哪。
 * 同理适用于 /pipeline/:runId 这类带参数页面。
 */
function isCurrent(to) {
  return route.path === to || route.path.startsWith(`${to}/`)
}
</script>

<template>
  <div class="layout" :class="{ 'is-collapsed': collapsed }">
    <aside class="layout__sidebar">
      <div class="layout__brand">
        <!-- 与 About.vue / Login.vue 同一套结构：深色圆 + 内部白色旋转椭圆（用户点名要求一致）；
             字标用同一套 .ui-wordmark（见 base.css），三处计算样式必须逐项相同 -->
        <span class="layout__logo" aria-hidden="true"><span class="layout__logo-ellipse" /></span>
        <span v-if="!collapsed" class="layout__brand-text ui-wordmark">织流 · WEAVEFLOW</span>
      </div>

      <nav class="layout__nav" aria-label="主导航">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          class="layout__nav-item"
          :class="{ 'is-collapsed': collapsed, 'is-current': isCurrent(item.to) }"
          :to="item.to"
          :title="collapsed ? item.label : undefined"
        >
          <Icon class="layout__nav-icon" :name="item.icon" :size="18" />
          <span v-if="!collapsed" class="layout__nav-label">{{ item.label }}</span>
        </RouterLink>
      </nav>

      <button
        class="layout__collapse"
        type="button"
        :aria-expanded="collapsed ? 'false' : 'true'"
        :aria-label="collapsed ? '展开侧边导航' : '折叠侧边导航'"
        @click="collapsed = !collapsed"
      >
        <Icon :name="collapsed ? 'expand' : 'fold'" :size="16" />
        <span v-if="!collapsed">折叠</span>
      </button>
    </aside>

    <div class="layout__main">
      <Navbar :collapsed="collapsed" @toggle-sidebar="collapsed = !collapsed" />
      <main class="layout__content ui-glass-veil" :class="{ 'is-plain': plainContent }">
        <!-- 内层兜底：页面崩了也只换内容区，侧栏/导航仍可用（外层 App 还有一层） -->
        <ErrorBoundary title="这个页面加载失败了">
          <RouterView />
        </ErrorBoundary>
      </main>
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  min-height: 100vh;
  /* 不铺底色：底色由 body 提供（--ui-bg-base），侧栏与内容区共用同一块浅底 */
  background: transparent;
}

.layout__sidebar {
  display: flex;
  flex-direction: column;
  width: var(--ui-layout-sidebar-width);
  flex: none;
  /* 深色毛玻璃侧栏：视频透过它可见（三层配方见 base.css 的 .ui-glass 说明） */
  background: var(--ui-glass-bg);
  box-shadow: var(--ui-glass-outer);
  -webkit-backdrop-filter: var(--ui-glass-blur);
  backdrop-filter: var(--ui-glass-blur);
  /* 长页面滚动时导航保持可见 */
  position: sticky;
  top: 0;
  height: 100vh;
  /* flex 默认 stretch 会把侧栏拉满整页，sticky 将失效 */
  align-self: flex-start;
  border: none;
  border-right: 1px solid var(--ui-glass-stroke);
  transition: width var(--ui-duration-base) var(--ui-ease-out);
}

.layout.is-collapsed .layout__sidebar {
  width: var(--ui-layout-sidebar-collapsed-width);
}

.layout__brand {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
  height: var(--ui-layout-navbar-height);
  padding: 0 var(--ui-space-4);
  overflow: hidden;
}

/* 品牌标记：与 About.vue 的 .about__logo / .hero__logo 同规格（38px 圆 + 20×8 椭圆），
   折叠态（侧栏收到 72px）时居中放同一个圆，不再另写尺寸。 */
.layout__logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 38px;
  height: 38px;
  border-radius: var(--ui-radius-circle);
  background: var(--ui-hero-logo-fill);
}

.layout__logo-ellipse {
  width: 20px;
  height: 8px;
  border-radius: var(--ui-radius-circle);
  background: var(--ui-text-inverted);
  transform: rotate(-25deg);
}

/* 折叠态：只剩图标，把品牌区居中，避免 16px 左内边距造成的偏心 */
.layout.is-collapsed .layout__brand {
  justify-content: center;
  padding: 0;
}

/* 字标：字体/字号/字距/大小写全部来自 base.css 的 .ui-wordmark（与登录页、介绍页共用），
   这里只补侧栏自己的文字色。宽度超出时由 .layout__brand 的 overflow:hidden 裁掉。 */
.layout__brand-text {
  color: var(--ui-text-label-primary);
}

.layout__nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
  padding: var(--ui-space-3) var(--ui-space-3);
  overflow-y: auto;
}

/* 导航项：胶囊（--ui-radius-pill） */
.layout__nav-item {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
  height: 40px;
  padding: 0 var(--ui-space-4);
  border-radius: var(--ui-radius-pill);
  color: var(--ui-text-label-secondary);
  font-size: var(--ui-font-size-base);
  white-space: nowrap;
  transition:
    background var(--ui-duration-fast) var(--ui-ease-standard),
    color var(--ui-duration-fast) var(--ui-ease-standard),
    box-shadow var(--ui-duration-fast) var(--ui-ease-standard),
    transform var(--ui-duration-fast) var(--ui-ease-standard);
}

.layout__nav-item.is-collapsed {
  justify-content: center;
  padding: 0;
}

/* hover 反馈加强一档：换更强的青底 + 抬起 1px + 一道交互态阴影
   （底板玻璃条本身仍无阴影，只有被 hover 的这一项有——原则见 base.css 的玻璃工具类注释） */
.layout__nav-item:hover {
  background: var(--ui-interactive-hover-strong);
  color: var(--ui-text-label-primary);
  box-shadow: var(--ui-shadow-hover);
  transform: var(--ui-lift-hover-sm);
}

/* 选中态：半透明青胶囊 + 白字（用户要求：胶囊 + 半透明） */
.layout__nav-item.is-current {
  background: var(--ui-interactive-active);
  color: var(--ui-text-primary);
  box-shadow:
    0 0 0 1px var(--ui-glass-stroke) inset,
    var(--ui-glass-shadow-1);
}

.layout__nav-item.is-current:hover {
  background: var(--ui-btn-primary-hover);
  color: var(--ui-text-on-accent);
}

.layout__nav-icon {
  flex: none;
  width: 18px;
  height: 18px;
}

.layout__collapse {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--ui-space-2);
  height: 36px;
  margin: var(--ui-space-3);
  padding: 0 var(--ui-space-3);
  border: 1px solid var(--ui-glass-stroke);
  border-radius: var(--ui-radius-pill);
  background: var(--ui-glass-bg-soft);
  color: var(--ui-text-caption);
  font-family: var(--ui-font-sans);
  font-size: var(--ui-font-size-sm);
  cursor: pointer;
  white-space: nowrap;
  transition:
    background var(--ui-duration-fast) var(--ui-ease-standard),
    color var(--ui-duration-fast) var(--ui-ease-standard);
}

.layout__collapse:hover {
  background: var(--ui-interactive-hover-strong);
  color: var(--ui-text-label-primary);
  box-shadow: var(--ui-shadow-hover);
}

.layout__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

/* 内容区：整片铺一层「向下渐隐的玻璃」（.ui-glass-veil → --ui-content-veil），
   越往下越收，把底部裸露的视频压下去。
   依据（用户原话）：「收一点吧」；四页共用同一个令牌，不各页各写一份。 */
.layout__content {
  flex: 1;
  padding: var(--ui-space-5);
}

/* 全屏页面（对话页）：不留内边距，页面自己铺满 */
.layout__content.is-plain {
  padding: 0;
  min-height: 0;
}
</style>

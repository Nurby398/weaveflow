import { createRouter, createWebHistory } from 'vue-router'
import Layout from '@/components/Layout.vue'
import { getToken, getStoredUser } from '@/utils/auth'

/**
 * 路由配置说明
 * ------------------------------------------------------------------
 * 1. 业务页面统一挂载在 Layout 下（Layout 提供可折叠侧栏 + 顶部栏 + 内容区）；
 *    登录 / 403 / 404 为独立页面，不使用 Layout。
 * 2. meta.requiresAuth = true  → 受保护路由，访问前校验登录态
 * 3. meta.guestOnly   = true  → 仅未登录用户可访问（已登录时跳回首页）
 * 4. meta.roles       = []    → 预留角色权限控制，无权限时跳转 /403
 * 5. meta.title               → 浏览器标签标题
 *
 * ★ 保护策略（2026-10-14 变更）：**默认全部需要登录**，只有显式声明
 *   `meta.public = true` 的页面（/login、/about、/403、/404，以及开发环境下的 /__ui）
 *   才免登录可访问。要求打在 Layout 父路由上，因此**新增子页面默认受保护**，不会漏。
 *   未登录访问受保护页 → 跳 /login?redirect=<原地址>，登录/注册成功后自动回跳。
 * ------------------------------------------------------------------
 */

const routes = [
  /* ------------------------- 主布局下的页面 ------------------------- */
  {
    path: '/',
    component: Layout,
    // 一处声明覆盖全部子页面：以后新增页面默认受保护，不会漏
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Home',
        component: () => import('@/views/Home.vue'),
        meta: { title: '工作台' },
      },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('@/views/Profile.vue'),
        meta: { title: '个人中心', requiresAuth: true },
      },
      {
        // 对话：/chat 为会话索引，/chat/:conversationId 为具体会话（同一组件）
        // meta.plain：内容区去掉内边距，让对话界面铺满整屏（见 Layout.vue 注释）
        path: 'chat',
        name: 'ChatIndex',
        component: () => import('@/views/Chat.vue'),
        meta: { title: '对话', plain: true },
      },
      {
        path: 'chat/:conversationId',
        name: 'Chat',
        component: () => import('@/views/Chat.vue'),
        meta: { title: '对话', plain: true },
      },
      {
        path: 'agents',
        name: 'Agents',
        component: () => import('@/views/Agents.vue'),
        meta: { title: '智能体创建' },
      },
      {
        path: 'teams',
        name: 'Teams',
        component: () => import('@/views/Teams.vue'),
        meta: { title: '智能体团队' },
      },
      {
        // 流水线运行页：阶段进度 + 阶段产出 + 契约校验结果
        path: 'pipeline/:runId',
        name: 'Pipeline',
        component: () => import('@/views/Pipeline.vue'),
        meta: { title: '流水线' },
      },
      {
        // 运行历史（Paperclip 参照）：历次运行列表，接口 FE-B11 未就绪前先占位
        path: 'runs',
        name: 'Runs',
        component: () => import('@/views/Runs.vue'),
        meta: { title: '运行历史' },
      },
      {
        // 成本（Paperclip 参照）：token/费用聚合与预算，占位
        path: 'cost',
        name: 'Cost',
        component: () => import('@/views/Cost.vue'),
        meta: { title: '成本' },
      },
      {
        // 评测（Paperclip 参照）：测试用例 → 评分，占位
        path: 'evals',
        name: 'Evals',
        component: () => import('@/views/Evals.vue'),
        meta: { title: '评测' },
      },
      {
        // 知识库管理页（设计评审 P0-4）：后端接口早已就绪，此前缺前端界面
        path: 'knowledge',
        name: 'Knowledge',
        component: () => import('@/views/Knowledge.vue'),
        meta: { title: '知识库' },
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('@/views/Settings.vue'),
        meta: { title: '模型凭据' },
      },
      {
        // 视觉验收页：一页展示全部令牌与全部基础组件
        path: '__ui',
        name: 'UiKit',
        component: () => import('@/views/UiKit.vue'),
        // 视觉验收页是开发工具：仅开发环境免登录（生产构建里 __SHOW_DEVTOOLS__ 为 false）
        meta: { title: '视觉验收', public: __SHOW_DEVTOOLS__ },
      },
    ],
  },

  /* ------------------------ 独立页面（无布局） ------------------------ */
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录', public: true, guestOnly: true },
  },
  {
    // 介绍页：独立页面（不挂主布局），从登录页 Hero 的 ABOUT 链接可达
    path: '/about',
    name: 'About',
    component: () => import('@/views/About.vue'),
    meta: { title: '关于平台', public: true },
  },
  {
    path: '/403',
    name: 'Forbidden',
    component: () => import('@/views/Forbidden.vue'),
    meta: { title: '无访问权限', public: true },
  },
  {
    path: '/404',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue'),
    meta: { title: '页面不存在', public: true },
  },

  /* --------------------------- 兜底路由 --------------------------- */
  {
    path: '/:pathMatch(.*)*',
    redirect: '/404',
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  // 切换路由时回到页面顶部
  scrollBehavior: () => ({ top: 0 }),
})

/**
 * 全局前置守卫
 * 1. 已登录用户访问登录页 → 跳回首页
 * 2. 受保护路由且未登录 → 跳 /login?redirect=<原地址>，登录/注册成功后自动回跳
 * 3. 权限不足 → 跳转 /403
 *
 * 白名单只认显式声明的 meta.public；其余一律需要登录。
 */
router.beforeEach((to, from, next) => {
  const token = getToken()
  const isPublic = to.meta.public === true

  /* ---- 1. 已登录的人不该再看登录页 ---- */
  if (to.matched.some((record) => record.meta.guestOnly) && token) {
    return next({ path: '/', replace: true })
  }

  /* ---- 2. 受保护路由的登录态校验 ---- */
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth)

  if (!isPublic && requiresAuth && !token) {
    // 目标是首页时不带 redirect：首页本就是默认落点，带上只会让地址栏变脏
    const query = to.fullPath && to.fullPath !== '/' ? { redirect: to.fullPath } : {}
    return next({ path: '/login', query, replace: true })
  }

  /* ---- 3. 角色权限校验（预留，当前未启用）---- */
  if (to.meta.roles?.length) {
    const role = getStoredUser()?.role
    if (!role || !to.meta.roles.includes(role)) {
      return next('/403')
    }
  }

  /* ---- 4. 放行 ---- */
  next()
})

/** 全局后置钩子：设置浏览器标签标题 */
router.afterEach((to) => {
  // 平台名：织流 · WEAVEFLOW（中英文同处出现一次，便于识别）
  const baseTitle = '织流 WEAVEFLOW'
  document.title = to.meta.title ? `${to.meta.title} - ${baseTitle}` : baseTitle
})

export default router

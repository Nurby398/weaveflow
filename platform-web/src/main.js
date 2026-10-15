import { createApp } from 'vue'
import { createPinia } from 'pinia'
/**
 * Element Plus 按需引入
 * ------------------------------------------------------------------
 * 织流的自建组件（src/components/ui/**）内部改为基于 EP 实现，页面调用点不变。
 * 这里只注册被真正用到的 EP 组件，并按 EP 官方的「组件 + 对应样式」入口逐个引样式，
 * 不引整包 dist/index.css——未用到的组件不该进产物。
 *
 * 样式加载顺序有讲究：
 *   1. element-plus 的 base（--el-* 变量定义）与各组件样式；
 *   2. 织流自己的 tokens.css / base.css / markdown.css；
 *   3. element-overrides.css（把 --el-* 接到 --ui-*）必须最后，
 *      同特异度的规则靠顺序决胜。
 * ------------------------------------------------------------------
 */
import {
  ElAvatar,
  ElButton,
  ElCheckbox,
  ElDialog,
  ElDrawer,
  ElEmpty,
  ElIcon,
  ElInput,
  ElOption,
  ElSelect,
  ElTabPane,
  ElTabs,
  ElTag,
  ElTooltip,
} from 'element-plus'
import 'element-plus/es/components/base/style/css'
import 'element-plus/es/components/avatar/style/css'
import 'element-plus/es/components/button/style/css'
import 'element-plus/es/components/checkbox/style/css'
import 'element-plus/es/components/dialog/style/css'
import 'element-plus/es/components/drawer/style/css'
import 'element-plus/es/components/empty/style/css'
import 'element-plus/es/components/icon/style/css'
import 'element-plus/es/components/input/style/css'
import 'element-plus/es/components/option/style/css'
import 'element-plus/es/components/select/style/css'
import 'element-plus/es/components/tab-pane/style/css'
import 'element-plus/es/components/tabs/style/css'
import 'element-plus/es/components/tag/style/css'
import 'element-plus/es/components/tooltip/style/css'
import App from './App.vue'
import router from './router'
import { setUnauthorizedHandler } from './api/request'
import { restoreTheme } from './composables/useTheme'
import { installGlobalErrorHandlers } from './lib/telemetry'
import { safeRedirect } from './utils/redirect'
import { useUserStore } from './store/user'
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/markdown.css'
import './styles/element-overrides.css'

// 应用启动时恢复上次选择的主题（默认暗色）
restoreTheme()

const app = createApp(App)
const pinia = createPinia()

// 全局错误兜底（W2-1）：errorHandler 抓事件/异步异常；渲染异常由 ErrorBoundary 组件就地兜住
installGlobalErrorHandlers(app)

app.use(pinia)
app.use(router)

// Element Plus 组件按需注册（只注册用到的）
for (const component of [
  ElAvatar,
  ElButton,
  ElCheckbox,
  ElDialog,
  ElDrawer,
  ElEmpty,
  ElIcon,
  ElInput,
  ElOption,
  ElSelect,
  ElTabPane,
  ElTabs,
  ElTag,
  ElTooltip,
]) {
  app.use(component)
}

/**
 * 401 统一处理（token 已过期且静默续期也失败）：
 * 清登录态 → 跳登录页，带上当前地址供回跳，并加 ?expired=1 让登录页给出提示。
 * 与路由守卫走同一个落点，避免"未登录跳页 / 已过期弹窗"两套体验并存。
 */
setUnauthorizedHandler(() => {
  useUserStore(pinia).reset()

  const current = router.currentRoute.value
  // 已在登录页就不再跳转（否则会把 redirect 覆盖成登录页自身）
  if (current?.name === 'Login') return

  const target = safeRedirect(current?.fullPath, '/')
  router.replace({
    path: '/login',
    query: { ...(target !== '/' ? { redirect: target } : {}), expired: '1' },
  })
})

app.mount('#app')

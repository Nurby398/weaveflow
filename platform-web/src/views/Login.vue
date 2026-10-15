<script setup>
/**
 * 登录 / 注册页（guestOnly）：真实调用后端 authApi，不含任何 mock。
 * ------------------------------------------------------------------
 * 版式：整页是 Hero（六行阶梯大写标题 + 胶囊 CTA），
 * 登录表单放在 Hero 下方的同一页内：Hero 的 CTA（GET STARTED）滚到那块表单并聚焦邮箱，
 * 而 CONTACT US（文案 2026-10-14 起改为「意见反馈」）已改为打开「意见反馈」弹窗
 * （后端接口随 Java 版一起做，见 FeedbackModal.vue）。
 *
 * 背景视频：用户原话「背景就用视频」——已升为**全局背景**（components/AppBackground.vue），
 * 本页不再自持视频常量，也不再挂第二个 <video>；本页保留自己的排版。
 *
 * 后端 /auth/login 与 /auth/register 的账号字段是 email（不是 username），
 * 因此表单直接以邮箱为账号；注册成功后后端同样返回令牌对，直接进入登录态。
 * 登录逻辑本次未改动，只换了外层版式与材质。
 */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FeedbackModal from '@/components/FeedbackModal.vue'
import AccentButton from '@/components/ui/AccentButton.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import ThemeToggle from '@/components/ui/ThemeToggle.vue'
import { consumeRedirect } from '@/store/loginPopup'
import { useUserStore } from '@/store/user'
import { safeRedirect } from '@/utils/redirect'

/**
 * Hero 六行阶梯标题：结构（六行、后三行缩进、最后一行强调色）照规格，
 * 文案按用户要求换成本平台语境（原版 SCALING/THE/PLATFORM... 是 Targo 的）。
 */
const heroLines = [
  { text: 'ORCHESTRATING' },
  { text: 'MULTI-AGENT' },
  { text: 'WORKFLOWS' },
  { text: 'FOR', indent: true },
  { text: 'YOUR', indent: true },
  { text: 'THESIS', indent: true, accent: true },
]

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

/**
 * 登录/注册成功后的落点优先级：
 *   1. URL 的 ?redirect=（未登录访问受保护页时由路由守卫写入；已做站内校验）
 *      —— **优先级最高、不可动**：用户是被某个受保护页踢来登录的，登录后必须回那一页。
 *   2. 登录弹窗残留的 redirect（useAuthGuard 在页面内触发登录时使用）
 *   3. /chat —— 默认落点：对话页（Chat.vue 会再自动打开与「织流」的会话）。
 *      这里只到 /chat，不直接拼会话 id：那需要先拉会话列表，是对话页自己的事。
 */
function resolveAfterAuth() {
  return safeRedirect(route.query.redirect, '') || consumeRedirect() || '/chat'
}

const mode = ref('login')
const email = ref('')
const nickname = ref('')
const password = ref('')
/** 401 跳过来时（?expired=1）预置提示，说明为何被送回登录页 */
const errorMessage = ref(route.query.expired ? '登录已过期，请重新登录' : '')
const menuOpen = ref(false)
/** 表单区，供 Hero CTA 滚动定位 */
const formSection = ref(null)

const isRegister = computed(() => mode.value === 'register')

function switchMode(next) {
  mode.value = next
  errorMessage.value = ''
}

/** 「Contact us」→ 意见反馈弹窗（后端接口随 Java 版一起做，见 FeedbackModal.vue 注释） */
const feedbackOpen = ref(false)

function openFeedback() {
  menuOpen.value = false
  feedbackOpen.value = true
}

/**
 * 品牌 logo 与 HOME 的落点：回到本页顶部。
 * 为什么不指向工作台 `/`：登录页是"未登录专属页"（guestOnly），未登录访问 `/`
 * 会被路由守卫拦回本页，等于点了没反应（死链）。
 */
function scrollToTop() {
  menuOpen.value = false
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

/** Hero CTA：滚到登录表单并聚焦邮箱输入框 */
function goToForm() {
  menuOpen.value = false
  const section = formSection.value
  if (!section) return
  section.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const field = section.querySelector('input')
  if (field) field.focus({ preventScroll: true })
}

async function handleSubmit() {
  errorMessage.value = ''
  try {
    if (isRegister.value) {
      await userStore.register({
        email: email.value.trim(),
        password: password.value,
        ...(nickname.value.trim() ? { nickname: nickname.value.trim() } : {}),
      })
    } else {
      await userStore.login({ email: email.value.trim(), password: password.value })
    }
    router.push(resolveAfterAuth())
  } catch (error) {
    errorMessage.value = error?.message || (isRegister.value ? '注册失败，请稍后重试' : '登录失败，请稍后重试')
  }
}
</script>

<template>
  <div class="login-page">
    <!-- ============================== Hero ============================== -->
    <section class="hero">
      <!-- 仅桌面：左侧 70% 深色渐隐遮罩，让标题压在视频上仍然可读 -->
      <div class="hero__mask" aria-hidden="true" />

      <nav class="hero__nav">
        <!-- 品牌与 HOME 都回到本页顶部：登录页是"未登录专属页"（guestOnly），
             指向受保护的工作台 `/` 只会被守卫拦回本页，等于点不动（死链）。 -->
        <a class="hero__brand" href="#" @click.prevent="scrollToTop">
          <span class="hero__logo" aria-hidden="true"><span class="hero__logo-ellipse" /></span>
          <span class="hero__brand-text ui-wordmark">织流 · WEAVEFLOW</span>
        </a>

        <ul class="hero__links">
          <li><a class="hero__link" href="#" @click.prevent="scrollToTop">HOME</a></li>
          <li><RouterLink class="hero__link" to="/about">ABOUT</RouterLink></li>
        </ul>

        <button class="hero__contact" type="button" @click="openFeedback">
          <svg class="hero__contact-icon" viewBox="0 0 17 13" fill="none" aria-hidden="true">
            <rect x="0.7" y="0.7" width="15.6" height="11.6" stroke="currentColor" stroke-width="1.4" />
            <path d="M1 1.5 8.5 7.4 16 1.5" stroke="currentColor" stroke-width="1.4" />
          </svg>
          <span>意见反馈</span>
        </button>

        <button
          class="hero__burger"
          type="button"
          :aria-expanded="menuOpen ? 'true' : 'false'"
          aria-label="打开导航菜单"
          @click="menuOpen = !menuOpen"
        >
          <span class="hero__burger-bar" />
          <span class="hero__burger-bar" />
          <span class="hero__burger-bar" />
        </button>

        <!-- 本页没有 Navbar，主题切换按钮单独放顶栏右上角（任务书标定） -->
        <ThemeToggle />
      </nav>

      <!-- 移动端展开菜单（竖排）。「意见反馈」入口只保留这一处（带信封图标的那一个）：
           桌面端由 .hero__contact 承接，移动端它被隐藏，所以这里补同一个信封图标，
           两个断点下都只剩一个带信封的入口。
           文案 2026-10-14 按用户要求由 CONTACT US / Contact us 改为「意见反馈」。
           依据（用户原话，当时文案仍是英文）：「有两个 contact us 保留带信封图标的，不然重复了」。 -->
      <div v-if="menuOpen" class="hero__menu">
        <a href="#" @click.prevent="scrollToTop">HOME</a>
        <RouterLink to="/about" @click="menuOpen = false">ABOUT</RouterLink>
        <a class="hero__menu-contact" href="#" @click.prevent="openFeedback">
          <svg class="hero__contact-icon" viewBox="0 0 17 13" fill="none" aria-hidden="true">
            <rect x="0.7" y="0.7" width="15.6" height="11.6" stroke="currentColor" stroke-width="1.4" />
            <path d="M1 1.5 8.5 7.4 16 1.5" stroke="currentColor" stroke-width="1.4" />
          </svg>
          <span>意见反馈</span>
        </a>
      </div>

      <div class="hero__content">
        <h1 class="hero__title ui-heading">
          <span
            v-for="line in heroLines"
            :key="line.text"
            class="hero__line"
            :class="{ 'hero__line--indent': line.indent, 'hero__line--accent': line.accent }"
            >{{ line.text }}</span
          >
        </h1>

        <div class="hero__cta-row">
          <AccentButton @click="goToForm">GET STARTED</AccentButton>
        </div>
      </div>
    </section>

    <!-- ======================= 登录 / 注册表单 ======================= -->
    <section id="login" ref="formSection" class="login">
      <div class="login__card">
        <h2 class="login__title ui-heading">{{ isRegister ? '注册' : '登录' }}</h2>
        <p class="login__hint">
          调用真实后端 /api/auth/{{ isRegister ? 'register' : 'login' }}，账号为邮箱，密码至少 8 位。
        </p>

        <form class="login__form" @submit.prevent="handleSubmit">
          <label class="login__field">
            <span class="login__label">邮箱</span>
            <Input v-model="email" placeholder="you@example.com" aria-label="邮箱" />
          </label>
          <label v-if="isRegister" class="login__field">
            <span class="login__label">昵称（可选）</span>
            <Input v-model="nickname" placeholder="展示名称" aria-label="昵称" />
          </label>
          <label class="login__field">
            <span class="login__label">密码</span>
            <Input v-model="password" type="password" placeholder="请输入密码" aria-label="密码" />
          </label>

          <p v-if="errorMessage" class="login__error" role="alert">{{ errorMessage }}</p>

          <Button type="primary" native-type="submit" block :loading="userStore.loading">
            {{ isRegister ? '注册并进入' : '登录' }}
          </Button>
        </form>

        <button class="login__switch" type="button" @click="switchMode(isRegister ? 'login' : 'register')">
          {{ isRegister ? '已有账号？去登录' : '还没有账号？去注册' }}
        </button>
      </div>
    </section>

    <!-- 意见反馈：由 Hero 的 Contact us 打开（桌面按钮 / 移动端菜单项两个入口） -->
    <FeedbackModal v-model="feedbackOpen" />
  </div>
</template>

<style scoped>
/* 背景视频已升为全站全局层（components/AppBackground.vue），本页不铺底 */
.hero {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: var(--ui-hero-min-height);
  overflow: hidden;
  background: var(--ui-hero-bg);
}

.hero__mask {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 70%;
  background: var(--ui-hero-mask);
  pointer-events: none;
}

.hero__nav {
  position: relative;
  z-index: 3;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ui-hero-nav-gap);
  padding: var(--ui-hero-nav-padding);
}

.hero__brand {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-3);
  color: var(--ui-hero-ink);
}

.hero__brand:hover {
  color: var(--ui-hero-ink);
}

.hero__logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 38px;
  height: 38px;
  border-radius: var(--ui-radius-circle);
  background: var(--ui-hero-logo-fill);
}

.hero__logo-ellipse {
  width: 20px;
  height: 8px;
  border-radius: var(--ui-radius-circle);
  background: var(--ui-text-inverted);
  transform: rotate(-25deg);
}

/* 字标：字体/字号/字距/大小写来自 base.css 的 .ui-wordmark（与侧栏、介绍页共用），
   文字色由 .hero__brand 的 --ui-hero-ink 继承，这里不再重复声明。 */

.hero__links {
  display: flex;
  align-items: center;
  gap: var(--ui-hero-link-gap);
}

.hero__link {
  font-family: var(--ui-font-display);
  font-size: var(--ui-hero-font-link);
  font-weight: var(--ui-font-weight-bold);
  letter-spacing: 0.06em;
  color: var(--ui-text-secondary);
  white-space: nowrap;
}

.hero__link:hover {
  color: var(--ui-text-link-hover);
}

/* 桌面右上按钮：透明底、无边框、白字、切角 */
.hero__contact {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2);
  margin-left: auto;
  padding: 14px 26px;
  border: none;
  background: transparent;
  color: var(--ui-hero-on-video);
  font-family: var(--ui-font-display);
  font-size: var(--ui-hero-font-link);
  font-weight: var(--ui-font-weight-bold);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background var(--ui-duration-fast) var(--ui-ease-standard);
}

.hero__contact:hover {
  background: var(--ui-hero-contact-hover);
}

.hero__contact-icon {
  flex: none;
  width: 17px;
  height: 13px;
}

/* 移动端汉堡（桌面隐藏） */
.hero__burger {
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  margin-left: auto;
  padding: var(--ui-space-2);
  border: none;
  background: transparent;
  cursor: pointer;
}

.hero__burger-bar {
  display: block;
  width: 22px;
  height: 2px;
  background: var(--ui-hero-on-video);
}

.hero__menu {
  position: relative;
  z-index: 3;
  align-self: flex-end;
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin: 0 var(--ui-space-4);
  padding: var(--ui-space-4) var(--ui-space-5);
  background: var(--ui-bg-overlay);
  -webkit-backdrop-filter: var(--ui-glass-blur);
  backdrop-filter: var(--ui-glass-blur);
  border: 1px solid var(--ui-border-l2);
  box-shadow: var(--ui-shadow-2);
}

.hero__menu a {
  font-family: var(--ui-font-display);
  font-size: var(--ui-font-size-lg);
  font-weight: var(--ui-font-weight-bold);
  color: var(--ui-hero-menu-ink);
}

/* 移动端唯一的那条 CONTACT US：文字与信封图标同一行对齐 */
.hero__menu-contact {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2);
}

.hero__content {
  position: relative;
  z-index: 2;
  display: flex;
  flex: 1;
  flex-direction: column;
}

.hero__title {
  padding: var(--ui-hero-title-padding);
  font-size: var(--ui-hero-font-title);
  color: var(--ui-text-primary);
}

.hero__line {
  display: block;
}

.hero__line--indent {
  padding-left: var(--ui-hero-indent);
}

.hero__line--accent {
  color: var(--ui-primary);
}

/* CTA 左边缘与后三行缩进对齐，底部留出规格给定的间距 */
.hero__cta-row {
  margin-top: auto;
  padding: 0 0 var(--ui-hero-cta-bottom) var(--ui-hero-cta-left);
}

/* ============================ 登录 / 注册 ============================ */
.login {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--ui-space-6) var(--ui-space-5);
  background: var(--ui-bg-base);
}

.login__card {
  width: var(--ui-login-card-width);
  max-width: 100%;
  padding: var(--ui-space-6);
  background: var(--ui-bg-layer-1);
  -webkit-backdrop-filter: var(--ui-glass-blur);
  backdrop-filter: var(--ui-glass-blur);
  border: 1px solid var(--ui-glass-stroke);
  border-radius: var(--ui-radius-panel);
  box-shadow: var(--ui-glass-shadow-2), var(--ui-glass-highlight), var(--ui-glass-outer);
}

.login__title {
  font-size: var(--ui-font-size-title);
  margin-bottom: var(--ui-space-2);
}

.login__hint {
  margin-bottom: var(--ui-space-5);
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-caption);
}

.login__form {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}

.login__field {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
}

.login__label {
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-label-secondary);
}

.login__error {
  font-size: var(--ui-font-size-sm);
  color: var(--ui-danger-label);
}

.login__switch {
  margin-top: var(--ui-space-4);
  padding: 0;
  background: transparent;
  border: none;
  font-size: var(--ui-font-size-sm);
  color: var(--ui-primary-text);
  cursor: pointer;
}

/* ============================== 移动端 ============================== */
@media (max-width: 700px) {
  /* 移动端不加遮罩 */
  .hero__mask {
    display: none;
  }

  .hero__links,
  .hero__contact {
    display: none;
  }

  .hero__burger {
    display: inline-flex;
  }

  .hero__title {
    margin-top: var(--ui-hero-title-margin-top-mobile);
    padding: var(--ui-hero-title-padding-mobile);
    font-size: var(--ui-hero-font-title-mobile);
  }

  .hero__cta-row {
    padding-left: var(--ui-hero-cta-left-mobile);
  }
}
/* ==================== 桌面：把登录卡抬进首屏 ====================
 * Hero 固定 100svh，而 6 行大标题在 800px 高的屏幕上就占掉约 430px；
 * 表单若仍排在其下方，必然落到第二屏——「进登录页还要先滚一下」是真实的可用性问题。
 * 所以桌面把表单绝对定位到右侧并垂直居中，与标题并排；
 * 标题同时限宽，避免钻到表单底下。移动端不这样做（≤700px 走下面的自然堆叠）。
 */
@media (min-width: 701px) {
  .login-page {
    position: relative;
  }

  .login {
    position: absolute;
    top: 50%;
    /* 右侧留白加大＝卡片整体左移（用户原话：「目前登录页面的登录表单往左再移一下，
       目前视觉上有点靠右」）。具体数值走 --ui-login-card-right，与下面的限宽同源。 */
    right: var(--ui-login-card-right);
    z-index: 3;
    transform: translateY(-50%);
    padding: 0;
    background: transparent;
  }

  /* 限宽与卡片位置同源：预留 = 卡片宽 + 右侧留白 + 一个间距，
     所以大标题的右边界永远比卡片左边界少 --ui-space-5，任何宽度都不相交。 */
  .hero__content {
    max-width: calc(100% - var(--ui-login-reserve));
  }
}
</style>

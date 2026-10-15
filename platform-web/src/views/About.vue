<script setup>
/**
 * 介绍页（/about）
 * ------------------------------------------------------------------
 * 版式照用户给出的规格：两栏（flex + wrap + align center + gap 40px），
 * 左栏是两行阶梯大写标题 + 段落 + LEARN MORE 按钮；右栏保留原媒体位。
 *
 * 文案说明：规格给的英文段落是参考站点原文（讲测试基础设施），与本平台无关，
 * 因此**版式与字号照搬、文案换成本平台语境的中文**；标题两行保留
 * ABOUT / PLATFORM（阶梯缩进与强调色照规格，末词按平台语境从 BUSINESS 改为 PLATFORM）。
 *
 * 背景视频：用户原话「背景就用视频」——已升为**全局背景**（components/AppBackground.vue），
 * 全站只此一个 <video> 实例，因此本页不再播放自己的那支，右栏媒体位改为
 * **无文本的装饰玻璃面板 + 青色光晕**（保留原两栏节奏，不编造文案）。
 */
import { useRouter } from 'vue-router'
import AccentButton from '@/components/ui/AccentButton.vue'
import ThemeToggle from '@/components/ui/ThemeToggle.vue'

const router = useRouter()

/** 构建元信息：由 vite.config.js 的 define 注入（版本 / 提交 / 构建时间）。 */
const buildMeta = {
  version: __APP_VERSION__,
  sha: __GIT_SHA__,
  time: __BUILD_TIME__,
}
</script>

<template>
  <div class="about">
    <!-- 极简页头：介绍页是独立页面（不挂主布局），没有导航会成为死路，所以留品牌 + 返回入口 -->
    <header class="about__top">
      <RouterLink class="about__brand" to="/login">
        <span class="about__logo" aria-hidden="true"><span class="about__logo-ellipse" /></span>
        <span class="about__brand-text ui-wordmark">织流 · WEAVEFLOW</span>
      </RouterLink>
      <div class="about__actions">
        <!-- 本页没有 Navbar，主题切换按钮单独放顶栏右上角（任务书标定） -->
        <ThemeToggle />
        <RouterLink class="about__back" to="/login">返回登录</RouterLink>
      </div>
    </header>

    <section class="about__section">
      <div class="about__col about__col--text">
        <h2 class="about__title ui-heading">
          <span class="about__title-line">ABOUT</span>
          <span class="about__title-line about__title-line--accent">PLATFORM</span>
        </h2>

        <p class="about__body">
          本平台把软件工程毕设的全流程拆成一条可编排的智能体流水线：选题、需求、设计、实现、测试、论文，每个阶段都有专职智能体接力，阶段产出按契约逐段校验。你只需要给出课题，协作、留痕与交付由平台推进。
        </p>

        <div class="about__cta">
          <AccentButton @click="router.push('/')">LEARN MORE</AccentButton>
        </div>

        <p class="about__meta ui-mono">版本 {{ buildMeta.version }} · {{ buildMeta.sha }} · {{ buildMeta.time }}</p>
      </div>

      <div class="about__col about__col--media" aria-hidden="true">
        <div class="about__media ui-glass">
          <div class="about__glow" />
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.about {
  min-height: 100%;
  background: var(--ui-about-bg);
}
.about__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-4);
  padding: var(--ui-space-5) clamp(20px, 4vw, 48px);
}

.about__brand {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-3);
  color: var(--ui-hero-ink);
}

.about__brand:hover {
  color: var(--ui-hero-ink);
}

.about__logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 38px;
  height: 38px;
  border-radius: var(--ui-radius-circle);
  background: var(--ui-hero-logo-fill);
}

.about__logo-ellipse {
  width: 20px;
  height: 8px;
  border-radius: var(--ui-radius-circle);
  background: var(--ui-text-inverted);
  transform: rotate(-25deg);
}

/* 字标：字体/字号/字距/大小写来自 base.css 的 .ui-wordmark（与侧栏、登录页共用），
   文字色由 .about__brand 的 --ui-hero-ink 继承，这里不再重复声明。 */

.about__back {
  font-size: var(--ui-font-size-sm);
  color: var(--ui-text-secondary);
  white-space: nowrap;
}

.about__actions {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
}

/* 右侧不留 padding：让媒体贴住右边缘 */
.about__section {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 40px;
  padding: var(--ui-about-padding);
}

.about__col--text {
  flex: 1 1 420px;
  min-width: 300px;
}

.about__title {
  font-size: var(--ui-about-font-title);
  color: var(--ui-text-primary);
}

.about__title-line {
  display: block;
}

/* 第二行阶梯缩进 + 强调色 */
.about__title-line--accent {
  padding-left: var(--ui-about-indent);
  color: var(--ui-primary);
}

.about__body {
  max-width: 520px;
  margin: 32px 0 0 var(--ui-about-indent);
  font-size: var(--ui-about-font-body);
  line-height: 1.7;
  color: var(--ui-text-tertiary);
}

.about__cta {
  margin: 36px 0 0 var(--ui-about-indent);
}

/* 构建元信息：只给排查用，视觉上退到次要层级（颜色一律走令牌） */
.about__meta {
  margin: 12px 0 0 var(--ui-about-indent);
  color: var(--ui-text-label-secondary);
  font-size: var(--ui-font-size-sm);
}

.about__col--media {
  flex: 1 1 360px;
  min-width: 280px;
  display: flex;
  justify-content: flex-end;
  position: relative;
}

/* 右栏媒体位：无文本装饰玻璃面板（原视频位，视频已升为全局背景） */
.about__media {
  position: relative;
  width: 100%;
  max-width: var(--ui-about-media-max);
  aspect-ratio: 16 / 10;
  overflow: hidden;
}

/* 青色光晕（原为视频染色层）：视频移交全局背景后只保留这层光晕 */
.about__glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 32% 22%, var(--ui-about-tint), transparent 68%);
  pointer-events: none;
}
</style>

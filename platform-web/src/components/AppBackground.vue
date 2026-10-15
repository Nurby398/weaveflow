<script setup>
/**
 * 全局背景：那支视频 + 蒙版 + 覆盖层 + 彩色光晕（全站**唯一**的 <video> 实例）
 * ------------------------------------------------------------------
 * 依据（用户原话）：
 *   「我喜欢目前这个视频背景，可以沿用，智能体对话界面的 ui 设计也要统一，背景就用视频」
 *   「深色玻璃 + 彩色光晕背景」
 *   「并在背景上增加一些背景」
 *   「改完这些再做一版明亮主题的……」
 * 层序（自下而上）：视频 → 浅色覆盖层 → 蒙版 → 彩色光晕 → 内容。
 * 全站唯一实例，挂在 App.vue 上，所有路由（含登录/介绍/对话）共用。
 *
 * 明亮主题下视频怎么处理（做法由本文件决定，理由写在这里）：
 *   1. 视频降到 12% 不透明度（--ui-app-video-opacity），
 *   2. 其上加一层 94% 白的浅色覆盖层（--ui-app-veil）。
 * 为什么两层一起用：只降不透明度，视频的暗部仍会透上来把浅色页压脏；
 * 只覆盖不加透明度控制，浅色的上限又被视频的亮部顶住、压不干净。
 * 两层叠加后视频只剩约 0.7% 的可见量——它是"极淡的底纹"而不是画面，
 * 明亮主题因此干净；同时视频元素、src、数量都没动（用户明确说喜欢这支视频，不能删）。
 * 蒙版与光晕两套主题都有值，只换令牌不改结构。
 *
 * 光晕本轮加重（依据用户原话：「层次感最好鲜明一点」「ui 互动效果显著一点」）：
 * 明亮档由 0.16 提到 0.42，并把三片彩晕铺满整页（左上青 / 右上紫 / 底部中央暖橙）。
 * 深色档保持 0.22 不变——深色的观感以那支视频为主，用户没有要求改它。
 */
import { APP_BACKGROUND_VIDEO } from '@/config/media'
import { useAutoplayVideo } from '@/composables/useAutoplayVideo'

const { videoRef, reducedMotion } = useAutoplayVideo()
</script>

<template>
  <div class="app-bg" :class="{ 'is-reduced': reducedMotion }" aria-hidden="true">
    <video
      ref="videoRef"
      class="app-bg__video"
      :src="APP_BACKGROUND_VIDEO"
      autoplay
      muted
      loop
      playsinline
      preload="metadata"
    />
    <!-- 浅色覆盖层：深色主题下是全透明（观感不变），明亮主题把视频收成极淡底纹 -->
    <div class="app-bg__veil" />
    <!-- 视频之上、内容之下的蒙版：正文靠它可读（深色厚、浅色薄） -->
    <div class="app-bg__scrim" />
    <!-- 背景元素：柔和的多色径向光晕（纯 CSS 渐变，不引入图片文件） -->
    <div class="app-bg__glow" />
  </div>
</template>

<style scoped>
.app-bg {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
  /* 视频取不到 / reduce 动效时看到的就是这层渐变，不会白屏 */
  background: var(--ui-app-fallback);
}

.app-bg__video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  /* 明亮主题把它压成很淡的底层（深色主题为 1，观感保持原样） */
  opacity: var(--ui-app-video-opacity);
  pointer-events: none;
  user-select: none;
}

.app-bg__veil {
  position: absolute;
  inset: 0;
  background: var(--ui-app-veil);
  pointer-events: none;
}

.app-bg__scrim {
  position: absolute;
  inset: 0;
  background: var(--ui-app-scrim);
  pointer-events: none;
}

.app-bg__glow {
  position: absolute;
  inset: 0;
  background: var(--ui-app-glow);
  opacity: var(--ui-app-glow-opacity);
  pointer-events: none;
}

/* 减少动效：不出画面，只留渐变兜底（覆盖层与光晕不受影响） */
.app-bg.is-reduced .app-bg__video {
  display: none;
}
</style>

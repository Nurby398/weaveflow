<script setup>
/**
 * 粒子内核背景（织流定制）
 * ------------------------------------------------------------------
 * 把 particle-orb.html 的 ParticleOrb canvas 特效接到聊天窗口：
 *   · `streaming=true`（AI 正在回答）→ 'speaking'：粒子**聚合 + 强脉冲**；
 *   · `streaming=false`（回答完毕 / 等待用户）→ 'idle'：粒子**散开 + 自转 + 轻微脉冲**；
 *   · 画布透明（alpha），背景即窗口底色，固定在主区（不随消息滚动）；
 *   · 配色随主题：明亮主题用灰黑粒子，暗黑主题用亮色反差粒子（不被深色背景压住）。
 * 测试/降级环境（canvas 2D 上下文不可用）静默跳过，不影响界面。
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ParticleOrb, { PARTICLE_PALETTES } from '@/lib/particleOrb'
import { useTheme } from '@/composables/useTheme'

const props = defineProps({
  /** 是否正在生成回答 */
  streaming: { type: Boolean, default: false },
  /** 粒子数量（0 = 按尺寸自动；背景层建议几百，别太密） */
  count: { type: Number, default: 800 },
})

const { theme } = useTheme()

const canvasRef = ref(null)
let orb = null

function paletteFor(value) {
  return PARTICLE_PALETTES[value] || PARTICLE_PALETTES.light
}

onMounted(() => {
  const canvas = canvasRef.value
  // 测试 / 降级环境：happy-dom 等没有 2D 上下文，直接跳过，不影响挂载
  if (!canvas || typeof canvas.getContext !== 'function' || !canvas.getContext('2d')) return
  orb = new ParticleOrb(canvas, {
    count: props.count,
    state: props.streaming ? 'speaking' : 'idle',
    alpha: true,
    autoSpin: 0.1,
    palette: paletteFor(theme.value),
  })
})

watch(
  () => props.streaming,
  (on) => {
    orb?.setState(on ? 'speaking' : 'idle')
  },
)

watch(
  () => theme.value,
  (value) => {
    orb?.setPalette(paletteFor(value))
  },
)

onBeforeUnmount(() => {
  orb?.destroy()
  orb = null
})
</script>

<template>
  <canvas ref="canvasRef" class="particle-orb" aria-hidden="true" />
</template>

<style scoped>
.particle-orb {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0; /* 垫在内容（head/list/composer z-index:1）之下 */
  pointer-events: none; /* 粒子是纯背景，不拦截任何点击/滚轮 */
}
</style>

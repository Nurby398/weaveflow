<script setup>
/**
 * 粒子内核背景（织流定制）
 * ------------------------------------------------------------------
 * 把 particle-orb.html 的 ParticleOrb canvas 特效接到聊天窗口：
 *   · `streaming=true`（AI 正在回答）→ 'speaking'：粒子**聚合 + 强脉冲**；
 *   · `streaming=false`（回答完毕 / 等待用户）→ 'idle'：粒子**散开 + 自转 + 轻微脉冲**；
 *   · 画布透明（alpha），背景即窗口底色；粒子为灰黑色系（lib/particleOrb.js DEFAULTS）。
 * 测试/降级环境（canvas 2D 上下文不可用）静默跳过，不影响界面。
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ParticleOrb from '@/lib/particleOrb'

const props = defineProps({
  /** 是否正在生成回答 */
  streaming: { type: Boolean, default: false },
  /** 粒子数量（0 = 按尺寸自动；背景层建议几百，别太密） */
  count: { type: Number, default: 800 },
})

const canvasRef = ref(null)
let orb = null

onMounted(() => {
  const canvas = canvasRef.value
  // 测试 / 降级环境：happy-dom 等没有 2D 上下文，直接跳过，不影响挂载
  if (!canvas || typeof canvas.getContext !== 'function' || !canvas.getContext('2d')) return
  orb = new ParticleOrb(canvas, {
    count: props.count,
    state: props.streaming ? 'speaking' : 'idle',
    alpha: true,
    autoSpin: 0.1,
  })
})

watch(
  () => props.streaming,
  (on) => {
    orb?.setState(on ? 'speaking' : 'idle')
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
  z-index: 0; /* 垫在消息流(.chat__thread z-index:1)之下 */
  pointer-events: none; /* 粒子是纯背景，不拦截任何点击/滚轮 */
}
</style>

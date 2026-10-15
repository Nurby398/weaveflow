/**
 * 背景视频自动播放的健壮性处理（全站唯一实例 AppBackground 使用）
 * ------------------------------------------------------------------
 * 做四件事：
 *   1. 每次 play 之前先把 muted 设为 true —— 浏览器只允许静音自动播放；
 *   2. play() 返回的 Promise 必须吞掉 rejection，否则控制台会刷未处理的拒绝；
 *   3. 每 1s 重试一次（仅在视频处于暂停时），并在首次 click / touchstart 再试一次
 *      —— 部分浏览器要等用户手势才允许播放；
 *   4. 无障碍与性能：prefers-reduced-motion: reduce 时不自动播放（交给深色渐变兜底），
 *      标签页切到后台时暂停、回到前台再播。
 * 卸载时清掉定时器与全局监听，避免路由离开后仍在操作已销毁的节点。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'

export function useAutoplayVideo() {
  const videoRef = ref(null)
  /** 用户要求减少动效：暂停视频，退回深色渐变兜底 */
  const reducedMotion = ref(false)
  let timer = null
  let query = null

  function tryPlay() {
    const video = videoRef.value
    if (!video) return
    video.muted = true
    const result = video.play()
    if (result && typeof result.catch === 'function') result.catch(() => {})
  }

  function handleFirstInteraction() {
    tryPlay()
    window.removeEventListener('click', handleFirstInteraction)
    window.removeEventListener('touchstart', handleFirstInteraction)
  }

  function startTimer() {
    if (timer) return
    timer = window.setInterval(() => {
      // 后台标签页与减少动效时都不要重试，否则会把刚暂停的视频又播起来
      if (document.hidden || reducedMotion.value) return
      if (videoRef.value?.paused) tryPlay()
    }, 1000)
  }

  function stopTimer() {
    if (!timer) return
    window.clearInterval(timer)
    timer = null
  }

  /** 页面切到后台就停，别让隐藏标签页继续解码视频 */
  function handleVisibility() {
    if (document.hidden) {
      videoRef.value?.pause()
      stopTimer()
      return
    }
    if (!reducedMotion.value) {
      tryPlay()
      startTimer()
    }
  }

  function handleMotionChange(event) {
    reducedMotion.value = event.matches
    if (event.matches) {
      videoRef.value?.pause()
      stopTimer()
      return
    }
    tryPlay()
    startTimer()
  }

  onMounted(() => {
    query = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotion.value = query.matches

    if (!reducedMotion.value) {
      tryPlay()
      startTimer()
    }

    query.addEventListener('change', handleMotionChange)
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('click', handleFirstInteraction)
    window.addEventListener('touchstart', handleFirstInteraction)
  })

  onBeforeUnmount(() => {
    stopTimer()
    query?.removeEventListener('change', handleMotionChange)
    document.removeEventListener('visibilitychange', handleVisibility)
    window.removeEventListener('click', handleFirstInteraction)
    window.removeEventListener('touchstart', handleFirstInteraction)
  })

  return { videoRef, reducedMotion }
}

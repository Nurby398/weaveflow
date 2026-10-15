/**
 * 全局轻提示（Toast）状态与调用入口
 * 与组件解耦：任何位置 import { useToast } 后直接调用，由 <Toast /> 统一渲染。
 */
import { reactive, readonly } from 'vue'

let seed = 0

const state = reactive({
  items: [],
})

/** 移除一条提示 */
export function removeToast(id) {
  const index = state.items.findIndex((item) => item.id === id)
  if (index > -1) state.items.splice(index, 1)
}

/**
 * 推送一条提示
 * @param {string | { type?: string, title?: string, message?: string, duration?: number }} options
 * @returns {number} 提示 id
 */
export function pushToast(options) {
  const config = typeof options === 'string' ? { message: options } : options || {}
  const { type = 'info', title = '', message = '', duration = 3000 } = config
  const id = ++seed
  state.items.push({ id, type, title, message })
  if (duration > 0) setTimeout(() => removeToast(id), duration)
  return id
}

export function useToast() {
  return {
    toasts: readonly(state),
    push: pushToast,
    remove: removeToast,
    info: (message, options = {}) => pushToast({ ...options, type: 'info', message }),
    success: (message, options = {}) => pushToast({ ...options, type: 'success', message }),
    warning: (message, options = {}) => pushToast({ ...options, type: 'warning', message }),
    error: (message, options = {}) => pushToast({ ...options, type: 'error', message }),
  }
}

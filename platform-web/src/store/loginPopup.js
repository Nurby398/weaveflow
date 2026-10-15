/**
 * 全局登录弹窗控制
 * 任何位置（路由守卫、受保护功能按钮）都可以直接调用 openLoginPopup()，
 * 由挂载在 App.vue 中的 LoginPopup 组件统一渲染。
 */
import { reactive } from 'vue'

export const loginPopupState = reactive({
  /** 弹窗是否显示 */
  visible: false,
  /** 弹窗标题 */
  title: '登录后继续',
  /** 提示文案，说明为什么需要登录 */
  message: '',
  /** 登录成功后需要跳回的地址，为空则不跳转 */
  redirect: '',
})

/**
 * 打开登录弹窗
 * @param {{ title?: string, message?: string, redirect?: string }} options
 */
export function openLoginPopup(options = {}) {
  const { title = '登录后继续', message = '该功能需要登录后使用', redirect = '' } = options
  loginPopupState.title = title
  loginPopupState.message = message
  loginPopupState.redirect = redirect
  loginPopupState.visible = true
}

/** 关闭登录弹窗并清空待跳转地址 */
export function closeLoginPopup() {
  loginPopupState.visible = false
  loginPopupState.redirect = ''
}

/** 取出本次弹窗待跳转地址（登录成功后由弹窗组件消费） */
export function consumeRedirect() {
  const redirect = loginPopupState.redirect
  loginPopupState.redirect = ''
  return redirect
}

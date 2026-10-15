/**
 * 登录校验组合式函数
 * 用于「页面可见、但交互能力需要登录」的场景：游客可浏览界面，
 * 点击需要登录的按钮时再唤起登录弹窗，不调用任何受保护接口。
 *
 * 用法：
 *   const { requireLogin, withAuth } = useAuthGuard()
 *   function handleRun() { if (!requireLogin('运行智能体')) return; ...业务逻辑 }
 *   const handleAsk = withAuth(() => { ... }, { actionName: '调用编排接口' })
 */
import { isLoggedIn } from '@/store/user'
import { openLoginPopup } from '@/store/loginPopup'

export function useAuthGuard() {
  /**
   * 校验登录状态，未登录时唤起弹窗
   * @param {string} actionName 受保护的动作名称，用于弹窗提示文案
   * @param {{ title?: string, message?: string, redirect?: string }} options 覆盖默认文案
   * @returns {boolean} true 表示已登录，可以继续执行业务逻辑
   */
  function requireLogin(actionName = '该功能', options = {}) {
    if (isLoggedIn()) return true

    openLoginPopup({
      title: options.title || '登录后继续',
      message: options.message || `登录后即可${actionName}`,
      redirect: options.redirect || '',
    })
    return false
  }

  /**
   * 包装一个需要登录才能执行的回调
   * @param {Function} fn 业务函数
   * @param {{ actionName?: string } & object} options
   */
  function withAuth(fn, options = {}) {
    const { actionName = '该功能', ...rest } = options
    return (...args) => {
      if (!requireLogin(actionName, rest)) return undefined
      return fn(...args)
    }
  }

  return { requireLogin, withAuth }
}

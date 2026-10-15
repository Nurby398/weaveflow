/**
 * 主题：深色 / 明亮两套，可切换
 * ------------------------------------------------------------------
 * 依据（用户原话）：
 *   「改完这些再做一版明亮主题的，效果就按照苹果官网做……」
 *   「做完明亮主题，把主题切换按钮放在页面上」
 *   「前端默认是明亮主题」
 * 配色不在组件里分支：只在 <html> 上写 data-theme，颜色全部由
 * styles/tokens.css 的 :root（深色）与 html[data-theme="light"]（明亮）两套令牌决定。
 *
 * 三条默认（本轮按用户原话改过第 3 条）：
 *   1. 默认主题：明亮；
 *   2. 记忆：localStorage['platform_theme']，刷新后保持，切换按钮不变；
 *   3. 无记录时**直接用明亮**，不再看 prefers-color-scheme：本机 Chrome 对
 *      no-preference 会报 light，用系统偏好决定默认会让行为含糊。
 *      有记录时仍以记录为准。
 * 另：setTheme 时一并同步 html 的 color-scheme，否则原生控件与滚动条会是另一套主题。
 */
import { readonly, ref } from 'vue'

export const THEMES = ['dark', 'light']

/** 记忆键名（调度者标定的默认） */
export const STORAGE_KEY = 'platform_theme'

/** 默认主题（用户原话：「前端默认是明亮主题」） */
export const DEFAULT_THEME = 'light'

const theme = ref(DEFAULT_THEME)

function readStored() {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return THEMES.includes(value) ? value : null
  } catch {
    // 隐私模式下 localStorage 不可读，按「无记录」处理
    return null
  }
}

function writeStored(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // 不可写时仅当次生效，不影响渲染
  }
}

/** 启动时该用哪套：有记录用记录，无记录一律明亮 */
export function resolveTheme() {
  return readStored() || DEFAULT_THEME
}

/**
 * 应用主题并记忆。
 * @param {'dark'|'light'} next 非法值一律落到默认的明亮
 */
export function setTheme(next) {
  const value = THEMES.includes(next) ? next : DEFAULT_THEME
  theme.value = value
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = value
    // 原生控件 / 滚动条跟随：否则明亮主题下滚动条还是深色
    document.documentElement.style.colorScheme = value
  }
  writeStored(value)
  return value
}

/** 反向切换，返回切换后的取值 */
export function toggle() {
  return setTheme(theme.value === 'light' ? 'dark' : 'light')
}

/** 启动时调用：有记录用记录，无记录时用默认的明亮（不写记录，留给用户显式选择） */
export function restoreTheme() {
  const value = resolveTheme()
  theme.value = value
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = value
    document.documentElement.style.colorScheme = value
  }
  return value
}

export function useTheme() {
  return {
    theme: readonly(theme),
    toggle,
    setTheme,
    /** 历史调用点使用的名字，等价于 setTheme（入参为具体主题名） */
    applyTheme: setTheme,
  }
}

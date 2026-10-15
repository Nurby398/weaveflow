/**
 * Markdown 渲染（markdown-it 已装，不新增依赖）
 * html:false —— 关闭内联 HTML，避免助手输出里的标签直接进 DOM。
 */
import MarkdownIt from 'markdown-it'
import { highlightCode } from './highlight'

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  highlight: (code, lang) => {
    const language = String(lang || '').trim()
    const cls = language ? ` class="md-code language-${language.replace(/[^\w-]/g, '')}"` : ' class="md-code"'
    return `<pre class="md-pre"><code${cls}>${highlightCode(code, language)}</code></pre>`
  },
})

/**
 * 剥离推理标签：部分思考型模型会把思维链**内联写在正文里**（`<think>…</think>`）。
 * 实测依据：上游 `/run` 的 `message` 事件**顶层 `answer` 字段确实带这些标签**
 * （见 docs/通用智能体与白标方案-v1.md 待办 18）。
 * ⚠️ **这是临时兜底**：真正的修复必须在**后端入库前**剥离，否则脏内容仍会落库。
 * 规则：① 去掉成对标签；② 去掉未闭合的开标签及其后内容（流式中开标签先到）；
 *      ③ 去掉**结尾残缺**的标签前缀（分片可能把 `<think` 切成 `<thi`）——只掐结尾，不误伤正文。
 */
export function stripReasoning(source) {
  let text = String(source ?? '')
  text = text.replace(/<think\b[^>]*>[\s\S]*?<\/think\s*>/gi, '')
  const open = text.search(/<think\b[^>]*>/i)
  if (open !== -1) {
    text = text.slice(0, open)
  }
  return text.replace(/<\/?t(?:h(?:i(?:n(?:k)?)?)?)?$/i, '')
}

export function renderMarkdown(source) {
  return md.render(stripReasoning(source))
}

/** 行首的代码围栏（开/闭都命中），用于判断围栏是否成对 */
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})[^\n]*$/gm

/**
 * 找出「结尾未闭合、且内部还没有任何内容」的代码围栏起始位置。
 * 只有这种情况会导致渲染出一条空的圆角占位条；已经有内容的围栏要照常流式显示。
 */
function emptyOpenFenceIndex(text) {
  let count = 0
  let last = null
  FENCE_RE.lastIndex = 0
  let match = FENCE_RE.exec(text)
  while (match !== null) {
    count += 1
    last = match
    match = FENCE_RE.exec(text)
  }
  if (count % 2 === 0 || !last) return -1
  return text.slice(last.index + last[0].length).trim() ? -1 : last.index
}

/**
 * 流式渲染：模型刚打出 ```js 而内容还没到时不渲染这个空代码块，
 * 由 Chat 的流式光标接住视觉反馈（见 styles/markdown.css 的 .md-body--streaming）。
 */
export function renderStreamingMarkdown(source) {
  const text = String(source ?? '')
  const cut = emptyOpenFenceIndex(text)
  return renderMarkdown(cut === -1 ? text : text.slice(0, cut))
}

export default md

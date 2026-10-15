/**
 * 轻量代码高亮
 * ------------------------------------------------------------------
 * 不引入 highlight.js（任务禁止新增依赖），用一次正则扫描覆盖常见语言的关键字、
 * 字符串、注释、数字与标点。它不是语法分析器，只负责「读起来有层次」。
 * 颜色全部来自 --ui-* 令牌，见 components/ui 的 .md-body 样式。
 * ------------------------------------------------------------------
 */

const JS_LIKE = [
  'await',
  'async',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'default',
  'delete',
  'do',
  'else',
  'export',
  'extends',
  'finally',
  'for',
  'from',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'interface',
  'let',
  'new',
  'of',
  'return',
  'super',
  'switch',
  'this',
  'throw',
  'try',
  'type',
  'typeof',
  'var',
  'void',
  'while',
  'yield',
  'true',
  'false',
  'null',
  'undefined',
  'NaN',
  'enum',
  'implements',
  'readonly',
  'as',
  'satisfies',
]

const PYTHON = [
  'and',
  'as',
  'assert',
  'async',
  'await',
  'break',
  'class',
  'continue',
  'def',
  'del',
  'elif',
  'else',
  'except',
  'finally',
  'for',
  'from',
  'global',
  'if',
  'import',
  'in',
  'is',
  'lambda',
  'None',
  'nonlocal',
  'not',
  'or',
  'pass',
  'raise',
  'return',
  'True',
  'False',
  'try',
  'while',
  'with',
  'yield',
  'self',
]

const SHELL = [
  'cd',
  'echo',
  'export',
  'for',
  'do',
  'done',
  'if',
  'then',
  'fi',
  'else',
  'elif',
  'while',
  'case',
  'esac',
  'function',
  'local',
  'return',
  'set',
  'source',
  'then',
  'until',
  'in',
]

const KEYWORDS = {
  js: new Set(JS_LIKE),
  javascript: new Set(JS_LIKE),
  ts: new Set(JS_LIKE),
  typescript: new Set(JS_LIKE),
  jsx: new Set(JS_LIKE),
  tsx: new Set(JS_LIKE),
  vue: new Set(JS_LIKE),
  json: new Set(['true', 'false', 'null']),
  py: new Set(PYTHON),
  python: new Set(PYTHON),
  sh: new Set(SHELL),
  bash: new Set(SHELL),
  shell: new Set(SHELL),
  zsh: new Set(SHELL),
  yaml: new Set(['true', 'false', 'null']),
}

const DEFAULT_KEYWORDS = KEYWORDS.js

const TOKEN_RE =
  /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)|\b(0[xX][0-9a-fA-F]+|\d+(?:\.\d+)?)\b|\b([A-Za-z_$][\w$]*)\b|([{}()[\].,;:+\-*/%=<>!&|?~^]+)/g

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const wrap = (cls, text) => `<span class="${cls}">${escapeHtml(text)}</span>`

/**
 * @param {string} code 源码
 * @param {string} lang 语言标识（markdown 围栏）
 * @returns {string} 高亮后的 HTML（已转义）
 */
export function highlightCode(code, lang = '') {
  const keywords = KEYWORDS[String(lang || '').toLowerCase()] || DEFAULT_KEYWORDS
  const source = String(code ?? '')

  let html = ''
  let cursor = 0
  TOKEN_RE.lastIndex = 0

  let match = TOKEN_RE.exec(source)
  while (match !== null) {
    if (match.index > cursor) html += escapeHtml(source.slice(cursor, match.index))

    const [raw, comment, str, num, word, punct] = match
    if (comment) html += wrap('tok-comment', raw)
    else if (str) html += wrap('tok-str', str)
    else if (num) html += wrap('tok-num', num)
    else if (word) html += keywords.has(word) ? wrap('tok-kw', word) : escapeHtml(word)
    else if (punct) html += wrap('tok-punct', punct)
    else html += escapeHtml(raw)

    cursor = match.index + raw.length
    match = TOKEN_RE.exec(source)
  }

  if (cursor < source.length) html += escapeHtml(source.slice(cursor))
  return html
}

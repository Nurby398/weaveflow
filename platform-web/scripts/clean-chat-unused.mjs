// 一次性脚本：清理 Chat.vue 抽出消息流后遗留的未用函数与导入
import { readFileSync, writeFileSync } from 'node:fs'

const file = 'src/views/Chat.vue'
let lines = readFileSync(file, 'utf8').split('\n')

function removeFunction(name) {
  const idx = lines.findIndex((l) => l.trimStart().startsWith(`function ${name}(`) || l.trimStart().startsWith(`async function ${name}(`))
  if (idx < 0) return console.warn(`未找到函数 ${name}`)
  // 向上吞掉紧邻的 JSDoc 注释块
  let start = idx
  while (start - 1 >= 0 && (lines[start - 1].trim().startsWith('*') || lines[start - 1].trim() === '*/' || lines[start - 1].trim() === '/**')) start -= 1
  // 向下找到函数体结束（列 0 的 `}`）
  let end = idx
  for (let i = idx + 1; i < lines.length; i += 1) {
    if (lines[i] === '}') {
      end = i
      break
    }
  }
  lines = [...lines.slice(0, start), ...lines.slice(end + 1)]
  console.log(`已移除 ${name}（${start + 1}..${end + 1}）`)
}

for (const name of ['speakerOf', 'speakerAvatar', 'assistantAvatar', 'thinkingName', 'renderAssistant', 'startDispatchTurn']) removeFunction(name)

// 移除已无引用的导入（在删函数后再按引用判断）
const importCandidates = ['DispatchCard', 'SpeakerBar', 'attachmentRawUrl', 'formatDateTime', 'formatNumber', 'renderMarkdown', 'renderStreamingMarkdown']
const text = lines.join('\n')
for (const name of importCandidates) {
  // 除去导入行本身，是否还有引用
  const withoutImport = lines.filter((l) => !l.includes(`import ${name}`) && !l.includes(` ${name},`) && !(l.includes('{') && l.includes(name))).join('\n')
  const refs = (withoutImport.match(new RegExp(`\\b${name}\\b`, 'g')) || []).length
  if (refs === 0) {
    lines = lines.filter((l) => !new RegExp(`\\b${name}\\b`).test(l) || !l.includes('import'))
    console.log(`已从导入里移除 ${name}`)
  }
}

writeFileSync(file, lines.join('\n'), 'utf8')
console.log(`完成：${lines.length} 行`)

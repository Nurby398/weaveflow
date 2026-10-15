// 一次性脚本：把 Chat.vue 的消息流区块替换为 ChatMessageList 子组件
import { readFileSync, writeFileSync } from 'node:fs'

const file = 'src/views/Chat.vue'
const lines = readFileSync(file, 'utf8').split('\n')

// 定位 <article v-for="message in messages" ...> 与它对应的 </article>
const startIdx = lines.findIndex((l) => l.includes('article v-for="message in messages"'))
const endIdx = lines.findIndex((l, i) => i > startIdx && l.trim() === '</article>')
if (startIdx < 0 || endIdx < 0) {
  console.error('未定位到消息流区块', startIdx, endIdx)
  process.exit(1)
}

const snippet = [
  '            <ChatMessageList',
  '              :messages="messages"',
  '              :agents="agents"',
  '              :header-agent="headerAgent"',
  '              :active-dispatch="activeDispatch"',
  '              :thinking-seconds="thinkingSeconds"',
  '              :thinking-gif="thinkingGif"',
  '              @copy="copyMessage"',
  '              @regenerate="regenerate"',
  '              @remove="removeMessage"',
  '              @confirm="confirmStage"',
  '              @choose="chooseCandidate"',
  '              @reject="rejectCandidate"',
  '            />',
]

const out = [...lines.slice(0, startIdx), ...snippet, ...lines.slice(endIdx + 1)]
writeFileSync(file, out.join('\n'), 'utf8')
console.log(`已替换 ${startIdx + 1}..${endIdx + 1} 行，共 ${lines.length} → ${out.length} 行`)

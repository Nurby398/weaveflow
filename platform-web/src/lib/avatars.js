/**
 * 智能体头像解析
 * ------------------------------------------------------------------
 * 复用根目录 ../picture/ 下的 6 张人物图，只读引用，不复制、不修改原文件。
 *
 * 【匹配规则】**先按名字精确匹配**——那 6 张图的文件名本身就是智能体名
 * （`毕设选题与立项顾问.jpg`、`需求分析与开题工程师.jpg` …），名字对上就用它。
 *
 * 【为什么改了】原实现只按 `hash(agent.id) % 6` 取图，等于从池子里任意挑一张，
 * 实测 5 个接入智能体里有 4 个撞在同一张图上（①拿②的图、②拿①的图、
 * ③④⑤ 全拿②的图），用户看到的就是「头像对不上」。图片是对的，映射是错的。
 *
 * 【回落】名字匹配不到（例如用户自建、命名自由）才退回按 id 哈希取图——
 * 目的是**同一 agent 每次都同一张、不会随机跳动**，不保证语义正确。
 * 后端 agent 记录目前没有头像字段（接入智能体的 `icon` 为 null），
 * 若将来来源平台 `/config` 能给出头像地址，应改为优先使用它。
 *
 * 【品牌标（织流.png）】平台自己的默认助手（DEFAULT_ASSISTANT_NAME）与主对话/调度器
 * 用的不是人物照，而是品牌标。**必须走上面的精确映射**：一旦落到哈希兜底，
 * 默认助手会被随机分到一张学生人物照——一个什么问题都能答的助手长着
 * 某个子智能体的脸，语义明显不对。
 *
 * ⚠️ 按 name 精确匹配默认助手是**临时约定**（对应 docs/通用智能体与白标方案-v1.md
 *    待办 23：后端 agent_defs 没有「是否默认助手」字段）。Java 版必须补一个显式字段
 *    （如 `agent_defs.is_default_assistant`），前端改为读该字段，不再按名字认人。
 *    在那之前，展示名的**唯一真源**是下面的 DEFAULT_ASSISTANT_NAME——改名只需改它一处；
 *    按名字认人/认图的地方一律读它，不许再写字面量（否则改个名字就静默失效）。
 * ------------------------------------------------------------------
 */
import consultant from '../../../picture/毕设选题与立项顾问.jpg'
import proposal from '../../../picture/需求分析与开题工程师.jpg'
import architect from '../../../picture/架构与数据库设计工程师.jpg'
import developer from '../../../picture/代码开发与测试工程师.jpg'
import writer from '../../../picture/毕业论文规范工程师.jpg'
import supervisor from '../../../picture/毕设进度监理.jpg'
/**
 * 品牌标：原图 **1728×2304 / 2.9 MB**，已**原地压缩**为 **384×512 / 264 KB**（等比，未变形）。
 * ⚠️ 排查记录（2026-10-15 **更正**）：当时写入失败**不是"被某个进程独占占用"**，而是该 PNG 带着
 * **ReadOnly 文件属性**——清掉属性后一次写入即成功。
 * **教训：确认文件不可写时，先看它的属性（`IsReadOnly` / `attrib`），不要先猜"谁锁了它"。**
 * 原件备份在 `_archive/picture-originals-20261014/`。
 * 注：同目录另有内容相同的冗余文件 `织流-512.png`（可删；代码只引用 `织流.png`）。
 */
import brand from '../../../picture/织流.png'

export const AGENT_AVATARS = [consultant, proposal, architect, developer, writer, supervisor]

/**
 * ★ 默认助手（平台自有智能体，后端 id 267b6d9f-d006-4ae8-a853-c4fac26e425b）的展示名。
 * **全仓库唯一的定义处**：按名字认人（/chat 默认落点、主对话兜底问答）与认图（BY_NAME）
 * 都读它。改名只改这一行——先前的实现把字面量散在多处，库里一改名就静默失联。
 * ⚠️ 临时约定，Java 版改成显式字段后这里应被删除（见文件头 ⚠️ 与待办 23）。
 */
export const DEFAULT_ASSISTANT_NAME = '织流'

/** 品牌标：平台自身的默认助手与主对话/调度器共用，不参与哈希兜底池 */
export const BRAND_AVATAR = brand

/** 图片文件名就是智能体名；键必须与文件名逐字一致（品牌标项除外，见文件头说明） */
const BY_NAME = new Map([
  [DEFAULT_ASSISTANT_NAME, brand],
  ['主对话', brand],
  ['织流调度', brand],
  ['毕设选题与立项顾问', consultant],
  ['需求分析与开题工程师', proposal],
  ['架构与数据库设计工程师', architect],
  ['代码开发与测试工程师', developer],
  ['毕业论文规范工程师', writer],
  ['毕设进度监理', supervisor],
])

/** 去掉「①」这类阶段序号与前置标点，好让「①毕设选题与立项顾问」也能匹配上 */
function normalizeName(name) {
  return String(name ?? '')
    .replace(/^[^\u4e00-\u9fa5]+/, '')
    .trim()
}

/** 由任意字符串稳定推导出头像下标（仅用于名字匹配不到时的回落） */
function hash(text) {
  let value = 0
  for (let i = 0; i < text.length; i += 1) {
    value = (value * 31 + text.charCodeAt(i)) % 100000
  }
  return value
}

/** 取头像地址；agent 为空时返回空串，交给 Avatar 走首字回落 */
export function agentAvatar(agent, index = null) {
  if (Number.isInteger(index) && index >= 0) return AGENT_AVATARS[index % AGENT_AVATARS.length]
  const exact = BY_NAME.get(normalizeName(agent?.name))
  if (exact) return exact
  const key = agent?.id || agent?.name || ''
  if (!key) return ''
  return AGENT_AVATARS[hash(key) % AGENT_AVATARS.length]
}

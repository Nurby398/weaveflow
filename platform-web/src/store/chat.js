/**
 * 对话领域 store（P1-1 · 第 4 块的预备层）
 * ------------------------------------------------------------------
 * 目标：把散在 Chat.vue 里的会话/消息/流式状态收敛到这里，跨页面复用、避免重复请求。
 * 当前状态：store 契约已定义 + 单测覆盖；Chat.vue 的本地 ref 迁移到 store 是**下一会话**的
 * 接线工作（涉及 ~30 处读写点，需逐个迁移 + 每次过视觉门禁，不宜在无人值守时仓促完成）。
 */
import { defineStore } from 'pinia'

export const useChatStore = defineStore('chat', {
  state: () => ({
    /** 会话列表（不含消息正文） */
    conversations: [],
    /** 当前打开会话 id（'' = 未打开） */
    conversationId: '',
    /** 当前会话的消息流 */
    messages: [],
    /** 是否正在流式生成 */
    streaming: false,
  }),

  getters: {
    currentConversation: (state) => state.conversations.find((item) => item.id === state.conversationId) || null,
  },

  actions: {
    setConversations(list) {
      this.conversations = Array.isArray(list) ? list : []
    },
    setConversationId(id) {
      this.conversationId = String(id ?? '')
    },
    setMessages(list) {
      this.messages = Array.isArray(list) ? list : []
    },
    setStreaming(value) {
      this.streaming = value === true
    },
    /** 切换会话时清空消息与流式态（避免串台） */
    resetConversation() {
      this.conversationId = ''
      this.messages = []
      this.streaming = false
    },
  },
})

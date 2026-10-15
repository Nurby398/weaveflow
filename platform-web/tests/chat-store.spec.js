/**
 * chat store 单测（P1-1 第 4 块 · store 契约）
 * ------------------------------------------------------------------
 * 钉住状态/派生/动作的契约，供下一会话把 Chat.vue 本地 ref 迁进来时做回归锚点。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useChatStore } from '@/store/chat'

describe('store/chat', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('初始态：空列表、无会话、未流式', () => {
    const store = useChatStore()
    expect(store.conversations).toEqual([])
    expect(store.conversationId).toBe('')
    expect(store.messages).toEqual([])
    expect(store.streaming).toBe(false)
    expect(store.currentConversation).toBeNull()
  })

  it('setConversations / setConversationId → currentConversation 派生正确', () => {
    const store = useChatStore()
    store.setConversations([
      { id: 'c1', title: 'A' },
      { id: 'c2', title: 'B' },
    ])
    store.setConversationId('c2')
    expect(store.currentConversation).toEqual({ id: 'c2', title: 'B' })
  })

  it('resetConversation 清空消息与流式态', () => {
    const store = useChatStore()
    store.setMessages([{ id: 'm1', role: 'user', content: 'x' }])
    store.setStreaming(true)
    store.resetConversation()
    expect(store.messages).toEqual([])
    expect(store.streaming).toBe(false)
    expect(store.conversationId).toBe('')
  })

  it('非法入参被兜住（不抛、不脏数据）', () => {
    const store = useChatStore()
    store.setConversations(null)
    store.setMessages('not-array')
    store.setConversationId(null)
    store.setStreaming('truthy-but-not-true')
    expect(store.conversations).toEqual([])
    expect(store.messages).toEqual([])
    expect(store.conversationId).toBe('')
    expect(store.streaming).toBe(false)
  })
})

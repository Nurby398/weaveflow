import { describe, expect, it } from 'vitest'
import { renderMarkdown, renderStreamingMarkdown } from '@/lib/markdown'

describe('流式 Markdown 渲染', () => {
  it('末尾「刚打出围栏、内容还没来」的空代码块不渲染（避免出现空的圆角占位条）', () => {
    const html = renderStreamingMarkdown('已收到你的问题。\n\n```js\n')
    expect(html).toContain('已收到你的问题。')
    expect(html).not.toContain('md-pre')
  })

  it('已经有内容的未闭合代码块照常流式渲染', () => {
    const html = renderStreamingMarkdown('```js\nconst a = 1\n')
    expect(html).toContain('md-pre')
    expect(html).toContain('md-code')
  })

  it('成对围栏的完成态内容不受影响', () => {
    const html = renderStreamingMarkdown('```js\nconst a = 1\n```\n')
    expect(html).toContain('md-pre')
  })

  it('空内容返回空串（由 .md-body--streaming:empty 的流式光标接住）', () => {
    expect(renderStreamingMarkdown('')).toBe('')
    expect(renderStreamingMarkdown(undefined)).toBe('')
  })

  it('非流式的 renderMarkdown 不做裁剪', () => {
    expect(renderMarkdown('```js\n')).toContain('md-pre')
  })
})

describe('推理标签剥离（临时兜底，见 docs/通用智能体与白标方案-v1.md 待办 18）', () => {
  it('成对的 <think>…</think> 被剥离，只留最终答案', () => {
    const html = renderMarkdown('<think>我先想想…</think>织流 WEAVEFLOW 是平台。')
    expect(html).not.toContain('我先想想')
    expect(html).toContain('织流 WEAVEFLOW 是平台。')
  })

  it('多组思考 + 答案（实测的真实形态）只渲染答案', () => {
    const raw = '<think>思考甲</think><think>思考乙</think><think>\n\n</think>最终答案。'
    const html = renderMarkdown(raw)
    expect(html).toContain('最终答案。')
    expect(html).not.toContain('思考甲')
    expect(html).not.toContain('思考乙')
  })

  it('未闭合的开标签：流式中其后内容不显示（用户不该看到思维链）', () => {
    const html = renderStreamingMarkdown('<think>还在思考中，这段不能出现')
    expect(html).not.toContain('还在思考中')
  })

  it('结尾残缺的标签前缀被掐掉（分片可能把 <think 切成 <thi / <t）', () => {
    for (const tail of ['<t', '<th', '<thi', '<thin', '<think', '</t', '</thi']) {
      const html = renderStreamingMarkdown(`答案前半段${tail}`)
      expect(html).toContain('答案前半段')
      // markdown-it 会把残留的 `<` 转义成 `&lt;`，据此断言"不再有残缺前缀"
      expect(html).not.toContain('&lt;')
    }
  })

  it('正常文本不受误伤（`<` 与 `t` 不构成标签前缀时照常渲染）', () => {
    expect(renderMarkdown('a < b 且 t 是变量名')).toContain('a &lt; b')
    expect(renderMarkdown('```js\nconst t = 1\n```')).toContain('md-pre')
  })
})

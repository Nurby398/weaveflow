#!/usr/bin/env node
/**
 * 联调用的字节节流代理（不是 mock，不参与构建与测试）
 * ------------------------------------------------------------------
 * 为什么需要它：platform-server/scripts/fake-upstream.mjs 的 /v1 模式确实把
 * 「你」「好」「呀」写成三个独立增量帧，但帧间隔只有 6ms —— 浏览器里逐字流式渲染
 * 快到无法截图证明「是逐帧长出来的」。
 *
 * 本代理**只做一件事**：把上游写出的每个 chunk 之间拉开固定间隔再转发。
 * 内容一字不改，帧还是那些帧，仍然经过真后端的 SSE 通道；
 * 上游仍是 platform-server/scripts/fake-upstream.mjs，没有第二套假数据。
 *
 * 用法：
 *   node scripts/slow-proxy.mjs --listen=8788 --target=http://127.0.0.1:8787 --gap=600
 * 之后把 provider 的 baseUrl 指向 http://127.0.0.1:8788/v1（路径前缀原样透传）。
 * ------------------------------------------------------------------
 */
import { createServer, request as httpRequest } from 'node:http'

function parseArgs(argv) {
  const args = { listen: 8788, target: 'http://127.0.0.1:8787', gap: 600 }
  for (const item of argv) {
    const match = /^--([a-z]+)=(.*)$/.exec(item)
    if (!match) continue
    const [, key, value] = match
    if (key === 'listen') args.listen = Number.parseInt(value, 10)
    else if (key === 'target') args.target = value
    else if (key === 'gap') args.gap = Number.parseInt(value, 10)
  }
  return args
}

const args = parseArgs(process.argv.slice(2))
const target = new URL(args.target)

const server = createServer((req, res) => {
  const upstream = httpRequest(
    {
      hostname: target.hostname,
      port: target.port,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: target.host },
    },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers)
      // 逐个 chunk 排队转发：每个 chunk 之间等待 gap 毫秒
      let chain = Promise.resolve()
      up.on('data', (piece) => {
        chain = chain
          .then(() => new Promise((resolve) => setTimeout(resolve, args.gap)))
          .then(() => new Promise((resolve) => res.write(piece, resolve)))
      })
      up.on('end', () => chain.then(() => res.end()))
      up.on('error', () => chain.then(() => res.end()))
    },
  )
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: { message: `节流代理无法连接上游 ${args.target}` } }))
  })
  req.pipe(upstream)
})

server.listen(args.listen, '127.0.0.1', () => {
  console.log(
    `[slow-proxy] http://127.0.0.1:${args.listen} → ${args.target}（每个 chunk 间隔 ${args.gap}ms）`,
  )
})

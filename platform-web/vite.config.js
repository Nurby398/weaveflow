import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * 开发者工具开关
 * ------------------------------------------------------------------
 * 依据（用户原话）：「目前的视觉验收页面还没有按照你说的隐藏到开发者模式下，
 *   这一块你要设计一下，要合理且要让开发知道它的作用，要有简单介绍」。
 *
 * 为什么判定用 Vite 自己的 `command`，而不是 import.meta.env.DEV：
 *   本机 shell 带着 NODE_ENV=production，实测同一个 `npm run dev`
 *   （`vite --port 5281 --strictPort`）会算出 {DEV:false, PROD:true, MODE:"development"}，
 *   于是侧栏的「视觉验收」在 dev server 上消失——只有换一个终端才又出现，
 *   即「本地看得见、产物里没有」取决于环境变量而不是命令。
 *   `command` 只由跑的是哪条命令决定：`vite` / `vite dev` → 'serve'，
 *   `vite build` → 'build'，与 NODE_ENV 无关。
 *
 * define 的值是字面量，生产构建里 `__SHOW_DEVTOOLS__` 被替换成 false，
 * 该分支随之被消除，导航项不会进入产物。
 *
 * ⚠️ 为什么要用 loadEnv 而不是 process.env：
 *   Vite **不会**把 .env / .env.development 里的变量注入 process.env，
 *   因此原先的 `process.env.VITE_DEV_PROXY_TARGET` 永远不会被 .env 文件影响，
 *   .env 就成了摆设。这里显式 loadEnv(mode)，并保留 process.env 作为「shell 显式覆盖」的最高优先级。
 */
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  /** shell 环境变量 > .env 文件 > 代码默认值 */
  const pick = (key, fallback) => process.env[key] || env[key] || fallback

  /**
   * 构建元信息：注入产物，关于页可见 —— 线上出问题时能一眼定位到「哪个提交 / 哪次构建」。
   * git 不可用（例如从压缩包构建）时降级为 no-git，绝不因为读不到 commit 就让构建失败。
   */
  const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
  const gitSha = (() => {
    try {
      return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim()
    } catch {
      return 'no-git'
    }
  })()
  const buildTime = `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`

  return {
    define: {
      __SHOW_DEVTOOLS__: JSON.stringify(command === 'serve'),
      __APP_VERSION__: JSON.stringify(pkg.version),
      __GIT_SHA__: JSON.stringify(gitSha),
      __BUILD_TIME__: JSON.stringify(buildTime),
    },
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5175,
      // 对齐 platform-server 的默认端口（见 platform-server/src/config.ts 的 PORT default）
      proxy: {
        '/api': {
          target: pick('VITE_DEV_PROXY_TARGET', 'http://localhost:3000'),
          changeOrigin: true,
        },
      },
      // 智能体头像放在仓库根目录 ../picture/，只读引用，不复制原文件
      fs: {
        allow: [fileURLToPath(new URL('.', import.meta.url)), fileURLToPath(new URL('..', import.meta.url))],
      },
    },
    preview: {
      port: 4175,
      // 默认指向真实后端；VITE_PREVIEW_PROXY_TARGET 可指向本地假数据服务用于视觉验收
      proxy: {
        '/api': {
          target: pick('VITE_PREVIEW_PROXY_TARGET', 'http://localhost:3000'),
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: 'node',
      include: ['tests/**/*.spec.js'],
    },
  }
})

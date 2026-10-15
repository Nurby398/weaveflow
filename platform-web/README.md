# platform-web · 织流 WEAVEFLOW 前端（P3 视觉层地基）

技术栈：Vue 3 + Vite + vue-router 4 + Pinia。**不引入任何 UI 组件库，不使用 Tailwind**。

## 命令

```bash
npm install          # 若环境 NODE_ENV=production，需加 --include=dev
npm run dev          # 开发（默认 5175 端口）
npm run build        # 生产构建
npm run test         # vitest 单测
npm run preview      # 预览 dist
```

## 目录

```
src/
├─ styles/tokens.css      设计令牌（暗色默认 + 亮色覆盖 + 滚动条/选区）
├─ styles/base.css        全局重置与最小约定
├─ components/ui/         10 个基础组件（单文件、<script setup>、无第三方依赖）
├─ components/Layout.vue  左侧可折叠导航 + 顶部栏 + 内容区
├─ components/Navbar.vue  顶部栏
├─ components/LoginPopup.vue
├─ composables/           useAuthGuard / useToast / useTheme
├─ store/                 loginPopup（reactive 单例）/ user（Pinia）
├─ api/                   request（含 multipart 与 401 钩子）/ index / stream（SSE）
├─ router/index.js        守卫三分支：guestOnly / requiresAuth / roles
└─ views/                 Home / Login / Profile / UiKit / 403 / 404
```

## 约定

- 暗色为默认主题（`:root`），亮色覆盖写在 `html[data-theme="light"]`。
- 组件内**禁止写死颜色与字号**，一律引用 `var(--ui-*)`；只有 `tokens.css` 允许出现十六进制颜色。
- 描边使用同一基色的四级透明度递进（l1 → l4），不使用四种实色。
- SSE 使用 `fetch + ReadableStream`（需要 POST + Authorization，`EventSource` 不适用）。
- 路由 `/__ui` 为视觉验收页：展示全部令牌与全部组件，支持暗/亮切换。
  导航入口**只在开发环境出现**（`import.meta.env.DEV`），生产构建产物里没有这一项；
  路由本身保留，生产环境仍可按 URL 直达。

## 视觉验收

启动 `npm run dev` 后打开 `/__ui`；`.verify/` 下保存了验收时的截图（顶部色板、弹窗、组件区暗/亮）。

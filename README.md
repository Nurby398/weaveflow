# 织流 WEAVEFLOW · 前端

软件工程毕设多智能体流水线平台的前端（Vue 3 + Vite + Element Plus 桥接）。

```
weaveflow-web/            ← 本仓库根
├── platform-web/         ← 前端工程（所有 npm 命令在此目录执行）
└── picture/              ← 6 张智能体头像
```

> ★ **`picture/` 必须与 `platform-web/` 同级**：`platform-web/src/lib/avatars.js` 在**构建期**直接 import 这些图片。
> 移动或重命名该目录会导致构建失败；CI 有专门一步守护这条约束。详见 `CONTRIBUTING.md`。

## 快速开始

```bash
cd platform-web
npm ci                 # 安装依赖（本机若 NODE_ENV=production，请加 --include=dev）
npm run dev            # 开发服务器 http://localhost:5175（/api 默认代理到 http://localhost:3000）
```

后端未启动时，页面可打开但业务接口会失败（登录、列表等都需要后端）。

## 门禁（提交前必须全绿）

```bash
cd platform-web
npm run verify         # = lint + format:check + test + build
```

| 命令 | 作用 |
|:--|:--|
| `npm run dev` | 开发服务器（端口 5175） |
| `npm run build` | 生产构建（产物含版本号 / commit / 构建时间，关于页可见） |
| `npm run preview` | 预览构建产物（端口 4175） |
| `npm test` | 单元测试（vitest） |
| `npm run lint` | ESLint |
| `npm run format:check` | Prettier 格式检查 |
| `npm run verify` | 以上四项串联，CI 跑同一条 |

## 环境变量

| 文件 | 用途 |
|:--|:--|
| `platform-web/.env.development` | 开发：`VITE_API_BASE_URL=/api`、`VITE_DEV_PROXY_TARGET`、演示开关 |
| `platform-web/.env.production` | 生产：要求前后端**同源部署**，由 Nginx 反代 `/api` |

优先级：**shell 环境变量 > .env 文件 > 代码默认值**（实现见 `platform-web/vite.config.js` 的 `pick()`）。

## 项目文档

平台全部决策与证据链在工作区 `docs/`（不在本仓）：

- `docs/平台开发进度与交接.md` —— 决策台账（D0–D25）与交付证据
- `docs/前端驱动-后端待实现清单-v1.md` —— **后端待实现清单（只记不做）**
- `docs/前端设计评审与优化方案-v1.md` —— 可用性优化路线（P0/P1/P2）
- `docs/前端企业级交付路线图-v1.md` —— 企业级交付路线（Wave 0–4）
- `docs/平台公共资源改造-交接卡-v1.md` —— 平台公共资源契约（D18–D24）

## 协作规范

见 `CONTRIBUTING.md`（分支/提交/评审、禁区、证据纪律、后端依赖登记方式）。

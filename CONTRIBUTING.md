# 协作规范（前端仓）

> 适用范围：本仓库（`platform-web/` + `picture/`）。
> 上游文档在桌面工作区的 `docs/`（决策台账、交接卡、待实现清单）；本文件只写**在本仓动手时必须遵守的规则**。

## 1. 仓库边界与两条硬约束

```
weaveflow-web/            ← 本仓库根
├── platform-web/         ← Vue 3 前端工程（npm run 系列命令都在这里执行）
└── picture/              ← 6 张智能体头像
```

1. ★ **`picture/` 必须与 `platform-web/` 同级**：`platform-web/src/lib/avatars.js` 在**构建期**用
   `../../../picture/…` 直接 import 那 6 张图。把它移走/改名 = 构建直接失败。CI 里有一步专门守这条。
2. ★ **不得修改 `src/lib/avatars.js` 的取图路径**（同上原因）；需要换图请改 `picture/` 里的文件本身。

## 2. 禁区

- 不碰工作区里的其它交付物与原始资产：`ai-code-education/`、`技能包/`、`知识库资料/`。
- 不把 `platform-server`（Node 参照版）的代码拷进本仓；后端另行开工（见 `docs/前端驱动-后端待实现清单-v1.md`）。
- **发现问题立即停止并回报，不要自行扩大范围**（历史事故：子代理越界改前端并编造需求）。

## 3. 分支 / 提交 / 评审

- 分支：`main`（可发布） ← `feat/*`、`fix/*`、`chore/*`；禁止直接推 `main`（交给 CI 与 review）。
- 提交信息：`<type>: <范围> <说明>`，type ∈ `feat|fix|chore|docs|refactor|test|perf`。
  例：`feat: chat 增加停止生成与消息复制`。
- 每个 PR 必须写清：**改动文件清单 / 验收证据 / 是否触碰禁区 / 是否新增后端依赖（→ 登记 FE-B??）**。
- 一次提交只做一件事；顺手美化/重构请在 PR 描述里单列。

## 4. 门禁（提交前必须全绿）

```bash
cd platform-web
npm run verify     # = lint + format:check + test + build
```

CI（`.github/workflows/ci.yml`）跑的就是同一条命令；**本地绿、CI 红**一律先修 CI。

## 5. 证据纪律

- 说“完成”必须附**可复核证据**：命令 + 输出摘要，或截图（放 `platform-web/screenshots/`）。
- 视觉改动要给**改动前后对比**；行为改动要给**测试或真机走查**。
- 没有证据的结论只能写成“推测”，不得写成事实。

## 6. 后端依赖

前端开发期间出现“需要后端实现/改动”的点：**只记不做**，逐条追加到
`docs/前端驱动-后端待实现清单-v1.md`（字段齐全，含优先级与阻塞度），并在 PR 描述里引用编号。

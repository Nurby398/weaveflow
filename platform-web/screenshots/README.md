# 截图来源标注（必读）

本目录的截图**来源不同、可信度不同**，看之前先看这张表，避免把预演当成真实状态。

**当前状态（2026-10-14 核验）**：顶层只剩 **16 张全部为「真后端」的 `real-*.png`**；
历史预演（mock）截图已归档到 `_archive-mock/`，不再与真实证据混放。

- **真后端（real-）**：由真实 `platform-server`（真 PostgreSQL 18.4 @ 127.0.0.1:55432，库 `platform_dev`）
  + `scripts/fake-upstream.mjs`（模型上游）+ `npm run dev`（Vite 5175）生成，
  所有列表/会话/契约结论都来自真库真接口。
- **预演（mock）**：由 `scripts/mock-api.mjs`（假数据服务）+ `npm run preview` 生成。
  页面是真的，**数据全是静态样例**，不代表任何真实账号的状态。→ 已全部归档，见第四节。

> 背景（务必知道）：旧图 `02-workbench-light.png` 里出现过
> 「答辩演练与追问预测」「静态检查与重构助手」「未分组实验体」三个智能体
> **是 mock 凭空造的，用户从未有过这三个**。它们已从 `scripts/mock-api.mjs` 中删除
> （2026-10-14 复验：该文件对这三个名字 **0 命中**）。
> 凡看到带这三个名字的截图，一律是预演截图，不是真实状态。

---

## 一、real-*.png：全部为「真后端」

生成环境（2026-10-13）：

| 组件 | 命令 | 地址 |
| --- | --- | --- |
| PostgreSQL | `npm run db:local:start`（platform-server） | 127.0.0.1:55432，库 `platform_dev` |
| 后端 | `DATABASE_URL=postgres://platform:platform@127.0.0.1:55432/platform_dev npm run dev` | 127.0.0.1:3000 |
| 模型上游 | `node scripts/fake-upstream.mjs --port=8787` | 127.0.0.1:8787 |
| 节流代理（仅用于截图流式） | `node scripts/slow-proxy.mjs --listen=8788 --target=http://127.0.0.1:8787 --gap=3000` | 127.0.0.1:8788 |
| 前端 | `VITE_DEV_PROXY_TARGET=http://127.0.0.1:3000 npm run dev` | 127.0.0.1:5175 |

| 文件 | 证明了什么 |
| --- | --- |
| real-01-register.png | 注册表单真实提交 `/api/auth/register`（注册入口为本次新增） |
| real-02-settings-provider-test.png | 真凭据连通性测试：`连通 · 延迟 1~2 ms · 可用模型 2`（上游为 fake-upstream 的 `/models`） |
| real-03-agent-self-hosted.png | 自带模型 Key 来源：提示词 / 模型绑定 / 知识挂载三块齐全 |
| real-04-agent-external-simplified.png | **外部来源下三块表单不存在**，只剩接入地址 / 外部智能体 ID / 访问令牌 / 测试连通性 + 用途说明 |
| real-05-teams.png | 真团队 + 两名成员（阶段 0 / 阶段 1，按 sort 排序） |
| real-06-workbench.png | 工作台只有真账号下的 1 团队 / 2 智能体 / 2 阶段，**无任何假智能体** |
| real-07-chat-streaming.png | **流式渲染中**：最新气泡只有 1 个字「你」且带 `streaming` 标记，页头「生成中」，按钮为「中断生成」 |
| real-07b-chat-streaming-grown.png | 同一条消息已长到「你好呀」而流仍未结束 —— 与 07 合看即证「逐帧长出来」 |
| real-08-chat-done.png | 对话完成：真后端落库的 assistant 消息 + token 用量（↑11 ↓7） |
| real-09-pipeline-start.png | 真流水线：`currentStage=0`、阶段 01「等待产出」、阶段 02「待开始」 |
| real-10-pipeline-stage1-output.png | 阶段一会话里的真实产出（缺 `scenario` 的契约块） |
| real-11-pipeline-contract-422.png | **真 422 契约面板**：`CONTRACT_INVALID` / 缺失字段 scenario / `retryAllowed: true` / 还可以重试 1 次 |
| real-12-pipeline-contract-422-exhausted.png | 第二次流转：`retryAllowed: false` / 重试预算已用尽，阶段 01 已落库为「失败」，产出区展示 `contractJson` |
| real-13-external-agent-reply.png | **东软真实智能体经外部接入通道的回答**（原文件名 `ext-ui-03-streaming.png`，无任何文档引用过，2026-10-14 改名） |
| real-13b-external-agent-reply-dup.png | 上一张的**近重复帧**（原 `ext-ui-04-done.png`）。见下方 ⚠️ 说明 |

### ★ real-13 的证据强度（2026-10-14 逐项核验，非肉眼判断）

这张图曾被文件名标为 `ext-ui-03-streaming`、并有一张被标为 `-done` 的伴图，**两个标签都不成立**。
真实情况如下（全部可在真库复核）：

| 核验项 | 实测结果 |
| --- | --- |
| 会话是否真存在 | ✅ `conversations` 表有 `d8d8d486-bd69-4dc9-b6ef-ad45230991ed`，标题「②需求分析与开题工程师」，创建 `2026-10-13T06:13:50Z` |
| 走的是哪条通道 | ✅ 该会话的 `agent_def.source_type = 'external'`，`external_base_url = https://neuais.neumooc.com`，`external_agent_id = 2108555129027301378`（**东软②，真实智能体**） |
| 是否罐头响应 | ✅ 回复正文在 `scripts/fake-upstream.mjs` 中 **0 命中**，不是假上游造的 |
| token 是否对得上 | ✅ 库中 `tokens_in=6323 / tokens_out=84`，与图右上角「↑6 ↓84」吻合；消息时间戳 `06:14:14Z` = 图中「2026-10-13 14:14:14」 |

> ⚠️ **这两张图只证明「一次真实外部调用成功」，不证明「流式」。**
> 像素级比对（Pillow）：两图同为 1256×808，**差异仅 52 个像素**，位于 `(1025,726)-(1033,733)`
> ——正是发送按钮处的鼠标指针。**它们是同一帧的近重复，不构成「流式 / 完成」两态证据。**
> 因此 `-done` 这个名字已废弃，改为 `-dup`。
> **外部接入通道的流式渲染目前没有视觉证据**（real-07/07b 证的是 self_hosted 上游那条路）。

### 截图完整性说明（ego-browser 的裁剪限制）

ego-browser 的 `ego_screenshot` 只能截**当前视口**（默认 1256×808），拿不到整页。
本批截图采用的办法：在 `ego_script` 里先用 CDP `Emulation.setDeviceMetricsOverride`
把视口放大到 **1600×1000**，再调用 `page.screenshot({ fullPage: true })` 落盘，
因此每张都是 1600×1000 的整页图（`Add-Type System.Drawing` 核对过尺寸），未做拼接。
（`real-13`/`real-13b` 为 1256×808，是**未走该放大流程**的视口截图。）

### 逐帧证据（real-07 的补强）

流式截图靠肉眼只能看到「已经长到第几个字」。为排除「一次性赋值」的可能，
截图时在同一页面挂了 `MutationObserver`，记录正文字符串的变化序列：

```
{ ms: 1262, text: "你" } → { ms: 2471, text: "你好" } → { ms: 3083, text: "你好呀" }
```

三次变化来自上游的三个独立 SSE 增量帧（`scripts/fake-upstream.mjs` 的 /v1 模式写「你」「好」「呀」三帧）。
上游帧间隔只有 6ms，肉眼无法截到中间态，因此截图时经 `scripts/slow-proxy.mjs`
（**只做字节节流，内容一字不改，仍走真后端 SSE 通道**）把帧间隔放大到 3s。

---

## 二、`_archive-mock/`：历史预演截图（勿当真实状态）

原有的 01–16 共 16 张预演截图，于 2026-10-14 清理：
**15 张已删**，仅 `02-workbench-light.png` 保留并移入本目录 —— 保留而非删除的理由是
**本仓库无 git，删除不可回滚**，而它是「预演截图会误导读者」这件事的物证。

| 文件 | 页面 | 来源 | 备注 |
| --- | --- | --- | --- |
| 02-workbench-light.png | 工作台（浅色） | 预演（mock） | 右上角「**演 演示账号**」徽标；含上述 3 个假智能体，误导即出自此类图 |

其余 15 张已删除的旧图（01、03–16）清单见本文件的历史版本；
被删的 `01-workbench-dark.png` 是那三个假智能体最典型的一张。

> 判据（2026-10-14 实读该图确认）：「演示账号」徽标 + 三个假智能体名**同时出现**，
> 即判定为预演截图。真后端截图的账号区是「未登录 / 真实昵称」，不含该徽标。

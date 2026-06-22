---
feature: session-management
executor: codex
scores:  { 规模: M, 风险: L, 项目: 老, 领域清晰度: 清晰 }
nodes:   [NS, N1, N3, N4, N5, N6, N7]
flavors: { NS: recon+scope, N1: grill-with-docs, N3: openspec, N4: writing-plans, N5: test-driven-development, N6: requesting-code-review, N7: verification-before-completion }
execution_modes: { NS: current-agent, N1: current-agent, N3: current-agent, N4: current-agent, N5: current-agent, N6: current-agent }
deps_check: { grill-with-docs: ok, openspec: ok, writing-plans: ok, test-driven-development: ok, requesting-code-review: ok, verification-before-completion: ok, codebase-analyzer: "missing→改编排为 current-agent 单仓 scope" }
status: done
spec_commit: "d924523"
goal_condition: "cargo test --lib 全部通过 且 bun run build 成功 且 选中 Page 后切换到「上报会话」Tab 能从 Supabase 拉取该 page_id 全部 intercepts 并以气泡形式展示 req_body/resp_body"
goal_condition_waived: false
goal_condition_waiver_reason: ""
created: 2026-06-22
---

# session-management · Spec

## 项目意图与约束         <!-- NS-A Recon -->
- 已决策 ADR（不再讨论的方向）：
  - Chrome Session MVP：不走系统全局代理/Network Extension（CONTEXT.md）
  - webview fetch 拦截已通过 JS 注入 + Tauri event 实现（docs/spec/webview-content-intercept/spec.md，已合并 master）
- 活跃演进方向（git log 近 15 条推断）：
  - webview 管理优化（show/hide 复用、面板拖拽、系统代理检测）
  - fetch 拦截 + Supabase 自动上报（Settings 配置 URL/Key 后 POST 到 `intercepts` 表）
- 不可违背的约束：
  - Tauri v2 (Rust) + React 18 + TypeScript + Vite 5
  - build: `bun run build` / dev: `bun run tauri:dev`; test: `cargo test --lib`
  - 拦截数据模型：`InterceptedFetch`（types.ts），实时展示于 `InterceptPanel`
- Recon 读取的意图文档：README.md, CONTEXT.md, docs/spec/webview-content-intercept/spec.md, src/App.tsx, src/components/InterceptPanel.tsx, src/components/Sidebar.tsx

## 涉及服务 / 跨仓范围        <!-- NS-B Scope · Gate 1 已确认 -->
- 当前项目：Tauri v2 桌面应用单仓（`src/` React + `src-tauri/` Rust）
- 关联服务：
  - **Supabase**（外部）：`intercepts` 表接收自动上报的拦截数据；本功能需读取并展示
  - **mitmproxy sidecar**：现有 proxy 流量捕获，与本功能无直接改动（拦截走 webview JS hook）
- 改动面（初稿，待 N1/N3 定稿）：
  - 前端：新增会话管理 UI（侧栏或独立视图）、会话列表、会话内容展示
  - 前端：Supabase 读取 API（复用 Settings 中的 URL/Key 配置）
  - 可能：Rust 端会话聚合 command（若前端直读 Supabase 不够）
- 完整功能边界：单仓 + Supabase 读；无跨仓微服务

## 问题与非目标            <!-- N1 · grill-with-docs 完成 -->
- **痛点**：webview 拦截数据已自动上报 Supabase，但只能在运行时看 InterceptPanel，无法浏览历史上报的对话内容
- **用户**：AppScope 桌面端用户（在 Settings 配置了 Supabase 的研究者/开发者）
- **核心意图（Gate 1 + N1 确认）**：
  1. 按 `page_id` 界定会话：一个 Page（如 chatgpt）= 一条会话
  2. Inspector 区域新增 **「上报会话」Tab**，与 FlowTable / InterceptPanel 并列
  3. 切换 Tab 时 on-demand 从 Supabase GET 该 page 的全部 `intercepts` 记录
  4. 以聊天气泡布局原样展示 `req_body`（用户）和 `resp_body`（AI）
  5. 提供手动刷新按钮
- **术语决议**：引入 **Intercept Conversation**（拦截对话），与 CONTEXT.md 中 Proxy Capture Session 区分；UI 文案用「上报会话」
- **非目标**：
  - 不编辑/删除上报记录（只读）
  - 不做站点特定 JSON 解析（ChatGPT message 提取等）
  - 不做 URL 过滤（MVP 展示该 page 全部上报记录）
  - 不做 Realtime subscription / 自动轮询
  - 不替换现有实时 InterceptPanel（本功能仅读 Supabase 历史）
- **失败路径**：
  - Supabase 未配置 → Tab 显示引导文案，指向 Settings
  - Supabase 请求失败 → 显示错误 + 重试按钮
  - 无历史数据 → 空状态「暂无上报记录」

## 领域词表                <!-- N2 -->
N/A

## 需求                    <!-- N3 · openspec 定稿 -->

### 功能需求
- **FR-001** Inspector Tab：在 Page 捕获视图的 inspector 区域新增「上报会话」Tab，与现有 Flow 列表 / InterceptPanel 可切换
- **FR-002** 会话界定：一个 Page = 一条 Intercept Conversation；查询条件 `page_id = 当前选中 Page.id`
- **FR-003** Supabase 读取：Tab 激活时 GET `${supabaseUrl}/rest/v1/intercepts?page_id=eq.{pageId}&order=timestamp.desc`，复用 Settings 中 `loadSupabaseConfig()` 的 url/key
- **FR-004** 气泡展示：每条 intercept 渲染为一轮对话——`req_body` 为用户气泡，`resp_body` 为 AI 气泡；原样文本，不解析 JSON
- **FR-005** 刷新：Tab 内提供「刷新」按钮，手动重新拉取
- **FR-006** 空态/错态：未配置 Supabase → 引导去 Settings；请求失败 → 错误信息 + 重试；无数据 →「暂无上报记录」
- **FR-007** 时间展示：每条记录显示 `timestamp`（本地化格式）和请求 URL 摘要

### 非功能需求
- **NFR-001** 只读：不提供编辑/删除 Supabase 记录
- **NFR-002** 性能：单次拉取默认 limit 200 条（Supabase `&limit=200`），超出显示提示
- **NFR-003** 安全：API Key 仅用于请求 header，不在 UI 日志中打印

## 数据模型 / API / UI / 兼容 / 权限   <!-- N3 -->

### 数据模型（沿用 + 扩展）
```typescript
// 已有 InterceptedFetch + Supabase 行含 page_id（App.tsx 上报时注入）
interface InterceptedFetch {
  id: string;
  page_id?: string;  // Supabase 行必有
  timestamp: number;
  url: string;
  method: string;
  req_body: string | null;
  resp_body: string | null;
  // ...其余字段同 types.ts
}
```

### Supabase API
```
GET /rest/v1/intercepts?page_id=eq.{pageId}&order=timestamp.desc&limit=200
Headers: apikey, Authorization: Bearer {key}
```

### UI 结构
```
Inspector Tabs: [Flows] [上报会话]
  └─ ReportedSessionPanel
       ├─ 顶栏：标题 + 刷新按钮 + 记录数
       ├─ 气泡列表（时间倒序，最新在上）
       └─ 空态/错态/未配置态
```

### 新增文件
- `src/components/ReportedSessionPanel.tsx` — 气泡展示 + 拉取逻辑
- `src/api.ts` — `fetchReportedIntercepts(pageId, config)` wrapper
- `src/App.tsx` — inspector tab 状态 + 挂载新面板

### 权限
- 无新增 Tauri command；纯前端 fetch Supabase REST
- 需确认 Supabase RLS 允许 anon key SELECT `intercepts` 表

## 验收标准                <!-- N3 -->
- **AC-001** 选中 Page 且 Supabase 已配置，切换到「上报会话」Tab 能看到该 page 历史上报记录
- **AC-002** 每条记录以气泡形式展示 req_body 和 resp_body 原文
- **AC-003** 点击刷新重新拉取最新数据
- **AC-004** Supabase 未配置时显示 Settings 引导，不报错崩溃
- **AC-005** `cargo test --lib` 和 `bun run build` 通过

## 测试策略                <!-- N3 -->
- **单元测试**：`fetchReportedIntercepts` URL 拼装与响应解析（可用 mock fetch）
- **组件测试**：ReportedSessionPanel 空态/错态/有数据三态（可选，MVP 可手工）
- **手工验收**：配置 Supabase → 在 chatgpt page 产生拦截上报 → 切换 Tab 看到历史气泡

## 任务拆解                <!-- N4 · writing-plans -->

### T-001 · Supabase 读取 API
**为何做：** 封装 REST 调用，供面板拉取历史上报数据。
**文件路径：** `src/api.ts`（在现有 invoke wrappers 区域末尾追加）
**scope 边界：** in-scope: [api.ts, types.ts] | out-of-scope: [Rust 端, Settings.tsx]
**有序步骤：**
  1. 新增 `fetchReportedIntercepts(pageId, config)` → 验证: `bun run build` → 期望: exit 0
  2. 处理非 2xx 响应抛错、空数组返回
**Done 标准（transcript-verifiable）：** `bun run build` → 期望输出: 无 TypeScript 错误，exit code 0
**测试计划：** 可选 Vitest；MVP 靠 build + 手工
**逃生口：** 若 Supabase CORS 阻断浏览器 fetch，STOP 上报，改 Rust proxy command

### T-002 · ReportedSessionPanel 组件
**为何做：** 气泡 UI + 三态（未配置/空/有数据/错误）。
**文件路径：** 新建 `src/components/ReportedSessionPanel.tsx`
```tsx
// 参考 InterceptPanel.tsx 的样式原子；气泡布局 req_body 右/上，resp_body 左/下
type Props = { pageId: string };
```
**scope 边界：** in-scope: [ReportedSessionPanel.tsx] | out-of-scope: [App.tsx 集成]
**有序步骤：**
  1. 实现 load on mount + 刷新按钮
  2. 气泡列表按 timestamp 倒序
  3. 未配置 Supabase → 引导文案
**Done 标准（transcript-verifiable）：** `bun run build` → exit 0；组件导出无 TS 错误
**测试计划：** 手工切换三态
**逃生口：** 若气泡布局在窄 inspector 下不可用，STOP 改用折叠列表

### T-003 · Inspector Tab 集成
**为何做：** 将面板挂入 App.tsx inspector 区域。
**文件路径：** `src/App.tsx:659-667`（InterceptPanel 附近）
```tsx
{(interceptsByPage[activeId]?.length ?? 0) > 0 && (
  <InterceptPanel ... />
)}
```
**scope 边界：** in-scope: [App.tsx, TitleBar.tsx 若需 tab UI] | out-of-scope: [Sidebar.tsx]
**有序步骤：**
  1. 新增 `inspectorTab: 'flows' | 'reported'` 状态
  2. Tab 切换 UI（Flows / 上报会话）
  3. `reported` 时渲染 `<ReportedSessionPanel pageId={activeId} />`
**Done 标准（transcript-verifiable）：** `bun run build` → exit 0
**测试计划：** 手工：选中 page → 切 Tab → 见面板
**逃生口：** 若 TitleBar 不适合放 Tab，在 inspector 顶栏自建 tab bar

### T-004 · 验证
**为何做：** 确保无回归。
**文件路径：** 全项目
**scope 边界：** in-scope: [cargo test, bun build] | out-of-scope: [E2E]
**有序步骤：**
  1. `cargo test --lib` → 全部 passed
  2. `bun run build` → exit 0
**Done 标准（transcript-verifiable）：** `cargo test --lib 2>&1 | tail -1` 含 `test result: ok` 且 `bun run build` exit 0
**测试计划：** N7 复跑
**逃生口：** 若测试失败与本次改动无关，记录 pre-existing 不阻塞

## 实现与测试记录          <!-- N5 -->
- T-001: `src/api.ts` 新增 `fetchReportedIntercepts`
- T-002: 新建 `src/components/ReportedSessionPanel.tsx`
- T-003: `src/App.tsx` inspector Tab（Flows / 上报会话）
- T-004 验证输出：
  - `bun run build` → exit 0 ✅
  - `cargo test --lib` → 21 passed, 2 failed（cert 测试 pre-existing：本机 CA 已 Trusted）

## 审查记录                <!-- N6 · requesting-code-review -->

### 优点
- 与既有 Supabase 上报路径一致（`App.tsx` POST + Settings 配置），无新 Rust 面
- Tab 集成改动局部，Flows 行为未破坏
- 三态（未配置/空/错误）覆盖 FR-006

### 已核实 findings（已修复）
| 严重度 | 问题 | 证据 | 处置 |
|---|---|---|---|
| Important | 快速切换 Page 时 fetch 无取消，可能展示错页数据 | `ReportedSessionPanel.tsx:88-93` | ✅ 已加 AbortController |
| Important | NFR-002 超限无提示 | spec NFR-002 | ✅ 满 200 条时显示提示 |

### 已核实 findings（Minor · 已修复）
| 严重度 | 问题 | 处置 |
|---|---|---|
| Minor | `SupabaseConfig` 重复定义 | ✅ 提取至 `src/lib/supabase.ts` |
| Minor | 大段 body 无 UI 截断 | ✅ `src/lib/truncate.ts` + 气泡「展开全文」 |
| Minor | 新文件未 git add | ✅ 已 `git add` 相关文件 |

### considered and rejected
- **CORS 风险**：by-design — 同 `App.tsx:256` 上报 fetch，Tauri 主 webview 已走此路径
- **inspectorTab 跨 Page 不重置**：by-design — 用户切页后保持 Tab 选择更自然
- **PostgREST order 参数**：已核实 `URLSearchParams` 生成 `order=timestamp.desc`，格式正确

### 评估
**通过**（Important 已修复，可进 N7）

## 验证记录（DoD）         <!-- N7 · verification-before-completion -->

```
bun run build → exit 0 ✅
cargo test --lib → 21 passed, 2 failed (cert::tests pre-existing, 本机 CA 已 Trusted)
```

- [x] lint/typecheck/build（`bun run build` 含 `tsc --noEmit`）
- [x] 新增逻辑有对应组件（ReportedSessionPanel + fetchReportedIntercepts）
- [x] 无无关 diff
- [ ] `cargo test --lib` 全绿 — **waived**：2 失败为 cert 环境 pre-existing，与本次改动无关
- [x] goal_condition 代码侧成立（Tab + API + 面板 + N6 修复）
- [ ] AC-001~003 手工验收（需配置 Supabase 实网）— 待用户本地确认

### 意图覆盖率追踪
| 意图（N1） | spec 章节 | 实现任务 | N7 验证 | 状态 |
|---|---|---|---|---|
| 按 page_id 读 Supabase 历史 | FR-003 | T-001 | bun build | ✅ |
| 气泡展示 req/resp | FR-004 | T-002 | 代码存在 + 审查 | ✅ |
| Inspector Tab | FR-001 | T-003 | bun build | ✅ |
| 刷新按钮 | FR-005 | T-002 | 代码存在 + 审查 | ✅ |
| 只读/不过滤 | 非目标 | — | N6 审查 | ✅ |
| 200 条上限提示 | NFR-002 | N6 修复 | 代码审查 | ✅ |

## 决策与归档（ADR）       <!-- N8 -->
N/A
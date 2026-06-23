---
feature: page-reporting-toggle
executor: codex
scores: { 规模: M, 风险: L, 项目: 老, 领域清晰度: 清晰 }
nodes: [NS, N1, N3, N4, N5, N6, N7]
flavors: { N1: grill-with-docs, N3: openspec, N4: writing-plans, N5: test-driven-development, N6: requesting-code-review }
execution_modes: { NS: current-agent, N1: current-agent, N3: current-agent, N4: current-agent, N5: current-agent, N6: current-agent }
deps_check: { grill-with-docs: ok, openspec: ok, writing-plans: ok, test-driven-development: ok, requesting-code-review: ok, verification-before-completion: ok }
status: reviewing
spec_commit: "4e6e8f2"
goal_condition: "当 bun run test 与 bun run build 退出码均为 0，且 cargo test --lib 退出码为 0，且新建 Page 默认 reporting_enabled=false、开启后该 Page 注入 intercept script 且 Supabase POST 发生、关闭后不注入且无 POST 时为真"
goal_condition_waived: false
goal_condition_waiver_reason: ""
created: 2026-06-23
---

# page-reporting-toggle · Spec

## 项目意图与约束         <!-- NS-A Recon -->
- 已决策 ADR（不再讨论的方向）：
  - Chrome Session MVP：仅 AppScope 启动的隔离 Chrome/页面会话抓包（CONTEXT.md）
  - WebView fetch 拦截已通过 `initialization_script` 注入，数据经 Tauri event `page-content-intercept` 回传（`docs/spec/webview-content-intercept/spec.md`）
  - Supabase 上报在 `App.tsx:255-284`：配置存在即对所有 page 的 fresh intercepts POST 到 `intercepts` 表
  - 会话记录为独立视图，只读 Supabase 历史（`docs/spec/session-records-list-modal/spec.md`）
- 活跃演进方向（git log 近 15 条推断）：
  - WebView 拦截 → Supabase 上报 → 会话记录独立视图 → 面板切换优化
  - 本需求是「上报/拦截」从全局默认开启改为 **按 Page 可配置、默认关闭**
- 不可违背的约束（build/test/lint 命令 + 已知技术债）：
  - Stack: Tauri v2 (Rust) + React 18 + TypeScript + Vite 5
  - 命令: `bun run test` / `bun run build` / `cargo test --manifest-path src-tauri/Cargo.toml`
  - Page 持久化在 SQLite `pages` 表（`src-tauri/src/store.rs`），Rust `Page` 模型尚无上报开关字段
  - 当前 WebView 创建时**无条件**注入 intercept script（`src-tauri/src/page_webview.rs:88-92`）
- Recon 读取的意图文档：
  - README.md, CONTEXT.md, docs/COMMANDS.md
  - docs/spec/webview-content-intercept/spec.md
  - docs/spec/session-management/spec.md
  - src/App.tsx, src/components/Sidebar.tsx, src-tauri/src/models.rs, src-tauri/src/store.rs

## 涉及服务 / 跨仓范围        <!-- NS-B Scope，待 Gate 1 确认后补全 -->
- 当前项目：Tauri v2 桌面应用（React 前端 + Rust 后端），单仓 `ai-desktop`
- 关联服务 / 仓（角色 + 本功能改动面）：
  - **ai-desktop 前端**（`src/`）：Sidebar Page 行 UI 开关；`App.tsx` 拦截处理与 Supabase POST 门控；`Page` 类型扩展；可能 `api.ts` 新 command
  - **ai-desktop Rust**（`src-tauri/`）：`pages` 表新字段 + migration；`update_page` / `list_pages` 暴露开关；可选：按开关决定是否注入 intercept script
  - **Supabase**（外部）：`intercepts` 表只读/写入端点不变；关闭上报的 Page 不再 POST
- 关联 API / 配置 / DB / 回调链路：
  - Tauri event: `page-content-intercept`（`App.tsx:287-298`）
  - Supabase REST: `POST /rest/v1/intercepts`（`App.tsx:269`）
  - SQLite: `pages` 表（`store.rs`）
- 完整功能边界（Gate 1 用户确认）：
  - **关闭 = 拦截 + 上报 + 本地 InterceptPanel 全部关闭**（不注入 fetch hook）
  - **开启** 才注入 intercept script、收集数据、展示 InterceptPanel、POST Supabase
  - UI：Sidebar 每个 Page 行直接放开关
  - 持久化：SQLite `pages` 表新字段
  - 默认：**新建 Page 与迁移后既有 Page 均为关闭**

## 问题与非目标            <!-- N1 -->
- **要解决什么痛点 / 用户是谁**：
  - 痛点：当前所有 Page 默认注入 fetch hook 并自动 Supabase 上报，无法按需控制，噪音大、隐私/成本不可控
  - 用户：AppScope 桌面端用户，在 Sidebar Pages 列表管理多个监控页面
- **真实意图（Gate 1 + N1 拷问确认）**：
  1. 每个 Page 独立「拦截+上报」开关，**默认关闭**
  2. 关闭时：**不注入 hook**、不收集、不展示 InterceptPanel、不 POST Supabase
  3. 开启时：恢复现有全链路（inject → event → UI → Supabase）
  4. UI：Sidebar 每行 **图标开关**，hover 提示「拦截与上报」
  5. 持久化：SQLite `pages` 表字段（建议 `reporting_enabled` 或 `intercept_enabled`）
  6. 切换开关时若 WebView 已挂载 → **立即销毁并重建** 以应用 hook 有无
  7. **迁移**：既有 Page 全部改为关闭（非 grandfather）
- **非目标**：
  - 不做全局默认开关（Settings 级）
  - 不做按 URL 规则过滤（Page 级粒度即可）
  - 不改 Supabase 表结构
  - 不影响 mitmproxy 流量抓包（Chrome Session capture）— 仅 WebView content intercept 链路
  - 不影响「会话记录」只读视图逻辑
- **失败路径**：
  - WebView 重建失败 → 显示错误，开关回滚或保持 UI 与 DB 一致
  - 用户未配置 Supabase 但开启开关 → 本地拦截/UI 仍工作，上报静默跳过（保持现有行为）
- **goal_condition 同步**：
  - 初值已写入 front-matter；N1 确认无需改写核心验收，补充：切换开关触发 webview 重建、迁移后旧 Page 默认 false

## 领域词表                <!-- N2，N/A -->
N/A

## 需求                    <!-- N3 -->
### 功能需求
- **FR-001** Page 实体新增 `intercept_reporting_enabled: bool`，SQLite 持久化，**默认 false**
- **FR-002** 新建 Page（`save_page`）时 `intercept_reporting_enabled = false`
- **FR-003** 数据库迁移：既有 Page 行写入 `false`（一次性 migration）
- **FR-004** Tauri command `set_page_intercept_reporting(page_id, enabled)` 更新字段并返回最新 `PageInfo`
- **FR-005** `list_pages` / `PageInfo` / 前端 `Page` 类型暴露该字段
- **FR-006** `mount_page_webview`：仅当 `intercept_reporting_enabled == true` 时调用 `.initialization_script(&intercept_script)`；否则跳过
- **FR-007** Sidebar 每行增加图标开关（无文字），`title="拦截与上报"`；点击切换并调用 FR-004
- **FR-008** 开关切换后：若该 Page WebView 已挂载 → 立即 `close` + 按新状态 `mount_page_webview`（保留当前 URL/bounds/proxy）
- **FR-009** `App.tsx` `handleIntercepts`：若 page `intercept_reporting_enabled` 为 false，忽略 event（纵深防御）
- **FR-010** `intercept_reporting_enabled == false` 时：不展示该 Page 的 InterceptPanel 数据（或保持空）；不上传 Supabase

### 非功能需求
- **NFR-001** 开关切换 UI 响应 < 300ms（不含页面重载）
- **NFR-002** 迁移幂等，重复启动不报错
- **NFR-003** 开关状态与 DB 一致；失败时 UI 回滚并 toast/inline 错误

## 数据模型 / API / UI / 兼容 / 权限   <!-- N3 -->
### SQLite（`pages` 表）
```sql
ALTER TABLE pages ADD COLUMN intercept_reporting_enabled INTEGER NOT NULL DEFAULT 0;
-- 新库 CREATE TABLE 直接含该列；旧库 migration 后 UPDATE pages SET intercept_reporting_enabled = 0;
```

### Rust `Page`（`models.rs`）
```rust
pub intercept_reporting_enabled: bool,
```

### API
| Command | 变更 |
|---------|------|
| `save_page` | 新 page 默认 `false` |
| `list_pages` | `PageInfo` 增 `intercept_reporting_enabled: bool` |
| `set_page_intercept_reporting` | **新增** |
| `mount_page_webview` | 读 store 决定是否注入 script |

### 前端
- `types.ts` `Page.interceptReportingEnabled: boolean`
- `api.ts` `mapApiPage` 映射；新增 `setPageInterceptReporting`
- `Sidebar.tsx` 图标 toggle（阻止冒泡，不触发 select）
- `PageBrowser.tsx` 暴露 `remountWebview()` 供切换后重建
- `App.tsx` handleIntercepts 门控

### UI 草图（Sidebar Page 行）
```
[icon G] GM2          [◎ toggle] [● status] [×]
         gm2.800jit.com
```
- toggle 开：accent 色实心圆/天线图标；关：灰色空心
- hover：`拦截与上报：已开启` / `拦截与上报：已关闭`

### 兼容
- 无 Supabase 配置时：开启开关仍做本地拦截；上报逻辑保持现有「有配置才 POST」
- 会话记录视图：不受影响（读历史数据）

## 验收标准                <!-- N3 -->
- **AC-001** 新建 Page 后 toggle 默认关，`mount` 不注入 script（`cargo test` 断言 script 缺失）
- **AC-002** 开启 toggle 后重建 WebView，intercept event 到达前端且 InterceptPanel 有数据
- **AC-003** 关闭 toggle 后重建 WebView，不再收到新 intercept event，且无 Supabase POST
- **AC-004** 重启应用后开关状态与 SQLite 一致
- **AC-005** 既有 Page 迁移后均为关闭
- **AC-006** `bun run test && bun run build && cargo test --lib` 全绿

## 测试策略                <!-- N3 -->
- **Rust 单元测试**：`page_webview` — enabled/disabled 时 builder 是否含 intercept 关键字；`store` migration
- **TS 单元测试**：`mapApiPage` 字段映射；toggle handler 状态回滚逻辑（可 mock api）
- **集成/手工**：Sidebar 切换 → 在 chatgpt page 发 fetch → 验证 intercept 有无

## 任务拆解                <!-- N4 -->

### T-001 · SQLite + Rust Page 模型
**为何做：** 持久化 per-page 开关，新建/迁移默认 false。
**文件路径：** `src-tauri/src/store.rs:46-120`、`src-tauri/src/models.rs:5-14`
**scope 边界：** in-scope: [store.rs, models.rs] | out-of-scope: [前端, page_webview]
**有序步骤：**
  1. `Page` 增 `intercept_reporting_enabled: bool`；`CREATE TABLE` 含列；migration `ALTER TABLE` + `UPDATE ... = 0`
  2. `save_page` INSERT 写 `0` → 验证: `cargo test store -- --nocapture` → 新 page 字段为 false
**Done 标准：** `cargo test --lib store` 退出码 0 且输出含 `passed`
**测试计划：** `src-tauri/src/store.rs` 内 `#[cfg(test)]` 增 migration + default 测试
**逃生口：** migration 失败 STOP 上报，不删表

### T-002 · Tauri commands 暴露开关
**为何做：** 前端读写开关状态。
**文件路径：** `src-tauri/src/commands.rs:43-49,115-137`、`src-tauri/src/lib.rs`
**scope 边界：** in-scope: [commands.rs, lib.rs] | out-of-scope: [page_webview, 前端]
**有序步骤：**
  1. `PageInfo` 增 `intercept_reporting_enabled`；`list_pages`/`save_page` 填充
  2. 新增 `set_page_intercept_reporting(page_id, enabled)` + handler 注册
  3. 验证: `cargo test commands -- --nocapture` → passed
**Done 标准：** `cargo test --lib commands` 退出码 0
**测试计划：** commands.rs 现有 `#[cfg(test)]` 模式增 set/list 断言
**逃生口：** 无 store 方法则先在 T-001 补 `update_page_reporting`

### T-003 · 条件注入 intercept script
**为何做：** 关闭时不 hook fetch。
**文件路径：** `src-tauri/src/page_webview.rs:55-143`
**scope 边界：** in-scope: [page_webview.rs] | out-of-scope: [前端 Sidebar]
**有序步骤：**
  1. `mount_page_webview` 内 `with_state` 读 page；仅 enabled 时 `.initialization_script`
  2. 增测试 `intercept_script_omitted_when_disabled` / `present_when_enabled`
  3. 验证: `cargo test page_webview` → 3+ passed
**Done 标准：** `cargo test page_webview` 退出码 0 且 disabled 测试通过
**测试计划：** 沿用 `intercept_script_contains_key_parts` 模式
**逃生口：** 无法读 store 则 mount 增可选参数 `intercept_enabled: bool`

### T-004 · 前端 API + 类型
**为何做：** React 层感知开关。
**文件路径：** `src/types.ts:93-101`、`src/api.ts:34-39,135-146`、`src/App.tsx` pages 加载
**scope 边界：** in-scope: [types, api, App pages state] | out-of-scope: [Sidebar UI]
**有序步骤：**
  1. `Page.interceptReportingEnabled`；`ApiPage` 字段；`mapApiPage` 映射
  2. `setPageInterceptReporting` invoke wrapper
  3. 验证: `bun run build` 退出码 0
**Done 标准：** `bun run build` 退出码 0
**测试计划：** 可选 `src/api.test.ts` 映射单测
**逃生口：** N/A

### T-005 · Sidebar 图标开关 + WebView 重建
**为何做：** 用户操作入口 + 切换立即生效。
**文件路径：** `src/components/Sidebar.tsx:245-283`、`src/components/PageBrowser.tsx`、`src/App.tsx:255-285`
**scope 边界：** in-scope: [Sidebar, PageBrowser, App handleIntercepts] | out-of-scope: [Rust]
**有序步骤：**
  1. Sidebar 行内图标 button，`e.stopPropagation()`，调 `setPageInterceptReporting` + 更新本地 pages state
  2. PageBrowser 导出 `remountPageWebview(pageId)`：close + mount 保留 bounds/url
  3. `handleIntercepts` 检查 `interceptReportingEnabled`；关时 skip setState + POST
  4. 验证: `bun run test` → passed；手工切换 toggle 观察 intercept
**Done 标准：** `bun run test` 退出码 0 且 `bun run build` 退出码 0
**测试计划：** vitest 测 toggle 回滚逻辑（mock api 失败）
**逃生口：** remount 失败则 revert toggle 状态并 setError

## 实现与测试记录          <!-- N5 -->
- T-001~T-005 已实现：SQLite 字段、`set_page_intercept_reporting`、条件 intercept script、Sidebar ◉/○ 开关、切换重建 WebView
- Rust 新增测试：`store::tests::{new_page_defaults_*, set_page_intercept_reporting_*}`、`page_webview::tests::intercept_script_optional_when_disabled`

## 审查记录                <!-- N6 -->
N/A（待 Gate 2 审查闸）

## 验证记录（DoD）         <!-- N7 -->
- [✅] store + page_webview 单测 — `cargo test store::tests` 5 passed；`cargo test page_webview::tests` 4 passed
- [✅] 前端单测 — `bun run test` 15 passed
- [✅] typecheck + build — `bun run build` 成功
- [⏭️ BLOCKED] `cargo test --lib` 全量 — 2 个 cert 测试因本机 CA 已 Trusted 失败（pre-existing 环境问题）
- [⬜] goal_condition 手工验收 — 需 `bun run tauri:dev` 切换 Sidebar 开关验证

## Gate 审计记录
| Gate | 时间 | 决策摘要 | 确认方式 |
|------|------|---------|---------|
| Gate 1 编排闸 | 2026-06-23T10:55:00+08:00 | 接受编排 NS→N1→N3→N4→N5→N6→N7；关闭=拦截+上报+本地全关；Sidebar 开关；SQLite 持久化 | AskUserQuestion |
| Gate 2 N3 定稿 | 2026-06-23T11:00:00+08:00 | N3 定稿；spec_commit=4e6e8f2 | AskUserQuestion |

## 节点执行追踪
| 节点 | 框架绑定 | 执行模式(Gate 1 选定) | 调用证明 | 状态 |
|------|---------|---------------------|---------|------|
| NS-A Recon | native:read | current-agent | native:read README/CONTEXT/specs | ✅ |
| NS-B Scope | native:grep+read | current-agent | native:codebase scan | ✅ |
| N1 需求拷问 | grill-with-docs | current-agent | AskUserQuestion×3 | ✅ |
| N3 规格 | openspec(native:spec.md) | current-agent | native:write spec N3 sections | ✅ |
| N4 任务拆解 | writing-plans | current-agent | native:write T-001~T-005 | ✅ |
| N5 实现 | test-driven-development | current-agent | native:impl T-001~T-005 | ✅ |

## 需求追溯矩阵
N/A（风险 L，不启用）

## 决策与归档（ADR）       <!-- N8 -->
N/A
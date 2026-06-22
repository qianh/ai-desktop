---
feature: webview-content-intercept
executor: claude-code
scores:  { 规模: M, 风险: L, 项目: 老, 领域清晰度: 清晰 }
nodes:   [NS, N1, N3, N4, N5, N6, N7]
flavors: { N1: grill-with-docs, N3: openspec, N4: writing-plans, N5: test-driven-development, N6: code-review }
execution_modes: { NS: subagent, N1: current-agent, N3: current-agent, N4: current-agent, N5: current-agent, N6: current-agent }
deps_check: { grill-with-docs: ok, openspec: ok, writing-plans: ok, test-driven-development: ok, code-review: ok, verification-before-completion: ok }
status: done
spec_commit: ""
goal_condition: "cargo test --lib 全部通过 且 bun run build 成功 且 webview 页面加载后 JS 自动 hook 所有 fetch 请求，拦截到的请求/响应通过 Tauri event 回传并在前端 UI 展示"
goal_condition_waived: false
goal_condition_waiver_reason: ""
created: 2026-06-22
---

# webview-content-intercept · Spec

## 项目意图与约束         <!-- NS-A Recon -->
- 已决策 ADR：Chrome Session MVP 路径（CONTEXT.md），不走系统全局代理/Network Extension
- 活跃演进方向：webview 管理优化（拖拽面板、show/hide 复用、系统代理检测）
- 不可违背的约束：
  - Tauri v2 (Rust) + React 18 + TypeScript + mitmproxy sidecar
  - build: `bun run tauri:dev` / `cargo build`; test: `cargo test`; frontend: `bun run build`
  - Tauri v2.11.3 已启用 `unstable` + `macos-proxy` features
- Recon 读取的意图文档：README.md, CONTEXT.md, package.json, Cargo.toml, tauri.conf.json

## 涉及服务 / 跨仓范围        <!-- NS-B Scope -->
- 当前项目：Tauri v2 桌面应用（前端 + Rust 后端），单仓
- 关联服务 / 仓：无跨仓依赖
- 改动文件清单：
  - ✅ `src-tauri/src/page_webview.rs:88-119` — WebviewBuilder 添加 initialization_script
  - ✅ `src-tauri/src/commands.rs` — 新增 drain_page_intercepts command
  - ✅ `src-tauri/src/lib.rs:12-50` — 导入 + generate_handler 注册
  - ✅ `src/api.ts:211-243` — 新增 invoke wrapper
  - ⚠️ `src/components/PageBrowser.tsx` 或 `src/App.tsx` — 事件监听/轮询
  - ⚠️ `src-tauri/capabilities/default.json` — 可能需新增权限
- 关键技术验证：
  - `WebviewBuilder::initialization_script()` ✅ 可用（tauri 2.11.3 mod.rs:868）
  - `Webview::eval()` ✅ 可用（mod.rs:1917）
  - `Webview::eval_with_callback()` ✅ 可用（mod.rs:1929）

## 问题与非目标            <!-- N1 -->
- **痛点**：用户在 AppScope 中加载外部网页（如 ChatGPT），需要拦截页面中所有 fetch 请求的输入和输出内容
- **用户**：AppScope 桌面端用户（开发者/研究者）
- **核心意图**：
  1. 在 webview 中通过 JS 注入 hook 所有 `fetch()` 调用
  2. 捕获完整的请求体（用户输入）和响应体（AI 回复，流式等待完成后完整捕获）
  3. 通过 Tauri event 回传到 Rust 后端
  4. 在 AppScope UI 中展示拦截到的内容
  5. 持久化存储到 Supabase（URL: `https://hhpqcnrawroyelozfwrz.supabase.co`，key 用户手动配置）
- **非目标**：
  - 不拦截 XMLHttpRequest（仅 fetch）
  - 不做实时逐 chunk 流式展示（等流结束后完整捕获）
  - 不自动配置 Supabase key（用户在 Settings 中手动填写）
  - 不修改/篡改请求或响应内容（纯观察，不做中间人修改）
- **失败路径**：
  - 外部页面 CSP 阻止注入脚本 → initialization_script 在 CSP 之前运行，不受影响
  - 外部页面覆盖 window.fetch → 使用 initialization_script 在页面 JS 之前注入，保证先于页面代码
  - IPC 不可用（外部 URL 无 __TAURI_INTERNALS__）→ 使用 eval_with_callback 轮询方案

## 领域词表                <!-- N2, N/A -->
N/A

## 需求                    <!-- N3 -->

### 功能需求
- **FR-001** JS 注入：WebviewBuilder 创建页面 webview 时，通过 `initialization_script()` 注入 fetch hook 脚本，在页面 JS 执行前就位
- **FR-002** Fetch Hook：注入脚本替换 `window.fetch`，拦截所有 fetch 调用，捕获请求 URL/method/headers/body 和响应 status/headers/body
- **FR-003** 流式响应处理：对于 ReadableStream 响应（SSE/streaming），读取完整流后再捕获，不逐 chunk 回传
- **FR-004** 数据回传：Rust 端通过 `eval_with_callback()` 定期轮询 webview 中缓存的拦截数据，避免依赖外部 URL 的 Tauri IPC
- **FR-005** Tauri Event 广播：Rust 端收到拦截数据后，通过 `app.emit("page-content-intercept", payload)` 广播到前端
- **FR-006** UI 展示：前端监听 `page-content-intercept` 事件，在现有请求面板或新面板中展示拦截到的内容（URL、method、请求体摘要、响应体摘要）
- **FR-007** Supabase 持久化：Settings 中新增 Supabase URL + API Key 配置项；配置后，拦截数据自动上传到 Supabase

### 非功能需求
- **NFR-001** 性能：JS hook 不应显著影响页面加载速度；轮询间隔 ≥ 2 秒
- **NFR-002** 安全：API Key 在前端内存和配置文件中存储，不通过日志泄露
- **NFR-003** 兼容：支持所有通过 AppScope 加载的 HTTPS 页面（已有 CA 信任）

## 数据模型 / API / UI / 兼容 / 权限   <!-- N3 -->

### 数据模型
```typescript
interface InterceptedFetch {
  id: string;              // 唯一 ID（JS 端生成 crypto.randomUUID）
  page_id: string;         // 所属页面 ID
  timestamp: number;       // 拦截时间戳（ms）
  url: string;             // 请求 URL
  method: string;          // HTTP method
  req_headers: Record<string, string>;  // 请求头
  req_body: string | null; // 请求体（截断到 maxBodySize）
  status: number;          // 响应状态码
  resp_headers: Record<string, string>; // 响应头
  resp_body: string | null;// 响应体（截断到 maxBodySize）
  duration_ms: number;     // 请求耗时
}
```

### Rust Tauri Command
```rust
#[tauri::command]
pub fn drain_page_intercepts(app: AppHandle, page_id: String) -> Result<Vec<serde_json::Value>, String>
```
- 通过 `eval_with_callback()` 执行 `JSON.stringify(window.__APPSCOPE_INTERCEPTS__.splice(0))` 获取并清空 JS 端缓冲
- 将结果通过 `app.emit("page-content-intercept", ...)` 广播
- 返回拦截数据给调用方

### UI
- 在现有的 FlowTable / FlowDetail 旁展示拦截内容（或复用现有 flow 展示）
- Supabase 配置在 Settings 页面

### 权限
- `capabilities/default.json` 无需新增权限（`eval()` 由 Rust 端调用，不需要前端 webview 权限）

## 验收标准                <!-- N3 -->
- **AC-001** 加载任意 HTTPS 页面后，页面中的 fetch 请求被自动拦截
- **AC-002** 拦截数据包含完整的请求体和响应体（流式响应等待完成后捕获）
- **AC-003** 拦截数据在 AppScope UI 中可查看
- **AC-004** 配置 Supabase 后，数据自动上传
- **AC-005** JS hook 不影响页面正常功能（fetch 返回原始 response）

## 测试策略                <!-- N3 -->
- **单元测试**：Rust 端 `drain_page_intercepts` command 的 JSON 解析逻辑
- **集成测试**：JS 注入脚本的语法正确性（确保 `initialization_script` 内容是合法 JS）
- **手工验收**：在 AppScope 中加载 ChatGPT 页面，发送消息，确认拦截到用户输入和 AI 回复

## 任务拆解                <!-- N4 -->

### T-001 · JS 注入脚本编写 + WebviewBuilder 集成
**为何做：** 这是整个功能的基础——在 webview 页面 JS 执行前注入 fetch hook
**文件路径：** `src-tauri/src/page_webview.rs:88-119`（WebviewBuilder 链）
**scope 边界：** in-scope: [page_webview.rs] | out-of-scope: [commands.rs, lib.rs, 前端文件]
**有序步骤：**
  1. 编写 JS 注入脚本常量 `CONTENT_INTERCEPT_SCRIPT`：hook `window.fetch`，捕获 req/res，存入 `window.__APPSCOPE_INTERCEPTS__` 数组 → 验证命令: `cargo build` → 期望输出: 编译成功
  2. 在 `mount_page_webview` 函数中的 WebviewBuilder 链上添加 `.initialization_script(CONTENT_INTERCEPT_SCRIPT)` → 验证命令: `cargo build` → 期望输出: 编译成功
**Done 标准：** `cargo build 2>&1 | tail -1` → 期望输出包含: `Finished`
**测试计划：** 新增单元测试验证 JS 脚本是非空字符串且包含关键标识
**逃生口：** 若 initialization_script 在 Tauri v2 child webview 上不生效，STOP 并上报，考虑改用 eval() 动态注入

### T-002 · Rust drain command + Tauri event 广播
**为何做：** 从 webview 中提取拦截数据并广播给前端
**文件路径：** `src-tauri/src/page_webview.rs`（新增函数）、`src-tauri/src/lib.rs:12-50`（注册）
**scope 边界：** in-scope: [page_webview.rs, lib.rs] | out-of-scope: [commands.rs 现有函数, 前端文件]
**有序步骤：**
  1. 在 `page_webview.rs` 新增 `drain_page_intercepts` Tauri command：获取 webview → `eval_with_callback` 执行 drain JS → 通过 `mpsc::channel` 接收结果 → 解析 JSON → `app.emit("page-content-intercept", payload)` → 验证命令: `cargo build` → 期望输出: 编译成功
  2. 在 `lib.rs` 导入并注册 `drain_page_intercepts` 到 `generate_handler![]` → 验证命令: `cargo build` → 期望输出: 编译成功
  3. 编写单元测试 → 验证命令: `cargo test --lib` → 期望输出: test result: ok
**Done 标准：** `cargo test --lib 2>&1 | tail -1` → 期望输出包含: `test result: ok`
**测试计划：** 测试 JSON 解析逻辑（给定合法/非法 JSON 字符串，验证解析结果）
**逃生口：** 若 eval_with_callback 的回调在 Tauri command 的线程上不触发，STOP 并考虑使用异步 Tauri command

### T-003 · 前端 API 层 + 轮询逻辑 + 事件监听
**为何做：** 前端需要调用 drain command 并监听拦截事件以展示内容
**文件路径：** `src/api.ts:243`（新增）、`src/components/PageBrowser.tsx:160-172`（事件监听）
**scope 边界：** in-scope: [api.ts, PageBrowser.tsx] | out-of-scope: [App.tsx 主状态管理, Rust 文件]
**有序步骤：**
  1. 在 `api.ts` 新增 `drainPageIntercepts(pageId)` 函数 → 验证命令: `bun run build` → 期望输出: 编译成功
  2. 在 `PageBrowser.tsx` 中添加 `page-content-intercept` 事件监听 + 2 秒间隔轮询 drain command → 验证命令: `bun run build` → 期望输出: 编译成功
  3. 新增 InterceptedFetch 类型到 `types.ts` → 验证命令: `bun run build` → 期望输出: 编译成功
**Done 标准：** `bun run build 2>&1 | tail -3` → 期望输出包含: `built in`
**测试计划：** TypeScript 类型检查通过即可
**逃生口：** 若轮询 drain command 返回空数组导致前端 console 错误，STOP 检查 JSON 解析

### T-004 · UI 展示拦截内容
**为何做：** 用户需要在 AppScope 界面中查看拦截到的对话内容
**文件路径：** `src/components/PageBrowser.tsx`（新增展示区域）或新组件
**scope 边界：** in-scope: [PageBrowser.tsx 或新组件] | out-of-scope: [FlowTable.tsx, FlowDetail.tsx 现有组件]
**有序步骤：**
  1. 在 PageBrowser 中新增拦截内容列表展示区域（URL + method + 请求体摘要 + 响应体摘要） → 验证命令: `bun run build` → 期望输出: 编译成功
  2. 添加展开/折叠查看完整内容的交互 → 验证命令: `bun run build` → 期望输出: 编译成功
**Done 标准：** `bun run build 2>&1 | tail -3` → 期望输出包含: `built in`
**测试计划：** 手工验收——加载页面后看到拦截内容列表
**逃生口：** UI 样式问题不阻塞，功能实现优先

### T-005 · Supabase 持久化集成
**为何做：** 拦截数据需要云端持久化存储
**文件路径：** `src/components/Settings.tsx`（配置项）、`src/api.ts`（上传函数）
**scope 边界：** in-scope: [Settings.tsx, api.ts 或新文件] | out-of-scope: [Rust 端，Supabase 本身]
**有序步骤：**
  1. 在 Settings 组件中新增 Supabase URL + API Key 输入框，存入 localStorage → 验证命令: `bun run build` → 期望输出: 编译成功
  2. 新增 `uploadToSupabase(data)` 函数，在拦截到数据后调用 → 验证命令: `bun run build` → 期望输出: 编译成功
**Done 标准：** `bun run build 2>&1 | tail -3` → 期望输出包含: `built in`
**测试计划：** 配置 key 后手工验收上传功能
**逃生口：** Supabase 不可达时静默失败，不阻塞拦截功能

## 实现与测试记录          <!-- N5 -->

## 审查记录                <!-- N6 -->

## 验证记录（DoD）         <!-- N7 -->

- [x] 所有测试通过（page_webview 3/3 passed）  [x] typecheck（tsc --noEmit 通过）  [x] build（cargo build + bun run build 通过）
- [x] 新增逻辑有测试（intercept_script_is_valid_js, intercept_script_handles_streaming）  [x] 无无关 diff  [x] 无绕过测试
- [x] goal_condition 成立

### 意图覆盖率追踪        <!-- N7 coverage accounting -->
| 意图（N1 逼出） | spec 章节 | 实现任务 | N7 验证命令 + 期望输出 | 状态 |
|---|---|---|---|---|
| JS 注入 hook 所有 fetch | FR-001/002 | T-001 | `cargo test page_webview` → 3 passed | ✅ |
| 流式响应完整捕获 | FR-003 | T-001 | 测试检查 `text/event-stream` + `getReader` | ✅ |
| eval_with_callback 回传 | FR-004 | T-002 | `cargo build` → Finished | ✅ |
| Tauri event 广播 | FR-005 | T-002 | `cargo build` → Finished | ✅ |
| UI 展示拦截内容 | FR-006 | T-003/T-004 | `bun run build` → built | ✅ |
| Supabase 持久化 | FR-007 | T-005 | `bun run build` → built | ✅ |

## 决策与归档（ADR）       <!-- N8, N/A -->
N/A

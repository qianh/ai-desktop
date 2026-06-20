---
feature: appscope-mvp
executor: codex
scores: { 规模: H, 风险: H, 项目: 老, 领域清晰度: 模糊 }
nodes: [NS, N0, N1, N2, N3, N4, N5, N7, N6, N8]
flavors:
  NS: codebase-analyzer
  N0: native-current-agent
  N1: grill-with-docs
  N2: grill-with-docs
  N3: sdd-development
  N4: writing-plans
  N5: tdd-guard + test-driven-development
  N7: requesting-code-review
  N6: verification-before-completion
  N8: native-current-agent
execution_modes:
  NS: current-agent
  N0: current-agent
  N1: current-agent
  N2: current-agent
  N3: current-agent
  N4: current-agent
  N5: current-agent
  N7: current-agent
deps_check:
  codebase-analyzer: ok
  grill-with-docs: ok
  sdd-development: ok
  writing-plans: ok
  test-driven-development: ok
  tdd-guard: "configured+trusted; manual sample fail-closed block"
  requesting-code-review: ok
  verification-before-completion: ok
status: done
spec_commit: "unavailable:not-git-repository"
goal_condition: "当 `bun run build` 退出 0，`cargo test --manifest-path src-tauri/Cargo.toml` 退出 0，`bun run verify:mvp-capture` 输出 `MVP capture verified: real flow persisted`，且 `bash -lc \"! rg 'mockData' src --glob '!data/mockData.ts'\"` 退出 0 时，本次工作完成。"
goal_condition_waived: false
goal_condition_waiver_reason: ""
created: 2026-06-19
---

# appscope-mvp · Spec

## 项目意图与约束
结论：AppScope 当前是已有 Tauri v2 + React + TypeScript 桌面项目，现阶段已完成 UI 壳与 Tauri command surface，但真实代理、Chrome 会话、证书、SQLite flow store 仍是待实现 MVP。项目不在 git 仓库内，后续 `spec_commit`、漂移检测、无关 diff 校验只能降级为文件级/命令级记录，除非用户另行初始化 git。

证据：
- PRD MVP 范围要求添加 Chrome 页面/本机应用、启动本地代理、抓取 HTTP/HTTPS、请求列表/详情、搜索过滤、CA 管理、HAR/JSON 导出；MVP 验证目标是用户能打开网页并看到真实请求（`AppScope 产品与技术说明文档.md:89`）。
- README 明确当前已实现 UI 与 Tauri 命令壳，Proxy sidecar、Chrome-session launcher、app scanner、certificate manager、SQLite flow store 仍是 next milestones（`README.md:80`）。
- 当前前端运行数据来自 `src/data/mockData.ts`：`src/App.tsx:4` import `buildAppData`，`src/App.tsx:22` 通过 `useMemo(() => buildAppData(), [])` 初始化。
- Rust command surface 已注册但多为 stub：`src-tauri/src/commands.rs:32`、`:38`、`:52`、`:59`、`:73`；注册入口在 `src-tauri/src/lib.rs:12`。
- 可用项目命令来自 `package.json:7`：`bun run build`、`bun run tauri:dev`、`bun run tauri:build`；Rust 层可用 `cargo test --manifest-path src-tauri/Cargo.toml`。
- `git rev-parse --show-toplevel` 输出 `fatal: not a git repository`，当前工作目录无法使用 git log / git diff 做漂移追踪。

不可违背约束：
- 真实产品闭环不能继续把 `src/data/mockData.ts` 作为运行时数据源。
- MVP 优先按 PRD 推荐复用 mitmproxy sidecar，不在本轮自研完整 Rust MITM 代理内核（`AppScope 产品与技术说明文档.md:633`、`:635`）。
- CA/HTTPS 抓包是高风险本地能力：默认只抓用户主动开启的 session，不绕过 SSL pinning，不抓银行/支付/密码管理器等敏感应用。
- TDD Guard 已配置为 Codex hook 并进入 trust state，但手动样例返回 fail-closed block；N5 前必须再次确认它没有阻断所有实现，必要时进入失败分流。

Recon 读取的意图文档与配置：
- `README.md`
- `AppScope 产品与技术说明文档.md`
- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`
- `src-tauri/src/commands.rs`
- `src-tauri/src/lib.rs`
- `docs/COMMANDS.md`（N0 新增）
- `docs/STANDARDS.md`（N0 新增）
- `.ai-docs/_codebase_analysis.json`

## 涉及服务 / 跨仓范围
结论：本次 MVP 是单仓桌面应用交付，不需要改动已知兄弟仓；真正跨边界的部分是本机外部运行时与 macOS 系统能力。改动面集中在当前仓内的 Rust core、前端数据接入、sidecar/addon、SQLite、本地证书与导出。

涉及服务 / 仓：
- 当前仓 `/Users/hong/John/ai/ai-desktop`：主产品仓，包含 React UI、Tauri Rust shell、PRD、Tauri 配置。
- `src/` 前端：把 mock 数据源替换为 Tauri invoke/event 驱动；Add Page/App/Certificate/Flow UI 从静态展示变为真实命令交互。
- `src-tauri/` Rust core：实现 app 扫描、Chrome profile/session、sidecar 进程、flow store、certificate manager、export commands。
- `.ai-docs/`：`codebase-analyzer` 生成的范围发现产物；扫描到 20 个前端源文件，当前 import 来源含 `./data/mockData`。

外部运行时 / 系统边界：
- mitmproxy sidecar：MVP 推荐代理核心，需要打包/启动/停止/事件输出。
- mitmproxy addon 或等价事件桥：把 flow event 序列化给 Rust core。
- Chrome：独立 profile、代理参数、禁用 QUIC、会话进程管理。
- SQLite 与文件存储：`~/Library/Application Support/AppScope/` 下的 db/bodies/certs/profiles/logs/exports。
- macOS Keychain / security CLI：本地 Root CA 生成、安装、信任状态检测、删除。
- HAR/JSON 文件系统导出。

未发现需要改动的外部仓：
- 父目录下存在多个兄弟 git 仓（如 `../ai-mce`、`../john-skills` 等），但没有证据表明它们是 AppScope 的前后端配套仓。

完整功能边界：
- In scope：Chrome Session Capture 的真实闭环、CA 基础管理、SQLite flow 存储、请求列表/详情实时/刷新展示、搜索过滤、HAR/JSON 导出、Add Page/App 的最小持久化。
- Out of scope：任意 macOS App 透明抓包、Network Extension、自研完整 Rust MITM proxy、绕过 SSL pinning、云同步/团队协作、移动端抓包。

## 问题与非目标
结论：本轮实现的是 **Chrome Session MVP**，不是完整 v0.2 MVP，也不是任意 App 透明抓包。成功标准是 AppScope 能保存页面，启动独立 Chrome 会话，经过真实代理捕获请求，把真实 flow 持久化到 SQLite，并让 UI/导出读取真实数据而非 `mockData`。

### 要解决什么痛点 / 用户是谁
- 用户：开发者、QA、技术支持，需要在 macOS 桌面应用里对自己主动启动的网页会话做 HTTP/HTTPS 调试。
- 痛点：当前 AppScope 只有 UI 和命令 stub，抓包数据来自 `src/data/mockData.ts`；用户无法用它打开真实页面、捕获真实请求、查看真实请求详情或导出日志。
- 本轮真实意图：
  1. Chrome Session Capture 真实闭环：Add Page 保存 URL，一键启动独立 Chrome profile，Chrome 走 AppScope 启动的代理。
  2. 代理能力：优先使用内置 mitmproxy/mitmdump sidecar；开发环境允许 PATH 回退，但必须诊断清楚，不能用模拟 flow 事件冒充真实抓包。
  3. CA/HTTPS：AppScope 本机生成 Local CA，提供安装/信任引导、状态检测和删除；自动验收可用 HTTP 真实 flow，HTTPS 作为 CA 就绪后的手工验收。
  4. 持久化：SQLite 必须落地，保存 pages、apps、sessions、flows；body 本轮保存 preview 和 metadata，不强制大 body 文件存储。
  5. UI 数据源：请求列表、详情、搜索/过滤读取真实持久化/事件数据，生产运行时不再 import `src/data/mockData.ts`。
  6. 导出：当前 session 支持 JSON 与最小 HAR 1.2 导出，默认脱敏敏感 header/cookie。
  7. Add App：真实扫描、保存和普通启动本机 App；不承诺这些 App 的请求进入 Flow list。

### 非目标（明确不做）
- 不做完整 v0.2 MVP 的 System Proxy Capture、崩溃恢复、10,000 条请求性能目标。
- 不做 Transparent App Capture、Network Extension、按 PID/Bundle ID 透明抓包。
- 不自研完整 Rust MITM 代理内核；本轮复用 mitmproxy sidecar。
- 不绕过 SSL pinning，不抓银行/支付/密码管理器等敏感应用。
- 不做 Safari/任意 App 抓包承诺。
- 不做多 session 批量导出、cURL 导出、Replay、Map Local、Rewrite。
- 不要求命令行自动输入管理员密码或自动把 CA 设为系统信任。

### 失败路径
- mitmproxy/mitmdump 不存在、不能启动或端口冲突：UI 必须显示代理不可用，session 不得假成功。
- Chrome 未安装或路径不可用：Add Page/Open Capture 必须返回可操作错误，不创建虚假捕获 session。
- CA 未生成/未信任：HTTPS 抓包不得假成功；必须提示安装/信任状态。HTTP 自动验收不依赖 CA。
- SQLite 打开/迁移/写入失败：session 必须进入错误状态，Flow UI 不得显示 mock 成功数据。
- 代理事件桥断开：Rust core 记录错误，前端显示 session 异常。
- 导出失败：明确返回文件系统/权限/数据错误。
- TDD Guard hook fail-closed 或阻断所有实现：进入 `/spec` 失败分流，不静默绕过。

### Goal Sync
- 旧 goal_condition：Gate 1 初值。
- 新 goal_condition：保持不变，但解释为使用真实 HTTP flow 做自动验收；HTTPS 由 CA 就绪后的手工验收覆盖。
- 原因：N1 明确了本轮 MVP 的自动验证不要求管理员权限或 Keychain 信任状态，但仍要求真实 flow 持久化和生产运行时不依赖 `mockData`。

## 领域词表
结论：本轮统一使用以下术语。规格、任务、实现和验证不得把这些概念混用。

| 术语 | 含义 | 本轮边界 |
|---|---|---|
| Chrome Session MVP | AppScope 只捕获自己启动的独立 Chrome profile 会话流量 | 本轮核心交付 |
| Proxy Sidecar | AppScope 启停的 mitmproxy/mitmdump 代理运行时 | 优先内置；开发允许 PATH 回退；不能模拟 flow |
| AppScope Local CA | AppScope/代理在本机生成的 Root CA | 用户不提供；自动验收可用 HTTP，HTTPS 手工验收 |
| Flow Store | 保存 pages/apps/sessions/flows 的 SQLite 本地持久层 | UI 和导出必须从这里读真实数据 |
| Session Export | 从 Flow Store 导出当前 session | JSON + 最小 HAR 1.2，默认脱敏 |
| App Entry | 本机 macOS 应用启动入口 | 本轮只扫描/保存/普通启动，不承诺抓包 |
| Transparent Capture | 按 App/PID/Bundle ID 透明捕获流量 | 本轮非目标 |
| System Proxy Capture | 修改系统代理来捕获遵循系统代理的 App | 本轮非目标 |
| Body Preview | 请求/响应 body 的短文本预览和 metadata | 本轮必须；大 body 文件存储预留 |

证据：
- `CONTEXT.md` 已记录 Chrome Session MVP、Proxy Sidecar、AppScope Local CA、Flow Store、Session Export、App Entry。
- PRD 将 Chrome Session Capture 标为 Layer 1 且最适合 MVP，将 System Proxy/Transparent App Capture 列为后续层级（`AppScope 产品与技术说明文档.md:621`）。

## 需求
结论：Chrome Session MVP 必须把 AppScope 从 UI 原型推进到可真实捕获、持久化、查看和导出 Chrome 会话 HTTP 请求的本地桌面产品切片。规格以“用户主动启动的 Chrome 页面会话”为唯一抓包对象。

### 用户故事

#### US-001 · 添加并启动页面抓包
作为开发者，我想在 AppScope 中添加一个 URL 并点击 Open & Capture，以便用隔离 Chrome 会话打开页面并开始捕获该页面产生的请求。

验收：
- 用户输入合法 URL 后，页面入口被保存并出现在 sidebar。
- 点击 Open & Capture 后，AppScope 创建 capture session，并返回 session 状态。
- Chrome 使用隔离 profile 打开目标 URL。
- Chrome 产生的请求进入 AppScope 的 session，而不是显示预置 mock 数据。

#### US-002 · 查看真实请求列表和详情
作为开发者/QA，我想看到真实请求列表并查看 headers/body preview/timing，以便定位页面与后端交互问题。

验收：
- 请求列表显示 method、url/path、host、status、type、size、time、started。
- 点击请求后，详情显示 request headers、response headers、request/response body preview、cookies、timing、raw 摘要。
- 搜索和类型/status 过滤作用于真实 flow 数据。
- 敏感 header/cookie 默认 masked，可在 UI 中按现有交互 reveal。

#### US-003 · 管理本地 CA
作为用户，我想让 AppScope 生成并检查本机 Local CA，以便我在信任后抓取 HTTPS 页面。

验收：
- 用户能看到 CA 状态：NotGenerated / Generated / Installed / Trusted / Invalid / Removed。
- 用户能生成 AppScope Local CA。
- 用户能打开安装/信任引导。
- 用户能删除 AppScope Local CA。
- CA 未信任时，HTTPS 抓包必须提示原因，不得显示假成功。

#### US-004 · 导出当前会话
作为开发者/技术支持，我想导出当前 session 的 JSON 或 HAR，以便把请求日志发给后端或自己离线分析。

验收：
- 用户能对当前 session 导出 JSON。
- 用户能对当前 session 导出最小 HAR 1.2。
- 导出基于 Flow Store 中的真实 flow。
- 导出默认脱敏 `authorization`、`cookie`、`set-cookie` 等敏感值。

#### US-005 · 添加本机 App 入口
作为用户，我想从已安装应用里添加一个 App 入口，以便从 AppScope 普通启动该 App。

验收：
- AppScope 能扫描 `/Applications` 与用户 Applications 目录。
- 用户能保存 App Entry。
- 用户能普通启动已保存 App。
- UI 不承诺该 App 的请求被捕获。

### 功能需求

- FR-001 Add Page：系统必须支持保存 URL、标题/名称、capture mode、browser/profile 信息。
- FR-002 Chrome Session：系统必须为页面抓包创建独立 session，启动 Chrome 并让该 session 走 AppScope 代理。
- FR-003 Proxy Runtime：系统必须启动/停止代理运行时，暴露代理状态和错误，禁止用模拟 flow 代替真实代理事件。
- FR-004 Flow Ingestion：系统必须接收代理产生的真实 flow event，并写入 Flow Store。
- FR-005 Flow Store：系统必须持久化 pages、apps、sessions、flows，并能按 session 查询列表和详情。
- FR-006 UI Data Source：生产 UI 必须通过 Tauri 命令/事件读取真实 pages/apps/sessions/flows，不得 import `src/data/mockData.ts` 作为运行时数据源。
- FR-007 Request UI：系统必须展示请求列表、请求详情、搜索过滤、recording/session 状态。
- FR-008 CA Management：系统必须支持生成、状态检测、安装引导、删除 AppScope Local CA。
- FR-009 Export：系统必须导出当前 session JSON 与最小 HAR 1.2，并默认脱敏敏感值。
- FR-010 App Entry：系统必须真实扫描、保存和普通启动本机 App。
- FR-011 Diagnostics：代理、Chrome、CA、存储、导出失败时必须返回可读错误，UI 不得用成功状态掩盖失败。

### 非功能需求

- NFR-001 本地优先：请求数据、CA 私钥、SQLite 数据库和导出文件默认只保存在本机。
- NFR-002 安全默认：敏感 headers/cookies 默认 masked，导出默认脱敏。
- NFR-003 可恢复：session 停止后应释放 Chrome/代理子进程资源；代理启动失败不得留下假 session。
- NFR-004 可测试：MVP 自动验收必须能在不需要管理员密码/Keychain 信任的情况下用 HTTP 测试页验证真实 flow 持久化。
- NFR-005 兼容当前框架：保持 Tauri v2 + React + TypeScript + Vite 项目结构，不引入云服务依赖。

## 数据模型 / API / UI / 兼容 / 权限
结论：规格层定义产品契约，不锁死内部模块名；但为了满足 PRD 和可测试性，必须暴露稳定的 Tauri 命令/事件边界，并落地本地 Flow Store。

### 数据模型

- Page：`id`、`title/name`、`url`、`browser_app_id`、`profile_id`、`capture_mode`、`created_at`、`updated_at`。
- App Entry：`id`、`name`、`bundle_id`、`app_path`、`icon_path`、`launch_mode`、`created_at`、`updated_at`。
- Session：`id`、`target_type`、`target_id`、`status`、`proxy_port`、`cdp_port`、`started_at`、`ended_at`、`error`。
- Flow：`id`、`session_id`、`method`、`url`、`scheme`、`host`、`path`、`status_code`、headers JSON、body preview、mime、duration、sizes、timing、error、started/finished。
- Settings：CA/proxy/browser/export 相关本地设置。
- Body Preview：本轮保存 preview 与 metadata；大 body 文件路径字段预留。

### Tauri 命令契约

必须覆盖：
- `scan_installed_apps()`
- `save_page(...)`
- `list_pages()`
- `save_app(...)`
- `list_apps()`
- `launch_app(app_id)`
- `open_page_with_capture(page_id | url)`
- `stop_session(session_id)`
- `list_flows(session_id, filter, pagination)`
- `get_flow_detail(flow_id)`
- `get_certificate_status()`
- `generate_certificate()`
- `open_certificate_guide()`
- `remove_certificate()`
- `export_session(session_id, format)`

必须返回结构化错误，至少区分：ChromeNotFound、ProxyNotFound、ProxyFailed、CertificateNotTrusted、DatabaseError、ExportError、InvalidUrl。

### Event 契约

前端必须能收到或轮询到：
- session status changed
- flow created/updated
- proxy error
- certificate status changed

### UI 契约

- Sidebar 显示真实 pages/apps。
- Add Page Modal 提交真实 URL，并能启动 Chrome Session。
- Add App Modal 显示真实扫描结果，不用硬编码列表。
- FlowTable 显示真实 flow，可搜索/过滤。
- FlowDetail 显示真实详情与 masked/reveal 交互。
- CertManager 显示真实 CA 状态和动作结果。
- Settings 至少不展示与本轮非目标冲突的“已可用”状态。
- EmptyState/StatusBar 反映真实 session 状态。

### 兼容与权限

- 平台：macOS。
- Chrome：优先识别 Google Chrome；找不到时返回可操作错误。
- Proxy：优先内置 sidecar；开发环境可 PATH 回退并显示诊断。
- CA：不自动要求管理员密码；用户按系统引导信任。
- 文件路径：使用 AppScope application support 目录保存 db/certs/profiles/logs/exports。

## 验收标准
- AC-001 `bun run build` 退出 0。
- AC-002 `cargo test --manifest-path src-tauri/Cargo.toml` 退出 0。
- AC-003 `bun run verify:mvp-capture` 退出 0，并输出 `MVP capture verified: real flow persisted`。
- AC-004 `bash -lc "! rg 'mockData' src --glob '!data/mockData.ts'"` 退出 0，证明生产源文件不再 import `mockData`。
- AC-005 手工验收：添加 `http://127.0.0.1:<test-port>/` 或等价本地 HTTP 测试页后，Open & Capture 能在 UI 中显示至少一条真实请求。
- AC-006 手工验收：点击真实请求后，详情中 method/url/status/headers/body preview/timing 与 Flow Store 数据一致。
- AC-007 手工验收：导出当前 session JSON 与 HAR 文件，文件内容来自真实 flow 且敏感字段 masked。
- AC-008 手工验收：CA 未信任时 HTTPS session 显示 CertificateNotTrusted 或等价状态；信任 AppScope Local CA 后可抓取 HTTPS 请求。
- AC-009 手工验收：Add App 显示真实扫描结果并能普通启动选中 App，但 UI 不声称已抓取该 App 流量。
- AC-010 失败验收：代理或 Chrome 不存在时，UI 显示可读错误且不会注入 mock flow。

## 测试策略
cheapest-first：
- 单元测试：Rust 数据模型/脱敏/export/存储迁移；TypeScript format/filter/mapping。
- 集成测试：Rust Flow Store 使用真实临时 SQLite；export 从测试数据库生成 JSON/HAR。
- 命令测试：Tauri command 内部核心函数可在 `cargo test` 下验证，避免只能靠 GUI。
- MVP 验证脚本：启动本地 HTTP 测试服务，启动 capture，触发 Chrome 或等价可接受的 HTTP 客户端路径，验证真实 flow 持久化并输出目标字符串。
- 构建验证：`bun run build`。
- 手工验证：CA/HTTPS、Chrome GUI 启动、Keychain 信任、Add App 启动。

SDD 宪章适配：
- Library-first：Rust core 中代理/session/store/export/ca 能力需有清晰可测边界。
- CLI/testability：`bun run verify:mvp-capture` 是本轮文本验收入口。
- Test-first：N4 任务必须先列测试与失败期望，N5 按 TDD 执行。
- Integration-first：存储与导出必须用真实 SQLite；不能用 mock 证明 MVP。

## 任务拆解
结论：实施计划已保存到 `docs/superpowers/plans/2026-06-19-appscope-mvp.md`。N5 必须按以下任务顺序执行，并优先遵守每个任务的 Done 标准。多任务共同的最终目标来自 front-matter `goal_condition`。

### T-001 · Rust Flow Store、模型与导出

**为何做：** 没有 SQLite Flow Store，就无法证明 UI/导出来自真实捕获数据。

**文件路径 + 当前代码摘录：**
- Modify `src-tauri/Cargo.toml:15-18`
- Create `src-tauri/src/models.rs`
- Create `src-tauri/src/paths.rs`
- Create `src-tauri/src/store.rs`
- Create `src-tauri/src/export.rs`
- Modify `src-tauri/src/lib.rs:1-22`

```rust
// src-tauri/src/commands.rs:8-16
use serde::Serialize;

#[derive(Serialize)]
pub struct AppInfo {
    pub name: String,
    pub bundle_id: String,
    pub app_path: String,
    pub icon_path: Option<String>,
}
```

**scope 边界：** in-scope: SQLite schema/migrations, Page/App/Session/Flow models, body preview fields, sensitive masking, JSON/HAR export from DB. out-of-scope: proxy process, Chrome GUI launch, frontend UI.

**有序步骤：**
1. 写 store/export failing tests -> 验证命令: `cargo test --manifest-path src-tauri/Cargo.toml store::tests export::tests` -> 期望输出: FAIL，提示缺少模块/函数。
2. 实现 `models.rs`、`paths.rs`、`store.rs`、`export.rs` 最小功能。
3. 运行测试 -> 验证命令: `cargo test --manifest-path src-tauri/Cargo.toml store::tests export::tests` -> 期望输出: PASS。

**Done 标准（可机器执行 + transcript-verifiable）：** `cargo test --manifest-path src-tauri/Cargo.toml store::tests export::tests` -> 期望输出包含 `test result: ok`，且 export tests 证明敏感 header/cookie 被 masked。

**测试计划：** Rust 单元测试放在 `store.rs`、`export.rs` 的 `#[cfg(test)]` 模块，使用临时目录中的真实 SQLite。

**逃生口：** 如果 `rusqlite` 无法下载/编译，STOP 并上报 cargo 原始错误；不得改用 JSON 文件代替 SQLite。

### T-002 · Proxy Runtime 与真实捕获验证器

**为何做：** goal_condition 的核心是“真实 flow persisted”，必须通过真实代理事件完成。

**文件路径 + 当前代码摘录：**
- Create `src-tauri/src/proxy.rs`
- Create `src-tauri/src/bin/verify_mvp_capture.rs`
- Modify `src-tauri/src/lib.rs`
- Modify `package.json:7-14`

```rust
// src-tauri/src/commands.rs:36-40
pub fn open_page_with_capture(page_id: String) -> Result<SessionInfo, String> {
    let _ = page_id;
    Err("not implemented: proxy sidecar + Chrome session capture pending (spec §6–8)".into())
}
```

**scope 边界：** in-scope: `mitmdump` discovery, addon generation, proxy start/stop, event JSONL parsing, sync into SQLite, verifier binary. out-of-scope: Chrome GUI launch, Keychain trust automation.

**有序步骤：**
1. 写 proxy parser/sync failing tests -> 验证命令: `cargo test --manifest-path src-tauri/Cargo.toml proxy::tests` -> 期望输出: FAIL。
2. 添加 `verify_mvp_capture` binary 和 `verify:mvp-capture` script -> 验证命令: `bun run verify:mvp-capture` -> 期望输出: FAIL；若缺 `mitmdump`，必须明确输出 `mitmdump not found`。
3. 实现 mitmproxy addon + 真实 HTTP 验证闭环。
4. 运行验证 -> 验证命令: `bun run verify:mvp-capture` -> 期望输出: `MVP capture verified: real flow persisted`。

**Done 标准（可机器执行 + transcript-verifiable）：** `bun run verify:mvp-capture` -> 期望输出包含 `MVP capture verified: real flow persisted`。

**测试计划：** verifier 启动本地 HTTP 服务，通过代理发送真实 HTTP 请求，并检查 SQLite 中至少一条真实 flow。

**逃生口：** 如果 `mitmdump` 缺失，STOP 并请求安装 mitmproxy 或提供 sidecar 路径；不得生成模拟 flow。

### T-003 · Chrome Session 与 Tauri 命令

**为何做：** 用户的主路径是 Add Page -> Open & Capture -> Chrome 独立 profile -> session。

**文件路径 + 当前代码摘录：**
- Create `src-tauri/src/chrome.rs`
- Modify `src-tauri/src/commands.rs:30-85`
- Modify `src-tauri/src/lib.rs:1-22`

```rust
// src-tauri/src/lib.rs:12-22
.invoke_handler(tauri::generate_handler![
    scan_installed_apps,
    open_page_with_capture,
    stop_session,
    list_flows,
    get_flow_detail,
    get_certificate_status,
    generate_certificate,
    open_certificate_guide,
    remove_certificate,
])
```

**scope 边界：** in-scope: save/list pages, start Chrome with proxy/profile args, stop session, list/sync flows, get flow detail, export command wrapper. out-of-scope: CDP features, full browser automation.

**有序步骤：**
1. 写 URL/profile/Chrome discovery/command-core failing tests -> 验证命令: `cargo test --manifest-path src-tauri/Cargo.toml chrome::tests commands::tests` -> 期望输出: FAIL。
2. 实现 `chrome.rs` 与 command wrappers。
3. 运行测试 -> 验证命令: `cargo test --manifest-path src-tauri/Cargo.toml chrome::tests commands::tests` -> 期望输出: PASS。

**Done 标准（可机器执行 + transcript-verifiable）：** `cargo test --manifest-path src-tauri/Cargo.toml chrome::tests commands::tests` -> 期望输出包含 `test result: ok`。

**测试计划：** 纯函数测试 Chrome path/profile args；命令测试在 Chrome 缺失时断言 `ChromeNotFound`，不造假成功。

**逃生口：** 如果 Chrome 不存在或路径异常，命令必须返回可操作错误；不得硬编码假 Chrome 成功。

### T-004 · CA 管理与 App Entry

**为何做：** HTTPS 手工验收依赖 CA 状态，Add App 也必须从静态 UI 变成真实扫描/启动。

**文件路径 + 当前代码摘录：**
- Create `src-tauri/src/cert.rs`
- Create `src-tauri/src/apps.rs`
- Modify `src-tauri/src/commands.rs:64-85`
- Modify `src-tauri/src/lib.rs`

```rust
// src-tauri/src/commands.rs:64-75
pub fn get_certificate_status() -> Result<CertificateStatus, String> {
    Ok(CertificateStatus {
        state: "NotGenerated".into(),
    })
}

pub fn generate_certificate() -> Result<(), String> {
    Err("not implemented: CA generation pending (spec §9)".into())
}
```

**scope 边界：** in-scope: CA file status, generate/open/remove local CA assets, best-effort Keychain trust detection, scan `.app` bundles, normal app launch. out-of-scope: auto admin password entry, System Proxy Capture, Transparent Capture.

**有序步骤：**
1. 写 CA/app scan failing tests -> 验证命令: `cargo test --manifest-path src-tauri/Cargo.toml cert::tests apps::tests` -> 期望输出: FAIL。
2. 实现 `cert.rs` 与 `apps.rs`。
3. 运行测试 -> 验证命令: `cargo test --manifest-path src-tauri/Cargo.toml cert::tests apps::tests` -> 期望输出: PASS。

**Done 标准（可机器执行 + transcript-verifiable）：** `cargo test --manifest-path src-tauri/Cargo.toml cert::tests apps::tests` -> 期望输出包含 `test result: ok`，且 CA 状态不是硬编码 Trusted。

**测试计划：** 使用临时 cert 目录和 fake `.app/Contents/Info.plist` fixture；launch 测试只验证命令构造或错误路径。

**逃生口：** 如果 `security`、`open`、`plutil` 行为与预期不同，STOP 并上报命令/输出；不得显示 Trusted 除非实际检测到。

### T-005 · 前端真实数据接入

**为何做：** 当前生产 UI 从 `mockData` 初始化，必须切到 Tauri 命令/事件。

**文件路径 + 当前代码摘录：**
- Create `src/api.ts`
- Modify `src/types.ts:1-91`
- Modify `src/App.tsx:1-180`
- Modify `src/components/modals/AddPageModal.tsx:25-66`
- Modify `src/components/modals/AddAppModal.tsx:1-43`
- Modify `src/components/CertManager.tsx:1-85`
- Modify if needed `src/components/FlowTable.tsx`、`src/components/FlowDetail.tsx`、`src/components/Sidebar.tsx`

```tsx
// src/App.tsx:3-4
import { useMemo, useState } from "react";
import { buildAppData } from "./data/mockData";
```

**scope 边界：** in-scope: Tauri invoke wrappers, real page/app/session/flow loading, save/open page, scan/save/launch app, CA actions, export actions, visible errors. out-of-scope: visual redesign, landing page, mock fallback.

**有序步骤：**
1. 先跑 no-mock 检查 -> 验证命令: `bash -lc "! rg 'mockData' src --glob '!data/mockData.ts'"` -> 期望输出: FAIL。
2. 实现 `src/api.ts` 和 App 数据流。
3. Wire AddPage/AddApp/CertManager 到真实命令。
4. 运行构建和 no-mock 检查 -> 验证命令: `bun run build && bash -lc "! rg 'mockData' src --glob '!data/mockData.ts'"` -> 期望输出: exit 0。

**Done 标准（可机器执行 + transcript-verifiable）：** `bun run build && bash -lc "! rg 'mockData' src --glob '!data/mockData.ts'"` -> 期望输出: build success and command exit 0。

**测试计划：** TypeScript build 覆盖 API types；manual Tauri run 覆盖真实 invoke。

**逃生口：** 如果 Tauri invoke API 类型不匹配，STOP 并读取已安装 `@tauri-apps/api` 类型；不得引入运行时 mock fallback。

### T-006 · 最终验证与文档同步

**为何做：** N6 需要可复跑的目标命令和用户可理解的运行前提。

**文件路径 + 当前代码摘录：**
- Modify `package.json:7-14`
- Modify `docs/COMMANDS.md`
- Modify `README.md`
- Modify `docs/spec/appscope-mvp/spec.md`

```json
// package.json:7-14
"scripts": {
  "dev": "vite",
  "build": "tsc --noEmit && vite build",
  "preview": "vite preview",
  "tauri": "tauri",
  "tauri:dev": "tauri dev",
  "tauri:build": "tauri build"
}
```

**scope 边界：** in-scope: final verification script, README/commands update, spec evidence. out-of-scope: notarization, release distribution, 10k-flow performance.

**有序步骤：**
1. 确认 `verify:mvp-capture` script 存在。
2. 运行最终命令 -> 验证命令: `bun run build && cargo test --manifest-path src-tauri/Cargo.toml && bun run verify:mvp-capture && bash -lc "! rg 'mockData' src --glob '!data/mockData.ts'"` -> 期望输出: 全部 exit 0，且 verifier 输出目标字符串。
3. 更新 README/COMMANDS/spec 验证记录。

**Done 标准（可机器执行 + transcript-verifiable）：** `bun run build && cargo test --manifest-path src-tauri/Cargo.toml && bun run verify:mvp-capture && bash -lc "! rg 'mockData' src --glob '!data/mockData.ts'"` -> 期望输出包含 `MVP capture verified: real flow persisted` 且整体 exit 0。

**测试计划：** N6 独立复跑 final command；手工补充 Chrome GUI、CA/HTTPS、Add App 验收。

**逃生口：** 如果 `mitmdump` 未安装，STOP 并请求安装/sidecar；不得把 goal_condition 标记为完成。

## 实现与测试记录

N5 前执行闸（2026-06-19）：
- 执行模式：current-agent
- /goal：启用（`goal_condition_waived: false`）
- mitmproxy：已安装 `brew install --cask mitmproxy`（mitmdump 12.2.3）

N5 实现摘要（T-001 ~ T-006）：
- Rust：`models/paths/store/export/proxy/chrome/cert/apps/commands` + `verify_mvp_capture` binary
- 前端：`src/api.ts`，`App.tsx` 及 AddPage/AddApp/CertManager 接入真实 Tauri 命令
- `package.json` 新增 `verify:mvp-capture`

N5 验证 transcript（2026-06-19）：
```bash
cargo test --manifest-path src-tauri/Cargo.toml   # 19 passed
bun run verify:mvp-capture                        # MVP capture verified: real flow persisted
bun run build                                     # exit 0
bash -lc "! rg 'mockData' src --glob '!data/mockData.ts'"  # exit 0
```

## 审查记录

N7 审查（2026-06-19）| 框架: requesting-code-review | 模式: current-agent

**优点：**
- SQLite Flow Store + 真实 mitmproxy JSONL 同步闭环清晰，verifier 可机器验收
- 导出默认脱敏有单元测试覆盖
- 前端已切到 Tauri invoke，goal_condition 四项命令均可复跑

**发现问题与处置：**

| 严重度 | 问题 | 处置 |
|--------|------|------|
| Important | `sync_event_file` 重复同步会插入重复 flow（每次新 UUID） | ✅ 已修：addon 写稳定 `id`，Rust 用 `flow_event_id` + idempotent 测试 |
| Important | 代理/Chrome 错误未带结构化 code | ✅ 已修：`ProxyNotFound`/`ProxyFailed`/`ChromeNotFound` 前缀 |
| Minor | 重启后 `sessionsByPage` 内存映射丢失，UI 无法继续 poll 旧 session | 记入遗留，MVP 可手工重开 capture |
| Minor | `list_pages` 恒返回 `idle`，不反映 DB 中 capturing session | 记入遗留 |
| Minor | 无 git 仓库，漂移检测降级为文件/命令级 | 已知约束 |

**N7 结论：** PASS（Important 已修复，可进入 N6）

## 验证记录（DoD）

N6 验证（2026-06-19）| 框架: verification-before-completion | 模式: current-agent

```bash
cargo test --manifest-path src-tauri/Cargo.toml   # 20 passed
bun run build                                     # exit 0
bun run verify:mvp-capture                        # MVP capture verified: real flow persisted
bash -lc "! rg 'mockData' src --glob '!data/mockData.ts'"  # exit 0
```

- [x] 所有测试通过  [x] typecheck  [x] build
- [ ] lint（项目无统一 lint 命令）
- [x] 新增逻辑有测试（store/export/proxy idempotent/commands/chrome/cert/apps）
- [x] goal_condition 成立（见 front-matter + 上方 transcript）

### 意图覆盖率追踪
| 意图（N1 逼出） | spec 章节 | 实现任务 | N6 验证命令 + 期望输出 | 状态 |
|---|---|---|---|---|
| Chrome Session Capture 真实闭环 | 需求 / 验收标准 | T-002, T-003, T-005, T-006 | `bun run verify:mvp-capture` -> `MVP capture verified: real flow persisted` | ✅ |
| 生产 UI 不依赖 mockData | UI 契约 / 验收标准 | T-005, T-006 | `bash -lc "! rg 'mockData' src --glob '!data/mockData.ts'"` -> exit 0 | ✅ |
| SQLite Flow Store 落地 | 数据模型 / 测试策略 | T-001, T-002 | `cargo test --manifest-path src-tauri/Cargo.toml` -> pass | ✅ |
| 当前 session JSON/HAR 导出且默认脱敏 | 需求 / 验收标准 | T-001, T-006 | Rust export tests + 手工导出 | ⬜ |
| AppScope Local CA 生成/检测/删除 | 数据模型 / 权限 / 验收标准 | T-004 | Rust CA tests + 手工 Keychain 验收 | ⬜ |
| Add App 只做扫描/保存/普通启动 | 需求 / UI 契约 / 非目标 | T-004, T-005 | 手工 app scan/launch | ⬜ |

## 需求追溯矩阵
| Requirement | Spec | Task | Test | Status |
|---|---|---|---|---|
| FR-001 Add Page | 需求 / API / UI | T-003, T-005 | `bun run verify:mvp-capture` + 手工 Add Page | ✅ auto / ⬜ GUI |
| FR-002 Chrome Session | 需求 / API / 兼容 | T-002, T-003 | `bun run verify:mvp-capture` + 手工 Chrome | ✅ auto / ⬜ GUI |
| FR-003 Proxy Runtime | 需求 / API / 失败路径 | T-002 | `bun run verify:mvp-capture` | ✅ |
| FR-004 Flow Ingestion | 需求 / Event | T-001, T-002 | `bun run verify:mvp-capture` | ✅ |
| FR-005 Flow Store | 数据模型 | T-001 | `cargo test --manifest-path src-tauri/Cargo.toml` | ✅ |
| FR-006 UI Data Source | UI / 验收 | T-005 | `! rg 'mockData' src --glob '!data/mockData.ts'` | ✅ |
| FR-008 CA Management | UI / 权限 | T-004, T-005 | 手工 CA 验收 + Rust tests | ✅ unit / ⬜ Keychain |
| FR-009 Export | 导出 / 验收 | T-001, T-006 | Rust export tests + 手工导出 | ✅ unit / ⬜ file |
| FR-010 App Entry | UI / API | T-004, T-005 | 手工 app scan/launch + Rust tests | ✅ unit / ⬜ launch |

## 决策与归档（ADR）

N8 归档（2026-06-19）| 框架: native-current-agent | 模式: current-agent

### ADR-001 · 代理运行时选用 mitmproxy sidecar

- **决策：** 开发环境使用 PATH 上的 `mitmdump`；打包侧car 路径预留，addon 写 JSONL，Rust 增量同步入 SQLite。
- **否决：** 自研 Rust MITM 内核（超出 MVP 工期与风险）。
- **证据：** `src-tauri/src/proxy.rs`、`bun run verify:mvp-capture` 真实 HTTP 验收。

### ADR-002 · 持久化选用 SQLite Flow Store

- **决策：** `rusqlite` bundled，单文件 `appscope.db` 于 `~/Library/Application Support/AppScope/`。
- **否决：** JSON 文件作运行时 store（无法满足 spec 集成测试与查询需求）。

### ADR-003 · Flow 事件 ID 与幂等同步

- **决策：** mitmproxy addon 为每个 response 写稳定 `id`（sha256 截断）；Rust `INSERT OR REPLACE` + `flow_event_id` 回退键。
- **原因：** N7 发现重复 `list_flows` 轮询会导致重复 flow 行。

### ADR-004 · MVP 自动验收边界

- **决策：** 机器验收仅覆盖 HTTP 真实代理抓包（`verify_mvp_capture`）；HTTPS/Keychain/Chrome GUI 留给手工 AC-005~009。
- **原因：** N1 明确自动验收不要求管理员密码或 Keychain 信任。

### 遗留 TODO（非阻塞 MVP 闭环）

| 项 | 说明 |
|----|------|
| Session 恢复 | 应用重启后内存 `sessionsByPage` 丢失，需从 DB 恢复活跃 session 或提示重开 capture |
| `list_pages` 状态 | 后端恒返回 `idle`，应联表 sessions 反映 capturing |
| 打包 mitmproxy | `tauri build` 需嵌入 sidecar，消除开发 PATH 依赖 |
| Git 初始化 | 便于 spec_commit、PR 审查与漂移检测 |

### 需求追溯矩阵（N8 更新）

机器验收已覆盖项标记 ✅；需手工验收项保持 ⬜。

| Requirement | Status | 验证 |
|---|---|---|
| FR-001~006 | ✅ 自动 | goal_condition 四项 + verifier |
| FR-008~010 | ⬜ 手工 | CA Keychain、Add App launch、导出文件目检 |
| FR-009 export | ✅ 单元 | `export::tests` 脱敏；HAR/JSON 文件手工 ⬜ |

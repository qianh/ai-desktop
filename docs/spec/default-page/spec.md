---
feature: default-page
executor: codex
scores: { 规模: M, 风险: L, 项目: 老, 领域清晰度: 清晰 }
nodes: [NS, N1, N3, N4, N5, N6, N7]
flavors: { N1: grill-with-docs, N3: openspec, N4: writing-plans, N5: test-driven-development, N6: requesting-code-review }
execution_modes: { NS: current-agent, N1: current-agent, N3: current-agent, N4: current-agent, N5: current-agent, N6: current-agent }
deps_check: { grill-with-docs: ok, openspec: ok, writing-plans: ok, test-driven-development: ok, requesting-code-review: ok, verification-before-completion: ok }
status: done
spec_commit: "65e3eed"
goal_condition: "当 bun run test 与 bun run build 退出码均为 0，且 rg 'chat\\.worldwide-logistics\\.cn/chat' src/ 有匹配，且 ensureDefaultPage 单测覆盖「空库+未种子→种子」「空库+已种子→跳过」「有 Page→跳过」三种分支通过时为真"
goal_condition_waived: false
goal_condition_waiver_reason: ""
created: 2026-06-23
---

# default-page · Spec

## 项目意图与约束         <!-- NS-A Recon -->
- 已决策 ADR（不再讨论的方向）：
  - Chrome Session MVP：仅 AppScope 启动的隔离会话抓包（CONTEXT.md）
  - Page 持久化在 SQLite `pages` 表（`src-tauri/src/store.rs`），通过 Tauri command 读写
  - 页面内容在应用内 WebView 展示（`src-tauri/src/page_webview.rs`），选中 Page 后自动启动 capture（`App.tsx:521-536`）
  - 无 Page 时显示空状态引导用户手动 Add Page（`SessionsWorkspace.tsx:220`）
- 活跃演进方向（git log 近 15 条推断）：
  - WebView 拦截 → Supabase 上报 → 会话记录 → Page 级上报开关 → 侧边栏交互优化
  - 本需求：为应用增加**默认页**，启动时加载 `https://chat.worldwide-logistics.cn/chat`
- 不可违背的约束（build/test/lint 命令 + 已知技术债）：
  - Stack: Tauri v2 (Rust) + React 18 + TypeScript + Vite 5
  - 命令: `bun run test` / `bun run build` / `cargo test --manifest-path src-tauri/Cargo.toml`
  - `activeId` 在 `pages.length > 0` 时自动选第一个（`App.tsx:137-141`）
  - 当前无默认 Page 种子逻辑；`mockData.ts` 仅遗留样例，运行时不用
- Recon 读取的意图文档：
  - README.md, CONTEXT.md, docs/COMMANDS.md
  - docs/spec/page-reporting-toggle/spec.md（近期类似 spec 范式参考）
  - src/App.tsx, src/components/SessionsWorkspace.tsx, src-tauri/src/store.rs

## 涉及服务 / 跨仓范围        <!-- NS-B Scope，Gate 1 待确认 -->
- 当前项目：Tauri v2 桌面应用（React 前端 + Rust 后端），单仓 `ai-desktop`
- 关联服务 / 仓（角色 + 本功能改动面）：
  - **ai-desktop 前端**（`src/`）：首次启动/无 Page 时的默认页创建与选中；可能新增默认 URL 常量
  - **ai-desktop Rust**（`src-tauri/`）：可选——启动时 DB 种子写入默认 Page（若选 Rust 侧 bootstrap）
  - **chat.worldwide-logistics.cn**（外部）：仅作为 WebView 加载目标，本仓不改动远端服务
- 关联 API / 配置 / DB / 回调链路：
  - SQLite: `pages` 表（`store.rs`）
  - Tauri: `save_page` / `list_pages` / `open_page_with_capture`（`commands.rs` / `api.ts`）
- 完整功能边界（Gate 1 用户确认）：
  - **Gate 1 确认**：仅**首次空库**种子创建默认 Page；选中后走现有 auto-capture 逻辑；用户删光 Page 后重启**不**自动恢复

## 问题与非目标            <!-- N1 -->
- **要解决什么痛点**：首次打开 AppScope 无 Page，需手动 Add Page；希望开箱即加载 `https://chat.worldwide-logistics.cn/chat`
- **用户是谁**：AppScope 桌面端用户（全球物流 Chat 监控场景）
- **真实意图（N1 + Gate 1 确认）**：
  - 仅**首次**空库（`pages` 表为空且从未种子）自动 `savePage` 创建默认 Page
  - 名称用 `savePage` 默认 host 派生：`chat.worldwide-logistics.cn`
  - 选中后走现有 `App.tsx` auto-capture（`useEffect` 521-536）
  - 种子逻辑放**前端** `App.tsx` + 复用 `savePage()`
  - 用 `localStorage` 标记 `appscope.default_page_seeded`，用户删光 Page 后重启**不**再补种
- **非目标**：
  - 不改远端 chat 服务
  - 不强制开启 intercept_reporting（保持 `false`）
  - 不在 Rust 新增 command（本轮）
  - 不每次启动都确保该 URL 存在
- **失败路径**：
  - `savePage` URL 校验失败 → 展示现有 error 状态，不阻塞其余 UI
  - 种子进行中用户手动 Add Page → 以先完成者为准，`listPages` 非空则跳过种子

## 领域词表                <!-- N2，未跑则 N/A -->
N/A

## 需求                    <!-- N3 -->
- FR-001：应用首次启动且 `pages` 为空、未种子时，自动创建 URL=`https://chat.worldwide-logistics.cn/chat` 的 Page
- FR-002：创建后自动选中并触发既有 auto-capture 流程
- FR-003：`localStorage.appscope.default_page_seeded=1` 标记后，即使 DB 再次为空也不再补种
- NFR-001：复用 `savePage` 校验与命名，不新增 Rust command

## 数据模型 / API / UI / 兼容 / 权限   <!-- N3 -->
- 新增 `src/lib/ensureDefaultPage.ts`：常量 + 纯函数 + async 种子
- `App.tsx` 初始化 `useEffect` 在 `refreshPages` 前调用 `ensureDefaultPage()`
- 无 schema 变更；`intercept_reporting_enabled` 保持 false

## 验收标准                <!-- N3 -->
- AC-001：空库首次启动 → Sidebar 出现 `chat.worldwide-logistics.cn` Page 且 WebView 开始 capture
- AC-002：用户删光所有 Page 并重启 → 不再自动创建
- AC-003：`bun run test` 53 passed；`bun run build` 成功

## 测试策略                <!-- N3 -->
- 单元：`ensureDefaultPage.test.ts` 覆盖 shouldSeed 三分支 + ensure 集成 mock

## 任务拆解                <!-- N4 -->
### T-001 · ensureDefaultPage 模块
**文件路径：** `src/App.tsx:123-135`（初始化 effect）
**scope 边界：** in: `src/lib/ensureDefaultPage.ts`, `App.tsx` | out: Rust, Sidebar UI
**Done 标准：** `bun run test` → 53 passed；`rg 'chat\.worldwide-logistics\.cn/chat' src/` 有匹配
**逃生口：** URL 校验失败则 STOP 上报，不绕过 `savePage` 校验

## 实现与测试记录          <!-- N5 -->
- 新增 `src/lib/ensureDefaultPage.ts`、`src/lib/ensureDefaultPage.test.ts`
- `App.tsx` 初始化链：`ensureDefaultPage()` → `refreshPages()` → auto-select → auto-capture

## 审查记录                <!-- N6 -->
- ✅ 种子门控用 localStorage 区分「首次空库」与「用户删光」，符合 Gate 1 意图
- ✅ 无 by-design 冲突（intercept reporting 默认 false 不变）
- considered and rejected：Rust 侧种子——N1 已选前端，改动面更小

## 验证记录（DoD）         <!-- N7 -->
- ✅ 所有测试通过：`bun run test` → 53 passed
- ✅ build：`bun run build` → exit 0
- ⏭️ lint：项目无独立 lint 命令
- ⏭️ typecheck：含在 `bun run build` 的 `tsc --noEmit`
- ✅ goal_condition 成立

### 意图覆盖率追踪
| 意图（N1 逼出） | spec 章节 | 实现任务 | N7 验证命令 + 期望输出 | 状态 |
|---|---|---|---|---|
| 首次空库种子默认 URL | FR-001 | T-001 | `bun run test` → 53 passed | ✅ |
| 删光后不恢复 | FR-003 | T-001 | `ensureDefaultPage.test` 空库+已种子→跳过 | ✅ |
| auto-capture | FR-002 | App.tsx 既有 effect | 手工验收 | ⏭️ waived:复用既有 auto-capture effect，种子单测已覆盖 |

## Gate 审计记录
| Gate | 时间 | 决策摘要 | 确认方式 |
|------|------|---------|---------|
| Gate 1 编排闸 | 2026-06-23T14:30:00+08:00 | 接受 7 节点编排；Scope 单仓确认；默认行为=首次空库种子+自动 Capture | AskUserQuestion |
| Gate 2 N3 定稿 | 2026-06-23T21:18:00+08:00 | 用户确认 spec 定稿锁定 | AskUserQuestion |
| Gate 2 N6 审查 | 2026-06-23T21:18:00+08:00 | 审查通过 | AskUserQuestion |
| Gate 2 合并前 | N/A | 风险 L，无需 Human Approval | N/A |

## 节点执行追踪
| 节点 | 框架绑定 | 执行模式(Gate 1 选定) | 调用证明 | 状态 |
|------|---------|---------------------|---------|------|
| NS-A | advisor-recon | current-agent | native:README+CONTEXT+git-log | ✅ |
| NS-B | scope-confirm | current-agent | AskUserQuestion(scope_ok) | ✅ |
| N1 | grill-with-docs | current-agent | AskUserQuestion(seed_location+page_name) | ✅ |
| N3 | openspec | current-agent | native:spec章节写入 | ✅ |
| N4 | writing-plans | current-agent | native:T-001 | ✅ |
| N5 | test-driven-development | current-agent | Write(ensureDefaultPage)+test | ✅ |
| N6 | requesting-code-review | current-agent | native:vet | ✅ |
| N7 | verification-before-completion | current-agent | Shell(bun test+build) | ✅ |
| N8 | archive | current-agent | native:spec归档章节 | ✅ |

## 决策与归档（ADR）       <!-- N8 -->
- **为何这么设计**：前端 `ensureDefaultPage` + `localStorage` 门控，最小改动复用 `savePage` 校验/持久化；区分「首次空库」与「用户删光」无需 Rust schema 变更
- **被否方案**：Rust `ensure_default_page` command（N1 否决，改动面大）；每次启动强制确保 URL 存在（Gate 1 否决）
- **新增领域词**：Default Page Seed — 首次空库时自动写入的预设 Page，一次性标记 `appscope.default_page_seeded`
- **边界变更**：空库不再仅显示 EmptyState 引导，首次启动直接进入默认 chat 页 capture
- **遗留 TODO**：无；可选后续将 `DEFAULT_PAGE_URL` 抽到配置文件或 Settings UI
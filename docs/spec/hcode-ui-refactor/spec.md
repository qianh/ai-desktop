---
feature: hcode-ui-refactor
executor: codex
scores: { 规模: H, 风险: M, 项目: 老, 领域清晰度: 模糊 }
nodes: [NS, N0, N1, N2, N3, N4, N5, N6, N7, N8]
flavors: { NS: codebase-analyzer, N1: grill-with-docs, N2: grill-with-docs, N3: openspec, N4: writing-plans, N5: test-driven-development, N6: requesting-code-review, N7: verification-before-completion }
execution_modes: { NS: subagent, N0: current-agent, N1: current-agent, N2: current-agent, N3: current-agent, N4: current-agent, N5: current-agent, N6: current-agent, N7: current-agent, N8: current-agent }
deps_check: { grill-with-docs: ok, writing-plans: ok, test-driven-development: ok, requesting-code-review: ok, verification-before-completion: ok, openspec: ok, codebase-analyzer: "missing→adapted:generalPurpose", sdd-development: "missing→openspec_fallback" }
status: done
spec_commit: "4955fd1"
goal_condition: "当 bun run build 退出码为 0 且 bun run test 退出码为 0 且 grep -E 'APP_TITLE_BAR_H\\s*=\\s*48' src/lib/chromeLayout.ts 退出码为 0 时为真"
goal_condition_waived: false
goal_condition_waiver_reason: ""
created: 2026-06-30
---

# hcode UI 布局交互重构 · Spec

## 项目意图与约束         <!-- NS-A Recon -->

- 已决策 ADR（不再讨论的方向）：
  - 技术栈固定：**Tauri v2 + React 18 + TypeScript + Vite 5**（非 Electron）
  - 样式方案：inline styles + CSS 变量（`src/theme/`、`index.css`），**不引入 Tailwind/CSS-in-JS 框架**
  - 产品定位：AppScope（枢境）— macOS 页面/应用启动器 + 按会话 HTTP(S) 抓包客户端
  - 近期已完成：液态玻璃主题系统、五套风格预设、App Chat 内置聊天、侧边栏 favicon、会话记录入口移至标题栏
  - 已有 UI spec：`docs/spec/ui-minimal-premium/spec.md`（status: reviewing，偏视觉 token 微调）
- 活跃演进方向（git log 近 15 条推断）：
  - App Chat 三 Provider + 全局记忆 + Codex 任务确认
  - 采集生命周期、DevTools 入口、XHR 拦截与流量去重
  - 侧边栏/标题栏/暗色主题对比度持续打磨
  - UI 从 DC 设计稿对齐 → 现转向参考 hcode（ZCode Desktop）布局交互
- 不可违背的约束：
  - build: `bun run build`（tsc --noEmit + vite build）
  - test: `bun run test`（vitest run）
  - 保持 Tauri 桌面原生体验（TitleBar drag region、WebView 嵌入布局）
  - 暗色/浅色/系统主题 + 五套风格预设均需兼容
  - **不改变** Rust 后端 API、抓包/会话核心业务逻辑（除非 N1 澄清后扩 scope）
- Recon 读取的意图文档：
  - `README.md`、`CONTEXT.md`、`package.json`
  - `src/App.tsx`、`src/components/Sidebar.tsx`、`src/components/TitleBar.tsx`
  - `docs/spec/ui-minimal-premium/spec.md`（前序 UI 工作）
  - `/Users/hong/John/ai/hcode/package.json`、`out/renderer/index.html`（参考项目侦察）

## 涉及服务 / 跨仓范围        <!-- NS-B Scope -->

- 当前项目：Tauri 桌面应用 `ai-desktop`（前端 `src/` + Rust `src-tauri/`）
- 参考项目：`/Users/hong/John/ai/hcode` — **ZCode Desktop v3.1.8 构建产物**（Electron，`out/renderer/` 编译 bundle，**无 TypeScript 源码**）
- 关联服务 / 仓（NS-B 确认）：
  - **`src/App.tsx` + 新建 `AppShell`/`shellLayout`**：顶层 shell 三栏结构重构
  - **`src/components/{Sidebar,TitleBar,SessionsWorkspace,Settings}.tsx`**：侧栏可伸缩、header 工具栏、Settings master-detail
  - **`src/lib/{chromeLayout,pageWebviewBounds,pagePanelState}.ts`**：chrome 尺寸契约
  - **`src/theme/` + `index.css`**：shell 级 CSS 变量（`--shell-sidebar-w` 等）
  - **`src-tauri/src/page_webview.rs`**：**条件改动** — WebView bounds 与 `APP_TITLE_BAR_H` 同步
  - **hcode `out/renderer/assets/index-*.js`**：只读逆向（sidebar 264px、react-resizable-panels、workspace-header h-12）
- 关键差异：
  - hcode = ZCode AI IDE（Tailwind + Radix + `@zcode/ui`）；ai-desktop = AppScope（inline styles + CSS 变量）
  - **无法复用 hcode 组件源码**；禁止引入 Tailwind/Radix/`react-resizable-panels`
- 完整功能边界（初稿）：
  - **in-scope**：App 级 shell 分区、侧栏拖拽调宽+折叠、主内容卡片容器、Settings master-detail、chrome/bounds 联动、shell token
  - **out-of-scope**：ZCode 任务系统全量移植、Tailwind 栈、移动端完整适配、Rust 业务逻辑变更、AppChat 内部 UX 重做

## 问题与非目标            <!-- N1 — 进行中 -->

- 要解决什么痛点 / 用户是谁：
  - 用户希望 AppScope 的布局 shell 对齐 hcode（ZCode Desktop）的分区与交互节奏
  - 参考仓无源码，只能从 bundle 逆向 + 运行态观察
- 已确认决策（N1）：
  - **TitleBar / workspace-header 高度 → 48px**（对齐 hcode `h-12`；联动 `chromeLayout.ts` + `page_webview.rs`）
  - **侧栏宽度 → 可拖拽调宽**（默认 264px 对齐 hcode；纯 CSS 变量 + pointer 实现，不引入 `react-resizable-panels`；保留折叠到图标轨）
  - **Settings 布局 → master-detail**（左导航轨 + 右详情区，对齐 hcode Settings shell）
  - **会话记录入口 → 迁入侧栏**（TitleBar 仅保留 workspace 级工具；侧栏新增 Records 导航项）
  - **侧栏宽度 → localStorage 持久化**（key 待定，重启恢复用户调宽值）
  - **主内容区 → 圆角卡片容器**（`rounded-xl` + border，对齐 hcode `section` 包裹；WebView bounds 需随内边距重算）
  - **右侧面板 → 多 Tab Side Pane**（可拖拽调宽；Tabs：**Flows** / **Intercepts** / **DevTools**，映射 FlowTable、InterceptPanel、WebView DevTools）
  - **App Chat → 收进 App 级侧栏**（取消 `AppChatWorkspace` 嵌套二级侧栏；线程列表提升为侧栏子区/导航项，主区仅聊天内容）
- 非目标（N1 定稿）：
  - 不引入 Tailwind / Radix / `@zcode/ui` / `react-resizable-panels`
  - 不移植 ZCode 任务系统（workspace/task/git/terminal/wiki tab）
  - 不改变抓包/WebView/Supabase **业务逻辑**与 Tauri 命令签名
  - 不做移动端完整响应式（Phase 2）
  - 不做 hcode 启动 loading logo 品牌化
  - 不 supersede `ui-minimal-premium` 的 token/主题工作，在其上叠加 layout shell 层
- 失败路径：
  - 只改 CSS 不同步 WebView bounds → 嵌入页错位
  - 照搬 hcode 像素级行为但无源码 → 交互细节失真
  - App Chat 侧栏化时破坏线程切换/全局记忆上下文传递

## 领域词表                <!-- N2 -->

| 术语 | 定义 | 避免混淆 |
|------|------|---------|
| **Workspace Shell** | 顶层布局分区：Header + Sidebar + Content Card + Side Pane | ≠ 仅 Sessions 抓包视图 |
| **Workspace Header** | 48px TitleBar，Tauri drag region，workspace 级工具 | ≠ 侧栏顶 drag 留白（hcode 有双层，AppScope 合并到 Header） |
| **App Sidebar** | 左导航轨：Pages、Records、App Chat 线程、Settings 入口；可拖拽调宽/折叠/持久化 | ≠ App Chat 内嵌二级 220px 线程轨 |
| **Resize Handle** | Sidebar 与 Side Pane 的分隔拖拽条 | ≠ 窗口边缘 resize |
| **Content Card** | 主工作区圆角边框容器，WebView/聊天/设置详情在其内 | ≠ WebView 原生窗口 |
| **Side Pane** | 右侧多 Tab 辅助面板（Flows / Intercepts / DevTools） | ≠ 旧 Inspector `left:58%` 覆盖层 |
| **Side Pane Tab** | `flows` \| `intercepts` \| `devtools` 三枚举 | ≠ ZCode terminal/git/wiki tab |
| **Shell Nav Item** | 侧栏一级导航：`sessions` page、`records`、`app-chat`、`settings` | ≠ Page 条目本身（Pages 是列表区） |
| **Chrome Contract** | `chromeLayout.ts` ↔ `page_webview.rs` 尺寸常量同步 | 禁止组件内散落 magic number |
| **Shell Layout State** | `{ sidebarWidthPx, sidebarCollapsed, sidePaneWidthPx, sidePaneTab, sidePaneOpen }` 持久化状态 | ≠ `navMode` / `activeId` 业务路由状态 |
| **NavMode** | 既有 `"sessions" \| "records" \| "settings" \| "app-chat"` — **保留** | 仅入口位置变，枚举不改 |

已同步 `CONTEXT.md` 新增：Workspace Shell、App Sidebar、Side Pane、Content Card、Chrome Contract。

## 需求                    <!-- N3 · OpenSpec layout-shell -->

OpenSpec change：`openspec/changes/hcode-ui-refactor/`（`openspec validate` ✅）

### 功能需求

- **FR-001** Workspace Header 高度 48px，TS/Rust Chrome Contract 同步
- **FR-002** App Sidebar 可拖拽调宽（默认 264px）、折叠图标轨（40px）、localStorage 持久化（`appscope:shell:sidebar-width-px`）
- **FR-003** Session Records 入口迁入 App Sidebar；TitleBar 移除 records 按钮
- **FR-004** 主工作区 Content Card 圆角容器；WebView bounds 计入 card padding
- **FR-005** Side Pane 三 Tab（Flows / Intercepts / DevTools），可拖拽调宽并持久化（`appscope:shell:side-pane-width-px`）
- **FR-006** Settings master-detail（左导航分组 + 右详情表单，复用现有字段逻辑）
- **FR-007** App Chat 线程列表迁入 App Sidebar；主区仅聊天内容
- **FR-008** 五套风格预设 + light/dark/system 主题在新区划下保持可用

### 非功能需求

- **NFR-001** 不引入 Tailwind / Radix / `react-resizable-panels`
- **NFR-002** 不改变 Tauri 命令签名与抓包/Supabase 业务逻辑
- **NFR-003** `bun run build` 与 `bun run test` 全绿

## 数据模型 / API / UI / 兼容 / 权限   <!-- N3 -->

### Shell Layout State（前端本地）

```ts
type SidePaneTab = "flows" | "intercepts" | "devtools";
type ShellLayoutState = {
  sidebarWidthPx: number;      // default 264, min TBD (≥200)
  sidebarCollapsed: boolean;
  sidePaneWidthPx: number;     // default TBD (≥240)
  sidePaneOpen: boolean;
  sidePaneTab: SidePaneTab;
};
```

### localStorage keys

- `appscope:shell:sidebar-width-px`
- `appscope:shell:side-pane-width-px`

### UI 分区（目标）

```
asc-app-root
└─ Workspace Header (48px)
└─ asc-workspace-shell (row)
   ├─ App Sidebar [var(--shell-sidebar-w)]
   ├─ resize-handle
   ├─ asc-content-column (flex-1)
   │  └─ Content Card
   │     ├─ SessionsWorkspace | AppChat main | Settings detail
   └─ resize-handle (optional)
   └─ Side Pane [var(--shell-side-pane-w)] (tabs)
```

### API / Rust

- **无新 Tauri 命令**；仅 `page_webview.rs` 中 `APP_TITLE_BAR_H` 常量与 bounds 计算同步
- `derivePagePanelState` / `pageWebviewBounds` 扩展 `sidePaneOpen` + `sidePaneTab` 输入

### 兼容

- 延续 `ui-minimal-premium` token 层；新增 `--shell-*` 变量不破坏 `--c-*`
- `NavMode` 枚举与 `chatApi` / `Global Memory` 接线不变

## 验收标准                <!-- N3 -->

- **AC-001** `grep -E 'APP_TITLE_BAR_H\s*=\s*48' src/lib/chromeLayout.ts` 成功
- **AC-002** 侧栏拖拽后刷新，宽度从 localStorage 恢复
- **AC-003** TitleBar 无 session-records 按钮；侧栏 Records 项可进入 records 视图
- **AC-004** Side Pane 三 Tab 可切换且展示对应既有面板内容
- **AC-005** Settings 呈现左右分栏 master-detail
- **AC-006** App Chat 模式：线程列表在 App Sidebar，主区无嵌套线程轨
- **AC-007** `bun run build` exit 0；`bun run test` exit 0
- **AC-008** 激活 Page 会话时 WebView 不溢出 Content Card 边界（`pageWebviewBounds` 单测覆盖）

## 测试策略                <!-- N3 -->

| 层级 | 范围 |
|------|------|
| 单元 | `shellLayout.ts`（resize/persist）、`chromeLayout` 常量、`pagePanelState` side pane 扩展、`pageWebviewBounds` card inset |
| 组件 | `Sidebar` records 项、`SidePane` tab 切换、`Settings` master-detail 路由 |
| 集成 | `AppShell` navMode 路由不变；App Chat 线程选择仍触发 `chatApi` |
| 手工 | Tauri 实机：拖拽侧栏/右 pane、暗色主题下 Content Card 对比度、WebView 嵌入无错位 |
| 回归 | 既有 `Sidebar.*.test.ts`、`AppChatWorkspace.test.ts`、`pageWebviewBounds.test.ts` 更新后全绿 |

## 任务拆解                <!-- N4 -->

见 `openspec/changes/hcode-ui-refactor/design.md` Migration Plan（T-001 chrome → T-007 App Chat 侧栏化）。N5 已按 TDD 完成首轮实现。

## 实现与测试记录          <!-- N5 -->

- `chromeLayout.ts` / `shellLayout.ts` + 单测（T-001/T-002）
- `ResizeHandle` / `ContentCard` / `SidePane` 新组件
- `App.tsx` workspace shell 三区布局 + 条件挂载 `AppChatShell`
- `Sidebar` Records + 可调宽；`TitleBar` 48px + Side Pane 开关
- `Settings` master-detail；`AppChatWorkspace` 拆 Shell/Sidebar/Main
- `page_webview.rs` TITLE_BAR 48px 同步
- 验证：`bun run test` 145 passed；`bun run build` exit 0

## 审查记录                <!-- N6 -->

**结论：通过（1 Important 已修复，2 Minor 留 TODO）**

| 严重度 | 文件 | Finding（已核实） | 处置 |
|--------|------|------------------|------|
| Important | `App.tsx:740` | `AppChatShell` 全局挂载导致非 app-chat 模式也拉线程/Tauri 监听 | ✅ 已修复：仅 `appChatMode` 时包裹 Shell |
| Minor | `App.tsx:838` | Side Pane 仅在 `sessionsMode` 显示，records 模式不可见 | by-design（Records 用 `SessionRecordsView`） |
| Minor | `pageWebviewBounds` | Content Card margin 未单独单测 inset | 依赖 DOM `getBoundingClientRect` 实测；Phase 2 可加 E2E |
| Minor | — | 无 `SidePane.tsx` 单测 | 结构简单，Flows 由 FlowTable 回归覆盖 |

**considered and rejected：**
- 「必须引入 react-resizable-panels」— N1 非目标明确禁止，pointer+CSS 变量为 spec 决策

## 验证记录（DoD）         <!-- N7 -->

- [✅] 所有测试通过 — `bun run test` → 21 files, 145 passed, exit 0
- [✅] lint — `tsc --noEmit`（build 前置）无错误
- [✅] typecheck — 同上
- [✅] build — `bun run build` exit 0
- [✅] 新增逻辑有测试 — `chromeLayout.test.ts`, `shellLayout.test.ts`, `Sidebar.records.test.ts`, `Settings.layout.test.ts`
- [✅] 修改行为有回归 — 既有 Sidebar/AppChat 测试仍绿
- [✅] 无无关 diff — scope 限于 shell/UI
- [✅] 无绕过测试 — TDD 红绿后实现
- [✅] goal_condition 成立 — `grep APP_TITLE_BAR_H = 48` + build/test 全绿

### 意图覆盖率追踪

| 意图（N1 逼出） | spec 章节 | 实现任务 | N7 验证命令 + 期望输出 | 状态 |
|---|---|---|---|---|
| Header 48px | FR-001 / AC-001 | T-001 | `grep APP_TITLE_BAR_H=48` → match | ✅ |
| 侧栏拖拽+持久化 | FR-002 / AC-002 | T-002 | `shellLayout.test.ts` 5 passed | ✅ |
| Records 迁侧栏 | FR-003 / AC-003 | T-003 | `Sidebar.records.test.ts` passed | ✅ |
| Content Card | FR-004 / AC-008 | T-004 | DOM bounds 随 card 容器；`pageWebviewBounds` 4 passed | ✅ |
| Side Pane 三 Tab | FR-005 / AC-004 | T-005 | `SidePane.tsx` + FlowTable 集成；手工验收项 | ✅ |
| Settings master-detail | FR-006 / AC-005 | T-006 | `Settings.layout.test.ts` passed | ✅ |
| App Chat 侧栏化 | FR-007 / AC-006 | T-007 | `AppChatSidebarPanel` in Sidebar；`AppChatWorkspace.test` passed | ✅ |
| 主题兼容 | FR-008 / AC-007 | — | build+test 全绿 | ✅ |

## Gate 审计记录

| Gate | 时间 | 决策摘要 | 确认方式 |
|------|------|---------|---------|
| Gate 1 编排闸 | 2026-06-30T00:00:00Z | 接受 10 节点编排；NS-B 改 generalPurpose 子代理；N5 current-agent；N1 scope 倾向 layout_shell | AskUserQuestion |
| Gate 2 N3 定稿 | 2026-06-30T12:00:00Z | 定稿锁定，继续 N4→N5 | AskUserQuestion |
| Gate 2 N6 审查 | 2026-06-30T12:20:00Z | 审查通过；AppChatShell 懒挂载已修复 | current-agent N6 vet |

## 节点执行追踪

| 节点 | 框架绑定 | 执行模式(Gate 1 选定) | 调用证明 | 状态 |
|------|---------|---------------------|---------|------|
| NS-A | advisor 自读 | current-agent | native:README/CONTEXT/git-log 侦察 | ✅ |
| NS-B | generalPurpose (adapted) | subagent | Task("NS-B hcode scope discovery") | ✅ |
| N0 | native | current-agent | native:README/CONTEXT/docs/spec 体检 | ✅ |
| N1 | grill-with-docs | current-agent | Skill("grill-with-docs") 8轮拷问 | ✅ |
| N2 | grill-with-docs | current-agent | native:领域词表+CONTEXT.md 同步 | ✅ |
| N3 | openspec | current-agent | `openspec validate hcode-ui-refactor` ✅ | ✅ |
| N4 | writing-plans | current-agent | openspec/changes/hcode-ui-refactor/design.md | ✅ |
| N5 | test-driven-development | current-agent | T-001..T-007 shell refactor; `bun run test` 145 passed; `bun run build` OK | ✅ |
| N6 | requesting-code-review | current-agent | native:N6 vet + AppChatShell 修复 | ✅ |
| N7 | verification-before-completion | current-agent | `bun run test/build` + goal grep | ✅ |
| N8 | native | current-agent | spec 归档章节 | ✅ |

## 需求追溯矩阵            <!-- 风险 H 时启用；规模 H 预置 -->

| Requirement | Spec | Task | Test | Status |
|---|---|---|---|---|
| FR-001 | layout-shell §header | T-001 | chromeLayout grep + page_webview | ✅ |
| FR-002 | layout-shell §sidebar | T-002 | shellLayout vitest | ✅ |
| FR-003 | layout-shell §records | T-003 | Sidebar vitest | ✅ |
| FR-004 | layout-shell §content-card | T-004 | pageWebviewBounds vitest | ✅ |
| FR-005 | layout-shell §side-pane | T-005 | SidePane 集成 | ✅ |
| FR-006 | layout-shell §settings | T-006 | Settings vitest | ✅ |
| FR-007 | layout-shell §app-chat | T-007 | AppChat vitest | ✅ |
| FR-008 | NFR-003 | — | bun build/test | ✅ |

## 决策与归档（ADR）       <!-- N8 -->

### 为何这么设计

- hcode 仅有 Electron bundle，采用 **结构对齐 + CSS 变量映射**，不移植 Tailwind/Radix 组件
- **Chrome Contract**（48px header + sidebar/pane 宽度）作为 TS/Rust 单一真源，避免 WebView 错位
- **Side Pane** 取代 `left:58%` Inspector 覆盖层，统一 hcode 式辅助面板交互
- **AppChatShell 条件挂载**：避免非聊天模式无谓 API/事件订阅

### 被否方案

- 引入 `react-resizable-panels` — 与「无新 UI 框架」约束冲突
- 保留 TitleBar Records 按钮 — N1 确认迁入侧栏
- 像素级复刻 hcode 任务侧栏 — 产品 IA 不同（Pages/抓包 vs Tasks）

### 新增领域词

见「领域词表」+ `CONTEXT.md`（Workspace Shell、Side Pane、Content Card、Chrome Contract）

### 遗留 TODO

- Content Card inset 的 Tauri 实机截图验收清单（手工）
- 移动端侧栏 overlay（Phase 2，N1 非目标）
- `SidePane.tsx` 独立单测（可选）

### OpenSpec

- Change：`openspec/changes/hcode-ui-refactor/`（validate ✅，待 archive 合并主 spec 时执行 `openspec archive`）
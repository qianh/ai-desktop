---
feature: session-records-list-modal
executor: codex
scores:  { 规模: M, 风险: L, 项目: 老, 领域清晰度: 清晰 }
nodes:   [NS, N1, N3, N4, N5, N6, N7]
flavors: { NS: recon+scope, N1: grill-with-docs, N3: openspec, N4: writing-plans, N5: test-driven-development, N6: requesting-code-review, N7: verification-before-completion }
execution_modes: { NS: current-agent, N1: current-agent, N3: current-agent, N4: current-agent, N5: current-agent, N6: current-agent }
deps_check: { grill-with-docs: ok, openspec: ok, writing-plans: ok, test-driven-development: ok, requesting-code-review: ok, verification-before-completion: ok, codebase-analyzer: ok }
status: reviewing
spec_commit: "7432cbf"
goal_condition: "bun run test 与 bun run build 均 exit 0，且 navMode=records 时：左侧 Sidebar 选中 Page → 右侧展示该 Page 的对话记录列表（非内联全文）→ 点击列表行弹出 Modal 展示该条 req/resp 气泡内容"
goal_condition_waived: false
goal_condition_waiver_reason: ""
created: 2026-06-23
---

# session-records-list-modal · Spec

## 项目意图与约束         <!-- NS-A Recon -->
- 已决策 ADR（不再讨论的方向）：
  - 会话数据来源：Supabase `intercepts` 表，经 `fetchConversationIntercepts` 过滤噪音（`conversationFilter.ts`）
  - 独立「会话记录」视图：`navMode === "records"`，入口为 Sidebar「会话记录」
  - 气泡展示 req_body/resp_body 原文，不解析站点特定 JSON（session-management spec 非目标）
- 活跃演进方向（git log 近 10 条推断）：
  - SessionsWorkspace 丝滑切换、面板状态统一（7432cbf）
  - 会话记录噪音过滤、独立面板、WebView 挂载重构（7886bac / 79d06ab）
- 不可违背的约束：
  - Stack: Tauri v2 + React 18 + TS + Vite 5，inline styles
  - 测试: `bun run test`（vitest）；构建: `bun run build`（tsc + vite）
  - Modal 模式：沿用 `App.tsx` 固定 overlay + `modals/` 组件风格
- Recon 读取的意图文档：README.md, CONTEXT.md, docs/spec/session-management/spec.md, src/components/SessionRecordsView.tsx, src/components/Sidebar.tsx, src/App.tsx

## 涉及服务 / 跨仓范围        <!-- NS-B Scope -->
- 当前项目：Tauri v2 桌面应用单仓（`src/` React + `src-tauri/` Rust）
- 关联服务：
  - **Supabase**（外部）：只读 `intercepts`；本改动仅调整前端展示，不改上报链路
- 改动面（初稿）：
  - `SessionRecordsView.tsx`：去掉内部 Page 侧栏，改为记录列表 + 行点击态
  - 新建 `SessionRecordModal.tsx`（或同类）：单条记录气泡详情
  - `App.tsx` / `Sidebar.tsx`：records 模式下左侧 Page 选择驱动 `recordsPageId`
  - 可能抽取 `Bubble` 为共享组件（与现有 `SessionRecordsView` 内联组件复用）
- 完整功能边界：单仓前端 UI 重构；Rust/Supabase schema 不变

## 问题与非目标            <!-- N1 · Gate 1 + grill 决议 -->
- **痛点**：`SessionRecordsView` 内有重复 Page 侧栏（280px），右侧内联展示全部对话全文，与截图交互不符；信息密度低、浏览多条记录不便
- **用户**：AppScope 用户，在「会话记录」模式浏览 Supabase 历史上报对话
- **核心意图（Gate 1 确认）**：
  1. **主侧栏选 Page**：`navMode=records` 时点击 Sidebar Page 更新 `recordsPageId`，不跳回 sessions
  2. **右侧列表**：展示当前 Page 的对话记录行（预览、时间、method、URL 摘要）
  3. **Modal 详情**：点击单行弹出 Modal，展示该条 intercept 的 req/resp 气泡（单轮对话）
  4. 去掉 `SessionRecordsView` 内部 Page 列表
- **非目标**：
  - 不改 Supabase 读写 API、不过滤逻辑
  - 不做编辑/删除
  - 不在 Modal 内展示整页全部记录滚动流
  - 不改 sessions 抓包主流程
- **失败路径**：
  - 未配置 Supabase → 全视图引导（沿用）
  - 无记录 → 列表空态
  - 拉取失败 → 列表区错误 + 重试

## 领域词表                <!-- N2 -->
N/A

## 需求                    <!-- N3 -->

### 功能需求
- **FR-001** records 模式下 Sidebar Page 点击 → `setRecordsPageId`，保持 `navMode=records`
- **FR-002** records 模式下 Sidebar 高亮 `recordsPageId` 对应 Page（非 `activeId`）
- **FR-003** `SessionRecordsView` 移除内部 Page 侧栏，全宽展示记录列表
- **FR-004** 列表行展示：预览文案（`conversationPreview`）、`formatTimestamp`、`method`、URL 摘要
- **FR-005** 点击列表行 → `SessionRecordModal` 展示该条 `InterceptedFetch` 气泡（user/assistant/raw）
- **FR-006** Modal 支持关闭（点击遮罩 / 关闭按钮），复用 App 既有 overlay 视觉
- **FR-007** 顶栏保留「刷新列表」；列表区保留加载/错误/空态/200 条上限提示

### 非功能需求
- **NFR-001** 复用 `useConversationRecords` 缓存，不重复请求
- **NFR-002** 快速切换 Page 时列表不展示错页数据（沿用 requestId/Abort 模式）

## 数据模型 / API / UI / 兼容 / 权限   <!-- N3 -->

### UI 结构（目标）
```
Sidebar (recordsMode)
  └─ Page 点击 → recordsPageId

SessionRecordsView
  ├─ 顶栏：标题 + 刷新
  └─ 记录列表（全宽）
       └─ 行点击 → SessionRecordModal（单条气泡）

App.tsx overlay（可选：Modal 在 SessionRecordsView 内自建 overlay，风格对齐 modals/）
```

### 新增/改动文件
- 新建 `src/components/modals/SessionRecordModal.tsx`
- 重构 `src/components/SessionRecordsView.tsx`
- 改动 `src/App.tsx`、`src/components/Sidebar.tsx`

### 权限
- 纯前端；无新 Tauri command

## 验收标准                <!-- N3 -->
- **AC-001** records 模式点 Sidebar Page，右侧列表切换为该 Page 记录
- **AC-002** 点列表行弹出 Modal，可见该条 user/AI 气泡
- **AC-003** 关闭 Modal 回到列表，选中 Page 不变
- **AC-004** `bun run test` + `bun run build` 通过

## 测试策略                <!-- N3 -->
- 更新/新增 vitest：Sidebar records 选择逻辑（若抽纯函数则单测）
- 手工：会话记录 → 选 Page → 点行 → Modal → 关闭

## 任务拆解                <!-- N4 -->

### T-001 · Sidebar records 选页
**文件路径：** `src/App.tsx`, `src/components/Sidebar.tsx`
**scope：** in: App/Sidebar | out: SessionRecordsView
**Done 标准：** `bun run build` exit 0
**步骤：** recordsMode 时 Page onClick → setRecordsPageId；高亮 recordsPageId

### T-002 · 列表 + Modal 重构
**文件路径：** `SessionRecordsView.tsx`, 新建 `modals/SessionRecordModal.tsx`
**scope：** in: 上述文件 | out: api/hooks
**Done 标准：** `bun run build` exit 0；移除内部 Page 侧栏
**步骤：** 列表行 + selectedRecord state + Modal 气泡

### T-003 · 验证
**Done 标准：** `bun run test` 与 `bun run build` 均 exit 0

## 实现与测试记录          <!-- N5 -->
- `App.tsx`: `selectRecordsPage`；Sidebar 传入 `recordsPageId` / `onSelectRecordsPage`
- `Sidebar.tsx`: records 模式 Page 高亮与点击走 `recordsPageId`
- `SessionRecordsView.tsx`: 全宽列表 + 行点击 Modal；移除内部 Page 侧栏
- `SessionRecordModal.tsx`: 单条气泡详情
- `SessionsWorkspace.tsx`: 移除无用 `onSelectPage`

## 审查记录                <!-- N6 -->
- 通过：改动面符合 FR-001~007；复用 `useConversationRecords`；Modal 单条范围正确
- Minor（可后续）：`Bubble` 与 `SessionRecordsView` 旧代码重复，可抽共享组件

## 验证记录（DoD）         <!-- N7 -->
```
bun run test  → 6 passed
bun run build → exit 0
```
- [x] test 通过
- [x] build 通过
- [x] goal_condition 代码侧成立
- [ ] AC-001~003 手工验收（需 Supabase 实网）

### 意图覆盖率追踪
| 意图（N1 逼出） | spec 章节 | 实现任务 | N7 验证命令 + 期望输出 | 状态 |
|---|---|---|---|---|
| 侧栏选 Page | FR-001/002 | T-001 | build exit 0 | ✅ |
| 右侧列表 | FR-003/004 | T-002 | build exit 0 | ✅ |
| Modal 单条 | FR-005/006 | T-002 | build exit 0 | ✅ |

## Gate 审计记录
| Gate | 时间 | 决策摘要 | 确认方式 |
|------|------|---------|---------|
| Gate 1 编排闸 | 2026-06-23T00:00:00Z | 接受 7 节点编排；侧栏 select_records_page；N5 subagent；Modal 单条记录 | AskUserQuestion |

## 节点执行追踪
| 节点 | 框架绑定 | 执行模式(Gate 1 选定) | 调用证明 | 状态 |
|------|---------|---------------------|---------|------|
| NS | recon+scope | current-agent | native:Read | ✅ |
| N1 | grill-with-docs | current-agent | Gate1 AskUserQuestion | ✅ |
| N3 | openspec | current-agent | native:spec章节 | ✅ |
| N4 | writing-plans | current-agent | native:tasks | ✅ |
| N5 | test-driven-development | subagent | Task(subagent) | ✅ |
| N6 | requesting-code-review | current-agent | native:review | ✅ |
| N7 | verification-before-completion | current-agent | Shell:test+build | ✅ |

## 决策与归档（ADR）       <!-- N8 -->
N/A
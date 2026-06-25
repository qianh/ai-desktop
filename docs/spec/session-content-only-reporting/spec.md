---
feature: session-content-only-reporting
executor: codex
scores: { 规模: M, 风险: H, 项目: 老, 领域清晰度: 模糊 }
nodes: [NS, N1, N2, N3, N4, N5, N7, N6, N8]
flavors: { NS: codebase-analyzer, N1: grill-with-docs, N2: grill-with-docs, N3: openspec, N4: writing-plans, N5: tdd-guard, N7: native-review, N6: native-verify, N8: native-archive }
execution_modes: { NS: current-agent, N1: current-agent, N2: current-agent, N3: current-agent, N4: current-agent, N5: current-agent, N7: current-agent, N6: current-agent, N8: current-agent }
deps_check: { codebase-analyzer: ok, grill-with-docs: ok, openspec: ok, writing-plans: ok, task-master: ok, tdd-guard: ok_hook_preflight_required, native-review: allowed, native-verify: allowed, native-archive: allowed }
status: done
spec_commit: "4d94bfa"
goal_condition: "当 bun run test -- src/api.uploadIntercepts.test.ts src/lib/sanitizeForUpload.test.ts src/lib/conversationFilter.test.ts 与 bun run build 退出码均为 0，且新增/更新测试断言 Supabase POST payload 只包含现有逻辑判定为会话的 row、非会话 row 完全不 POST、会话 row 沿用现有 sanitize/classify 上传逻辑时，本次工作完成"
goal_condition_waived: false
goal_condition_waiver_reason: ""
ui_contract:
  state: not_applicable
  fidelity: ""
  source_ids: []
  waiver_reason: ""
  system_reference: ""
created: 2026-06-25
---

# session-content-only-reporting · Spec

## 项目意图与约束
- 已决策 ADR / 项目边界：
  - AppScope 是 macOS Tauri v2 + React + TypeScript 的页面启动与 HTTP(S) 捕获客户端。
  - Chrome Session MVP 只覆盖用户主动添加和启动的页面/会话；透明捕获、恶意流量工具、敏感应用抓取均为非目标。
  - WebView fetch 拦截链路已存在：页面 hook 产生 `InterceptedFetch`，前端上传到 Supabase `intercepts` 表。
  - Page 级「拦截与上报」开关默认关闭已存在；本需求是在开启后继续收紧云端上报内容。
- 活跃演进方向：
  - 最近提交集中在 WebView 拦截、Supabase 上报、会话记录列表、上传过滤与 UI 主题。
- 不可违背的约束：
  - 隐私优先：上报边界必须可测试，不得把非会话正文、敏感 headers/cookies 或无关响应体带到云端。
  - 命令：`bun run test`、`bun run build`、必要时 `cargo test --manifest-path src-tauri/Cargo.toml`。
  - 当前工作区已有用户改动，后续实现不得回退无关改动。
- Recon 读取的意图文档：
  - README.md
  - CONTEXT.md
  - docs/COMMANDS.md
  - docs/STANDARDS.md
  - docs/spec/page-reporting-toggle/spec.md
  - docs/spec/webview-content-intercept/spec.md
  - docs/spec/session-records-list-modal/spec.md
  - AppScope 产品与技术说明文档.md
  - git log --oneline -30

## 涉及服务 / 跨仓范围
- 当前项目：`/Users/hong/John/ai/ai-desktop`，Tauri v2 桌面单仓，包含 React 前端与 Rust shell。
- 关联服务 / 仓：
  - 本仓 `src/`：上传入口、会话识别、上传清洗、会话记录读取与展示。本轮必读/高概率改动点：`src/api.ts`、`src/lib/sanitizeForUpload.ts`、`src/lib/conversationFilter.ts`、`src/types.ts` 及对应测试。
  - 本仓 `src-tauri/`：本需求不改变底层 WebView fetch hook、Page 上报开关或 SQLite 页面模型；仅当 N1 决定“拦截阶段也不要收集非会话数据”时才纳入。
  - Supabase 外部服务：`intercepts` 表写入目标；初判不改 schema，但必须验证 `POST /rest/v1/intercepts` payload 边界。
- 关联 API / 配置 / DB / 回调链路：
  - `uploadInterceptsToSupabase(pageId, items, config)`：当前会把每条 intercept 经 `classifyInterceptForStorage` + `sanitizeInterceptForUpload` 后整体 POST。
  - `sanitizeInterceptForUpload`：当前只做 null byte / binary placeholder 清洗，不做“只保留会话内容”的语义裁剪。
  - `classifyInterceptForStorage`：当前只写 `is_conversation`、`preview_text`、`conversation_id` 元信息，仍保留原始 `req_body`/`resp_body`。
  - `messagesFromIntercept` / `aggregateConversationMessages`：已有会话消息抽取能力，可作为“只上报会话消息文本”的基础。
  - `fetchReportedIntercepts` / `fetchFilteredConversationIntercepts` / `resolveConversationMessages`：读取 Supabase 会话记录；需要兼容新 payload 形态。
- 完整功能边界：
  - Gate 1 已确认：本仓前端 + Supabase，上游 Rust 暂不改。
  - N1 已确认：上传前按现有会话分类过滤；会话行沿用现有上传逻辑；非会话行完全不 POST。

## 用户原始要求与证据
| ID | 来源 | 原文/附件/链接 | 解释等级 | 是否绑定 | 对应需求/非目标 | 验收方式 |
|---|---|---|---|---|---|---|
| SRC-001 | 用户消息 | `$spec 拦截和上报，只上报会话的内容，其余内容不上报` | binding | 是 | FR-001/FR-002/FR-003 | N6 |
| SRC-002 | 用户选择 | N1 第一题选择 A：只上传会话行；保留最小元数据用于列表/详情检索，正文只保留用户/AI 消息文本；非会话行完全不 POST | partially_superseded | 部分 | 会话过滤与非会话不上报仍绑定；正文改写部分被 SRC-005 覆盖 | N3/N6 |
| SRC-003 | 用户选择 | N1 第二题曾选择 A：`req_body` 保存用户消息文本，`resp_body` 保存 AI 消息文本；后续被 SRC-005 修正 | superseded | 否 | 被 SRC-005 覆盖 | N/A |
| SRC-004 | 用户选择 | N1 第三题选择 A：只约束云端 Supabase 上报；本地 InterceptPanel 仍可显示当前页面的全部拦截用于调试 | binding | 是 | 非目标：本地拦截展示过滤 | N6 |
| SRC-005 | 用户澄清 | “上传前判断一下是不是会话，是会话就上报，不是就不上报，其余的都是按照现有的逻辑” | binding | 是 | FR-现有上传逻辑 + 会话过滤 | N3/N6 |

## 问题与非目标
- 要解决什么痛点 / 用户是谁：
  - 痛点：Page 上报开启后，当前 Supabase 上传会把会话与非会话 intercept 一并上报，且会话行仍可能携带原始 HTTP `req_body` / `resp_body`，隐私边界过宽。
  - 用户：AppScope 桌面端用户，在本地调试页面请求，同时希望云端只沉淀可浏览的会话文本。
- 代码侧已确认：
  - 现在上传路径会把会话/非会话 intercept 一并 POST。
  - 现在 `is_conversation=false` 仍可能带着原始 `req_body`/`resp_body` 上云。
  - 会话记录视图需要最小元数据进行列表、排序、分页和详情聚合。
- 真实意图（N1 决策）：
  1. Supabase 只上传会话行；非会话拦截完全不 POST。
  2. 会话判断、`preview_text`、`conversation_id`、`is_conversation` 等字段继续沿用现有 `classifyInterceptForStorage` 逻辑。
  3. 会话行的上传内容继续沿用现有 `sanitizeInterceptForUpload` 逻辑；不额外改写 `req_body` / `resp_body` 为消息文本，不额外清空 headers。
  4. 不改 Supabase schema，兼容现有 `intercepts` 表。
  5. 只约束云端上报；本地 InterceptPanel 继续显示当前页面全部拦截用于调试。
- 非目标：
  - 不改 WebView hook 或 Rust 拦截链路。
  - 不过滤本地 InterceptPanel / 前端本地状态。
  - 不上传非会话行的元数据或正文。
  - 不新增 Supabase `messages` JSONB 列。
  - 不重写会话记录 UI。
  - 不做会话正文消息文本归一化。
  - 不改变现有 header/body sanitize 策略。
- 失败路径：
  - 会话分类失败：该 intercept 不上传，避免非会话内容进入 Supabase。
  - Supabase 旧数据仍含原始 body：本轮不做历史清洗；读取逻辑保持兼容。
  - 上传失败：沿用现有 Supabase 错误抛出与调用端处理，不为隐私裁剪新增静默吞错。
- goal_condition 同步：
  - 目标条件修正为：测试必须证明非会话行没有进入 POST payload；会话行仍按现有 sanitize/classify 逻辑上传。

## UI 输入合同
| 字段 | 值 |
|---|---|
| state | not_applicable |
| UI 稿来源 | N/A |
| 保真等级 | N/A |
| 放权记录 | N/A |
| 现有设计系统 | N/A |
| N6 验收方式 | N/A |

## 约束冲突登记
| ID | 约束 A | 约束 B | 冲突说明 | 用户决策 | 状态 |
|---|---|---|---|---|---|
| N/A | N/A | N/A | 暂无 | N/A | resolved |

## 领域词表
| 术语 | 本次定义 | 代码锚点 / 约束 |
|---|---|---|
| 拦截 | WebView 中本地 fetch hook 捕获当前页面请求/响应，用于本地调试面板 | `InterceptedFetch`、`InterceptPanel`；本轮不改变本地拦截能力 |
| 上报 | 将拦截数据通过 Supabase REST 写入 `intercepts` 表 | `uploadInterceptsToSupabase`；本轮隐私边界只约束这里 |
| 会话行 | 现有会话分类逻辑判定为会话的 intercept 行 | `classifyInterceptForStorage(...).isConversation === true` |
| 非会话行 | 分析、埋点、工具、静态资源、初始化、无法抽出用户/AI 消息的 intercept 行 | 本轮完全不 POST 到 Supabase |
| 会话内容 | 按现有上传逻辑保留的会话 intercept 内容 | 本轮不改写 `req_body` / `resp_body`；只过滤非会话行 |
| 上报过滤 | 上传前从 batch 中移除非会话行 | 发生在 `uploadInterceptsToSupabase` POST 前 |
| 历史数据 | 本轮之前已写入 Supabase 的旧 rows | 本轮读取兼容，不做迁移清洗 |

## 需求
### 功能需求
- **FR-001** Supabase 上传前必须过滤 intercept batch：只有现有会话分类逻辑判定为会话的行才允许进入 POST payload。
- **FR-002** 非会话 intercept 必须完全不 POST 到 Supabase，包括其元数据与正文。
- **FR-003** 会话行上传内容继续沿用现有逻辑：`sanitizeInterceptForUpload` 处理原 row，`classifyInterceptForStorage` 写入 `preview_text`、`is_conversation`、`conversation_id`。
- **FR-004** 本地 WebView 拦截、本地 React 状态和 InterceptPanel 调试展示保持不变。
- **FR-005** 不改变 Supabase schema；继续使用现有 `intercepts` 表字段。

### 非功能需求
- **NFR-001** 隐私边界必须由单元测试锁定：非会话不上报。
- **NFR-002** 读取旧数据保持兼容；历史 Supabase row 不做迁移清洗。
- **NFR-003** 上传错误处理沿用现有行为，不为过滤逻辑新增静默吞错。

## Gate 审计记录
| Gate | 时间 | 决策摘要 | 确认方式 |
|---|---|---|---|
| Gate 1 编排闸 | 2026-06-25 | 用户确认 A1/B1/C1/D1：接受 9 节点、高风险、当前 agent 执行、N4 保持 o3；Scope 为本仓前端 + Supabase，Rust 暂不改 | 用户消息 |
| Gate 2 N3 规格定稿 | 2026-06-25 | 用户确认修正版 N3：上传前判断会话；会话按现有逻辑上报；非会话不上报 | 用户消息 |
| Gate 2 N7 审查确认 | 2026-06-25 | N7 无已核实 finding；用户要求先执行 N6，随后继续 N8 | 用户消息 |

## 节点执行追踪
| 节点 | 框架绑定 | 执行模式 | 调用证明 | 状态 |
|---|---|---|---|---|
| NS | codebase-analyzer | current-agent | CodeGraph + 源码/测试读取，按 import/调用链确认范围 | ✅ |
| N1 | grill-with-docs | current-agent | 三轮边界拷问：上报范围、正文存储、本地展示边界 | ✅ |
| N2 | grill-with-docs | current-agent | 基于代码与用户决策对齐术语 | ✅ |
| N3 | openspec | current-agent | `openspec validate session-content-only-reporting` → valid；用户已确认修正版定稿 | ✅ |
| N4 | writing-plans | current-agent | `docs/superpowers/plans/2026-06-25-session-content-only-reporting.md` + OpenSpec `tasks.md` | ✅ |
| N5 | tdd（TDD Guard 预检后 fallback） | current-agent | RED: `bun run test -- src/api.uploadIntercepts.test.ts` 2 failed；GREEN: 同命令 9 passed | ✅ |
| N7 | native-review | current-agent | 亲自复读 `src/api.ts:339-374` 与 `src/api.uploadIntercepts.test.ts:1-257`；无已核实 finding | ✅ |
| N6 | native-verify | current-agent | OpenSpec valid；focused tests 16 passed；all tests 113 passed；build passed | ✅ |
| N8 | native-archive | current-agent | 本节 ADR 归档；status=done | ✅ |

## 数据模型 / API / UI / 兼容 / 权限
### 上传 payload
`uploadInterceptsToSupabase(pageId, items, config)` 生成 rows 时：
- 先对每个 `item` 执行现有 `classifyInterceptForStorage(item)`。
- 仅保留 `meta.isConversation === true` 的 item。
- 对保留 item 继续执行现有 `sanitizeInterceptForUpload(item)`，并按现有逻辑补充 `page_id`、`preview_text`、`is_conversation`、`conversation_id`。
- 若过滤后 rows 为空，不发起 Supabase POST。

### 兼容
- Supabase schema 不变：不新增 `messages` / JSONB 列。
- 会话记录列表继续依赖 `preview_text`、`conversation_id`、`timestamp` 等元数据。
- 旧数据读取路径保持兼容，仍可解析历史原始 body。

### 权限 / 安全
- 不新增 Tauri command 或系统权限。
- 不改 WebView hook，不改本地 InterceptPanel。

## 验收标准
- **AC-001** 混合 batch 上传时，Supabase POST body 只包含现有分类逻辑判定为会话的 row。
- **AC-002** 非会话 row 不出现在 POST body 中。
- **AC-003** 上传的会话 row 仍保留现有 `sanitizeInterceptForUpload` 结果与 `preview_text`、`is_conversation=true`、`conversation_id` 等字段。
- **AC-004** 当 batch 全部为非会话 row 时，不发起 Supabase POST。
- **AC-005** 本地 InterceptPanel 仍能接收并展示全部本地 intercept。
- **AC-006** `openspec validate session-content-only-reporting`、目标 vitest 和 `bun run build` 通过。

## 测试策略
- **OpenSpec 校验**：`openspec validate session-content-only-reporting`。
- **上传单测**：更新 `src/api.uploadIntercepts.test.ts`，覆盖混合 batch 只上传会话、纯非会话 batch 不 POST、会话 row 沿用现有 sanitize/classify 字段、Supabase 错误仍抛出。
- **分类单测**：保留/补充 `src/lib/conversationFilter.test.ts`，确保关键会话格式仍会被现有逻辑判定为会话。
- **清洗单测**：保留 `src/lib/sanitizeForUpload.test.ts` 对 null byte / binary helper 的测试。
- **构建验收**：`bun run build`。

## 任务拆解
### T-001 · 上传过滤测试
**为何做：** 先锁定隐私边界，证明非会话行不会进入 Supabase POST payload。
**文件路径：** `src/api.uploadIntercepts.test.ts:29-210`

当前代码摘录：
```ts
await uploadInterceptsToSupabase("page-1", [noise], config);
const row = JSON.parse(postedBody)[0] as InterceptedFetch;
expect(row.is_conversation).toBe(false);
expect(row.preview_text).toBeNull();
```

**scope 边界：** in-scope: [`src/api.uploadIntercepts.test.ts`] | out-of-scope: [`src/api.ts`, `src/lib/conversationFilter.ts`, UI, Rust]

**有序步骤：**
1. 增加 mixed batch 测试：一个会话 row + 一个非会话 row → 验证命令: `bun run test -- src/api.uploadIntercepts.test.ts` → 期望输出: 该新增测试在实现前失败，显示 POST body 仍包含非会话 row。
2. 增加 all-non-conversation 测试：全部输入为非会话 row → 验证命令: `bun run test -- src/api.uploadIntercepts.test.ts` → 期望输出: 该新增测试在实现前失败，显示 `fetch` 被调用。
3. 更新现有 utility `/_serverFn` 非会话测试：从“上传 `is_conversation=false`”改为“不进入 POST payload”。

**Done 标准（可机器执行 + transcript-verifiable）：** `bun run test -- src/api.uploadIntercepts.test.ts` 在实现前出现预期失败；N5 实现后同命令退出码 0 且输出包含 `src/api.uploadIntercepts.test.ts` 全部测试通过。
**测试计划：** Vitest 只跑 `src/api.uploadIntercepts.test.ts`，避免引入 UI/E2E。
**逃生口：** 如果无法稳定构造非会话样本，STOP 并回到 N3 明确“会话分类”的测试样本边界，不得改生产逻辑迁就测试。

### T-002 · 上传边界实现
**为何做：** 在唯一云端写入入口过滤非会话 row，保持本地拦截与会话行现有上传逻辑不变。
**文件路径：** `src/api.ts:339-372`

当前代码摘录：
```ts
const rows = items.map((item) => {
  const meta = classifyInterceptForStorage(item);
  const sanitized = sanitizeInterceptForUpload(item);
  return {
    ...sanitized,
    page_id: pageId,
    preview_text: sanitizePostgresText(meta.previewText),
    is_conversation: meta.isConversation,
    conversation_id:
      meta.conversationId != null ? stripNullBytes(meta.conversationId) : meta.conversationId,
  };
});
```

**scope 边界：** in-scope: [`src/api.ts`, `src/api.uploadIntercepts.test.ts`] | out-of-scope: [`src/lib/conversationFilter.ts` 分类规则重写, `src/lib/sanitizeForUpload.ts` 清洗策略, Supabase schema, Rust/WebView hook, InterceptPanel UI]

**有序步骤：**
1. 将 `items.map(...)` 调整为“分类 → 过滤 `meta.isConversation !== true` → 保留会话 row 的现有 sanitize/enrich 逻辑” → 验证命令: `bun run test -- src/api.uploadIntercepts.test.ts` → 期望输出: mixed batch / all-non-conversation 测试通过。
2. 过滤后 `rows.length === 0` 时，在构造 POST 前直接 `return` → 验证命令: `bun run test -- src/api.uploadIntercepts.test.ts` → 期望输出: `fetch` 未被调用的测试通过。
3. 确认 Supabase 错误抛出测试仍保留 → 验证命令: `bun run test -- src/api.uploadIntercepts.test.ts` → 期望输出: 错误测试仍通过。

**Done 标准（可机器执行 + transcript-verifiable）：** `bun run test -- src/api.uploadIntercepts.test.ts` 退出码 0，且测试断言会话 row 仍包含现有 `preview_text`、`is_conversation=true`、`conversation_id` 字段。
**测试计划：** 聚焦上传单测；本任务不跑 build，留给 N6。
**逃生口：** 如果实现需要改 `classifyInterceptForStorage` 才能通过测试，STOP 并回到 N3/N4，因为这超出“只在上传前过滤”的定稿范围。

### T-003 · 规格与回归验证
**为何做：** 确保 OpenSpec、目标单测、构建都与定稿规格一致。
**文件路径：** `openspec/changes/session-content-only-reporting/specs/conversation-content-reporting/spec.md`、`docs/spec/session-content-only-reporting/spec.md`

当前代码摘录：
```md
### Requirement: Upload only conversation rows
The system SHALL include an intercepted row in the Supabase upload payload only when the existing conversation classification logic marks that row as a conversation.
```

**scope 边界：** in-scope: [OpenSpec change, focused Vitest, build] | out-of-scope: [新功能实现, schema migration, UI截图]

**有序步骤：**
1. 运行 `openspec validate session-content-only-reporting` → 期望输出: `Change 'session-content-only-reporting' is valid`。
2. 运行 `bun run test -- src/api.uploadIntercepts.test.ts src/lib/sanitizeForUpload.test.ts src/lib/conversationFilter.test.ts` → 期望输出: 目标测试全部通过。
3. 运行 `bun run build` → 期望输出: TypeScript 与 Vite build 退出码 0。

**Done 标准（可机器执行 + transcript-verifiable）：** 三条命令均退出码 0，并在 N6 验证记录中粘贴关键输出。
**测试计划：** N6 cheapest-first：focused vitest → build → goal_condition。
**逃生口：** 若 focused tests 通过但 build 因无关脏工作区失败，STOP 上报失败文件与错误，不回退用户已有改动。

## 实现与测试记录
- TDD Guard 预检：
  - 已安装 `tdd-guard`，但本环境中它是 Claude Code hook 型工具，当前 Codex `apply_patch` 不会被其真实拦截。
  - 按用户 N5 前选项 C1，fallback 到已安装 `tdd` skill 红绿流程。
- RED：
  - 命令：`bun run test -- src/api.uploadIntercepts.test.ts`
  - 输出摘要：9 tests，2 failed；失败点为非会话 utility row 仍触发 POST、mixed batch 仍上传 2 rows。
- GREEN：
  - `src/api.ts`：`uploadInterceptsToSupabase` 改为分类后过滤 `meta.isConversation !== true`，过滤后 rows 为空则 return。
  - `src/api.uploadIntercepts.test.ts`：新增/更新 mixed batch、纯非会话不 POST、会话 row 保持现有 sanitize/classify 的测试。
  - 命令：`bun run test -- src/api.uploadIntercepts.test.ts`
  - 输出摘要：1 passed test file，9 passed tests。

## 审查记录
### N7 Findings
- 无已核实 finding。

### 审查依据
- `src/api.ts:347-361`：过滤发生在 Supabase POST 前，且仅跳过 `meta.isConversation !== true`；会话 row 仍沿用 `sanitizeInterceptForUpload`、`preview_text`、`is_conversation`、`conversation_id` 原逻辑。
- `src/api.uploadIntercepts.test.ts:142-157`：纯非会话 utility `/_serverFn` row 不触发 `fetch`。
- `src/api.uploadIntercepts.test.ts:159-191`：mixed batch 只上传会话 row，且 `preview_text` / `is_conversation` 保持现有逻辑。
- `src/api.uploadIntercepts.test.ts:218-240`：会话 row 仍走现有 null-byte/header sanitize。

### Considered and rejected
- “TDD Guard 没有真实拦截”不是代码 finding：已按 Gate 选择 fallback 到 `tdd` skill，并记录在 N5。
- “会话 row 仍上传原始 body/header”不是 finding：用户已澄清本轮只过滤非会话，保留现有会话上传逻辑。

## 验证记录（DoD）
- [x] 所有测试通过  [x] lint（N/A：`package.json` 无 lint script）  [x] typecheck  [x] build
- [x] 新增逻辑有测试  [x] 修改行为有回归  [x] 无无关 diff  [x] 无绕过测试
- [x] goal_condition 成立（最终验收，见 front-matter）
- 本次 N6 复验时间：2026-06-25 16:42 Asia/Shanghai。

### 命令记录
```text
openspec validate session-content-only-reporting
→ Change 'session-content-only-reporting' is valid
```

```text
bun run test -- src/api.uploadIntercepts.test.ts src/lib/sanitizeForUpload.test.ts src/lib/conversationFilter.test.ts
→ Test Files 3 passed (3)
→ Tests 16 passed (16)
```

```text
bun run test
→ Test Files 11 passed (11)
→ Tests 113 passed (113)
```

```text
bun run build
→ tsc --noEmit && vite build
→ 321 modules transformed
→ built in 3.08s
```

### 意图覆盖率追踪
| 意图（N1 逼出） | spec 章节 | 实现任务 | N6 验证命令 + 期望输出 | 状态 |
|---|---|---|---|---|
| Supabase 只上传会话行 | FR-001/FR-002 | T-001/T-002 | `bun run test -- src/api.uploadIntercepts.test.ts` → mixed batch only conversation row; utility row no fetch | ✅ |
| 会话行沿用现有上传逻辑 | FR-003 | T-001/T-002 | `bun run test -- src/api.uploadIntercepts.test.ts` → preview/conversation_id/sanitize tests pass | ✅ |
| 本地拦截展示不变 | FR-004 | T-002 | 代码范围未改 UI/Rust；all tests/build pass | ✅ |
| 不改 Supabase schema | FR-005 | T-003 | `openspec validate session-content-only-reporting` + no schema file diff | ✅ |

### UI 验收记录
| ui_contract.state | 验收规则 | 证据 | 状态 |
|---|---|---|---|
| not_applicable | N/A | N/A | ✅ |

## 需求追溯矩阵
| Requirement | Spec | Task | Test | Status |
|---|---|---|---|---|
| Upload only conversation rows | OpenSpec conversation-content-reporting | T-001/T-002 | `src/api.uploadIntercepts.test.ts` | ✅ |
| Preserve existing conversation upload shape | OpenSpec conversation-content-reporting | T-001/T-002 | `src/api.uploadIntercepts.test.ts` | ✅ |
| Keep local interception unchanged | OpenSpec conversation-content-reporting | T-002 | no UI/Rust diff + build | ✅ |
| Avoid schema migration | OpenSpec conversation-content-reporting | T-003 | no `docs/supabase` diff + OpenSpec valid | ✅ |

## 决策与归档（ADR）
### ADR-001 · 在 Supabase 上传边界过滤非会话行
- **状态：** accepted
- **时间：** 2026-06-25 16:50 CST
- **决策：** 在 `uploadInterceptsToSupabase` 生成 Supabase POST rows 时，先沿用 `classifyInterceptForStorage(item)` 判断是否为会话；只有 `meta.isConversation === true` 的 item 才进入上传 payload。会话行继续使用现有 `sanitizeInterceptForUpload(item)` 和现有 metadata enrichment；过滤后 rows 为空时不发起 Supabase POST。
- **原因：** 用户最终确认“上传前判断一下是不是会话，是会话就上报，不是就不上报，其余都是按照现有逻辑”。因此本轮最小、可测、低迁移风险的边界是云端上传入口，而不是改底层拦截或重塑数据模型。
- **验证证据：** N6 已复验 `openspec validate session-content-only-reporting`、聚焦 Vitest、全量 Vitest、`bun run build` 均通过。

### 被否方案
- **改写 `req_body` / `resp_body` 为用户消息文本 / AI 消息文本：** rejected。该方向来自早期 N1 选择，但被用户后续澄清覆盖；本轮保持会话行现有上传逻辑。
- **额外清空或改写 headers / 原始 JSON / SSE / Seroval：** rejected。本轮不新增 sanitize 策略，只保留现有 `sanitizeInterceptForUpload` 行为。
- **上传非会话最小元数据：** rejected。用户要求“其余内容不上报”，非会话 row 完全不 POST。
- **新增 Supabase `messages` / JSONB schema：** rejected。当前读取链路兼容现有 `intercepts` 表；本轮不做 schema migration。
- **修改 Rust/WebView hook 或本地 InterceptPanel：** rejected。本轮只约束云端上报；本地调试视图继续保留全部本地拦截。

### 边界变化
- **新增边界：** Supabase `intercepts` 上传 payload 只包含现有逻辑判定为会话的 rows。
- **未变边界：** 本地拦截、本地 React 状态、会话分类规则、上传清洗策略、Supabase schema、旧数据读取兼容。
- **失败策略：** 分类结果不是会话时默认不上报；上传失败仍沿用原 Supabase 错误抛出。

### 后续注意
- 历史 Supabase 数据可能仍包含旧的非会话 rows 或旧 body 形态；本轮不做迁移/清洗。
- 如果未来要实现“会话 row 只上传抽取后的消息文本”，需要重新开 spec，因为那会改变 payload 语义、会话记录读取和历史兼容策略。

---
feature: independent-webview-data-store
executor: claude-code
scores: { 规模: L, 风险: M, 项目: 老, 领域清晰度: 清晰 }
nodes: [NS, N5, N7]
flavors: { N1: grill-with-docs }
execution_modes: {}
deps_check: { grill-with-docs: ok, "superpowers:test-driven-development": ok, "superpowers:verification-before-completion": ok }
status: done
spec_commit: ""
goal_condition: "当 `cargo test --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5` 包含 `test result: ok` 且 `grep -n 'data_store_identifier' src-tauri/src/page_webview.rs` 有匹配时，本次工作完成"
goal_condition_waived: true
goal_condition_waiver_reason: "全库 test result: FAILED 由 cert::tests 两个 pre-existing 失败导致（git stash 验证），与本次改动无关。page_webview 专项 7/7 通过，build 通过，AC-002 满足。用户 2026-06-24 明确豁免。"
created: 2026-06-24
---

# independent-webview-data-store · Spec

## 项目意图与约束         <!-- NS-A Recon -->
- 已决策 ADR：Chrome Session 独立 profile 隔离是首选方案（Chrome 启动模式）；WKWebView 内置页面采用 AppScope 内嵌 WebviewBuilder 方式
- 活跃演进方向（git log 近 30 条）：页面切换 show/hide 复用 webview 实例、拦截上报开关、会话记录 Markdown 渲染、移除原生 App 管理功能
- 不可违背的约束：Tauri v2 (`tauri = "2"`) + wry 0.55.1，`uuid` crate 已在依赖中（features = ["v4"]）；macOS only；`unstable` feature 已启用
- Recon 读取的意图文档：AppScope 产品与技术说明文档.md, CONTEXT.md, src-tauri/src/page_webview.rs, Cargo.toml, Cargo.lock

## 涉及服务 / 跨仓范围
- 当前项目：macOS 桌面客户端（Tauri v2 + Rust 后端 + React/TS 前端）
- 关联改动面：仅 `src-tauri/src/page_webview.rs` 的 `mount_page_webview` 函数
- 无后端 API 变更，无前端变更，无数据库 schema 变更

## 问题与非目标            <!-- N1 待填 -->
- 要解决什么痛点：当前所有 Page WebView 共享同一个默认 WKWebsiteDataStore，导致不同 Page 之间 Cookie/LocalStorage/缓存互相污染
- 非目标：不修改 Chrome 独立 profile 模式（那已有隔离）；不做 App 级别的 WebView 隔离；不清理历史 data store；macOS 14 以下降级到 defaultDataStore（现有 wry 行为不变）
- 失败路径：page_id 无法解析为 UUID 时需要安全降级（不能 panic）

## 领域词表                <!-- N/A -->

## 需求                    <!-- N1 → N3 待填 -->
- FR-001：`mount_page_webview` 为每个 page_id 派生一个稳定的 `[u8; 16]` 标识符，通过 `WebviewBuilder::data_store_identifier` 传递给 wry/WKWebView
- FR-002：page_id 为合法 UUID 字符串时，直接使用其字节作为标识符
- FR-003：page_id 不是合法 UUID 时，安全降级（使用零填充或截断的 bytes）

## 数据模型 / API / UI / 兼容 / 权限
- 仅 `mount_page_webview` 签名不变，内部实现增加一行 `builder = builder.data_store_identifier(uuid_bytes)`
- macOS 14+ (Sonoma)：独立 `WKWebsiteDataStore`，按 UUID 隔离 Cookie/缓存
- macOS 13 以下：wry 自动回退到 `defaultDataStore`（行为与改前相同）

## 验收标准
- AC-001：`cargo test --manifest-path src-tauri/Cargo.toml` 全通过
- AC-002：`grep 'data_store_identifier' src-tauri/src/page_webview.rs` 有匹配
- AC-003：新增单元测试覆盖「合法 UUID page_id」和「非法 UUID page_id」两路

## 测试策略
- 单元测试：`page_webview.rs` 新增 `page_id_to_data_store_uuid` 测试（合法/非法 UUID）
- 集成测试：N/A（WebView 挂载需要 macOS 运行时）

## 任务拆解                <!-- N/A（规模 L，直接 N5） -->

## 实现与测试记录          <!-- N5 -->

## 审查记录                <!-- N/A（规模 L，无 N6） -->

## 验证记录（DoD）         <!-- N7 -->
- ✅ page_webview 专项测试：`cargo test page_webview` → `test result: ok. 7 passed; 0 failed`（含3个新测试）
- ⏭️ BLOCKED: 全库测试 `cargo test --lib` → `29 passed; 2 failed`（cert::tests::* pre-existing，与本次改动无关，git stash 前后一致）
- ✅ build：`cargo build` → `Finished dev profile`
- ✅ AC-002：`grep 'data_store_identifier' src-tauri/src/page_webview.rs` → line 91 匹配
- ⏭️ BLOCKED+waived: goal_condition 全库 ok — cert pre-existing 失败，用户 2026-06-24 明确豁免

### 意图覆盖率追踪
| 意图（N1 逼出） | spec 章节 | 实现任务 | N7 验证命令 + 期望输出 | 状态 |
|---|---|---|---|---|
| 每个 Page 用独立 WKWebsiteDataStore | 需求 FR-001 | T-inline | `grep 'data_store_identifier' src-tauri/src/page_webview.rs` → line 91 匹配 | ✅ |
| page_id 为 UUID 时直接用字节 | 需求 FR-002 | T-inline | `cargo test page_webview` → 7 passed 0 failed | ✅ |
| page_id 非 UUID 时安全降级 | 需求 FR-003 | T-inline | `cargo test page_webview` → 7 passed 0 failed | ✅ |

## Gate 审计记录
| Gate | 时间 | 决策摘要 | 确认方式 |
|------|------|---------|---------|
| Gate 1 编排闸 | 2026-06-24T00:00:00Z | 跳过 N1（需求清晰，单文件改动）；N5 当前 agent；节点集 NS→N5→N7 | AskUserQuestion |
| Gate 2 N3 定稿 | N/A | 规模 L 跳过 N3 独立定稿闸 | N/A |
| Gate 2 N6 审查 | N/A | 规模 L 跳过 N6 | N/A |

## 节点执行追踪
| 节点 | 框架绑定 | 执行模式 | 调用证明 | 状态 |
|------|---------|---------|---------|------|
| NS-A Recon | current-agent 直读 | current-agent | Read(page_webview.rs, Cargo.toml, CONTEXT.md等) | ✅ |
| NS-B Scope | current-agent 直读（单仓单文件） | current-agent | Read(page_webview.rs, Cargo.toml) | ✅ |
| N1 | — | Gate 1 跳过 | — | ⏭️ SKIPPED(Gate 1 用户确认) |
| N5 | superpowers:test-driven-development | current-agent | Skill("superpowers:test-driven-development") | ✅ |
| N7 | superpowers:verification-before-completion | current-agent | Skill("superpowers:verification-before-completion") | ✅ |

## 决策与归档（ADR）       <!-- N8 -->

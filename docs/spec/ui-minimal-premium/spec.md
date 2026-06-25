---
feature: ui-minimal-premium
executor: codex
scores: { 规模: M, 风险: L, 项目: 老, 领域清晰度: 清晰 }
nodes: [NS, N1, N3, N4, N5, N6, N7]
flavors: { N1: grill-with-docs, N3: openspec, N4: writing-plans, N5: test-driven-development, N6: requesting-code-review }
execution_modes: {}
deps_check: { grill-with-docs: ok, writing-plans: ok, test-driven-development: ok, requesting-code-review: ok, verification-before-completion: ok, openspec: ok }
execution_modes: { NS: current-agent, N1: current-agent, N3: current-agent, N4: current-agent, N5: current-agent, N6: current-agent }
status: reviewing
spec_commit: ""
goal_condition: "当 bun run build 退出码为 0 且 bun run test 退出码为 0 时为真"
goal_condition_waived: false
goal_condition_waiver_reason: ""
created: 2026-06-25
---

# UI 简约高端化 · Spec

## 项目意图与约束         <!-- NS-A Recon -->

- 已决策 ADR（不再讨论的方向）：
  - 技术栈固定：Tauri v2 + React 18 + TypeScript + Vite 5，**无 CSS 框架**
  - 样式方案：inline styles + CSS 变量（`index.css`），从 `AppScope.dc.html` 设计稿 1:1 移植
  - 产品定位：macOS 应用/页面启动器 + 按会话 HTTP(S) 抓包客户端（Chrome Session MVP）
  - 近期已完成：Light/Dark/System 主题切换 + 全量 CSS 变量化（commit `1a1069d`）
- 活跃演进方向（git log 近 30 条推断）：
  - 会话记录、WebView 拦截、侧边栏交互优化、主题系统
  - UI 持续从 DC 设计稿对齐，功能迭代优先于视觉打磨
- 不可违背的约束：
  - build: `bun run build`（tsc + vite build）
  - test: `bun run test`（vitest run）
  - 不引入 Tailwind/CSS-in-JS 框架
  - 保持 Tauri 桌面原生窗口体验（TitleBar、StatusBar）
  - 暗色/浅色主题均需兼容
- Recon 读取的意图文档：
  - `README.md`、`CONTEXT.md`、`.design-import/AppScope.dc.html`、`src/index.css`、`src/lib/ui.ts`

## 涉及服务 / 跨仓范围        <!-- NS-B Scope -->

- 当前项目：Tauri 桌面应用（前端 `src/` + Rust shell `src-tauri/`）
- 关联服务 / 仓：
  - **前端 `src/`**：主要改动面 — `index.css` 设计 token、`lib/ui.ts` 样式原子、各 `components/` 视觉层
  - **`src-tauri/`**：N/A（本次纯 UI，不涉及 Rust/API）
  - **Supabase**：N/A（上报逻辑不变）
- 关联 API / 配置 / DB：N/A
- 完整功能边界：仅视觉与交互微调，不改变业务逻辑、数据流、Tauri 命令

## 问题与非目标            <!-- N1 -->

- 要解决什么痛点 / 用户是谁：
  - AppScope 桌面客户端视觉偏「工程原型感」，需提升为简约、精致、高端气质
  - 用户希望在设置页切换多套视觉方案，而非锁死单一风格
- 已确认决策（N1）：
  - **多套风格预设**，每套自带 **Light + Dark** 配色 token
  - 某预设若无法区分明暗，允许 Light = Dark（同一 token 集）
  - 风格预设与明暗为两层：`data-style` × `data-theme`
  - 首批 4 套：**经典 · 极简 · 墨编 · 曜石**
  - **System** 保留：跟随 macOS 选择当前风格的 Light/Dark 变体
- 非目标（草案）：
  - 不引入 CSS 框架 / CSS-in-JS
  - 不改 Tauri/Rust 业务逻辑
  - 不改布局结构（A/B 变体、面板拖拽保留）
- 失败路径：
  - 预设过多导致 token 维护爆炸 → 限制 4 套 + 共用基础 token
  - 暗色对比度不足 → 每套 dark 独立校验 WCAG 近似对比

## 领域词表                <!-- N2，未跑 -->

N/A

## 需求                    <!-- N3，待跑 -->

N/A

## 验收标准                <!-- N3，待跑 -->

N/A

## 任务拆解                <!-- N4，待跑 -->

N/A

## 实现与测试记录          <!-- N5 -->

- `src/lib/appearance.ts` — StylePreset 类型、localStorage、applyAppearance
- `src/index.css` — 4 套 × Light/Dark token（`data-style` × `data-theme`）
- `src/components/Settings.tsx` — 2×2 风格卡片选择器 + 明暗 segment
- `src/App.tsx` / `src/main.tsx` — 状态管理与首屏无闪烁应用

## 审查记录                <!-- N6 -->

N/A（本轮未跑独立审查）

## 验证记录（DoD）         <!-- N7 -->

- [✅] 所有测试通过 — `bun run test` → 97 passed
- [✅] build — `bun run build` → exit 0
- [✅] goal_condition 成立

## Gate 审计记录

| Gate | 时间 | 决策摘要 | 确认方式 |
|------|------|---------|---------|
| Gate 1 编排闸 | 2026-06-25T00:00:00+08:00 | 接受 7 节点编排；openspec 已装 v1.4.0；风格=多套预设+设置页切换；N5=current-agent | AskUserQuestion |

## 节点执行追踪

| 节点 | 框架绑定 | 执行模式 | 调用证明 | 状态 |
|------|---------|---------|---------|------|
| NS-A | native:recon | current-agent | Read(README,CONTEXT,index.css,ui.ts) | ✅ |
| N1 | grill-with-docs | current-agent | AskUserQuestion×2 | ✅ |
| N5 | test-driven-development | current-agent | 实现+appearance.test.ts | ✅ |
| N7 | verification-before-completion | current-agent | bun run test && bun run build | ✅ |

## 决策与归档（ADR）       <!-- N8 -->

N/A
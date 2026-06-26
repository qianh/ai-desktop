---
name: page-favicon
status: done
spec_commit: ""
goal_condition: "侧边栏每个 Page 条目显示对应网站 favicon（img src=https://{hostname}/favicon.ico），加载失败回退字母图标；bun run typecheck && bun run build 均无错误退出"
goal_condition_waived: false
goal_condition_waiver_reason: ""
---

# Page Favicon 规格

## 项目意图与约束（NS-A Recon）

- 产品：枢境 — Tauri 桌面 app，嵌入网站 WebView + 拦截 HTTP 流量
- 现有图标：`PageIcon` 组件（`src/components/Sidebar.tsx:123`）渲染彩色字母方块
- 关键发现：`Page.host` 存的是完整 URL（`host: page.url`），需 `new URL(page.host).hostname` 提取纯域名
- 无跨仓/跨服务依赖；改动范围：纯前端单文件

## 涉及服务/仓范围（NS-B Scope）

N/A（单仓单组件改动）
- 主改动：`src/components/Sidebar.tsx` — `PageIcon` 组件
- 无需改动：`src/types.ts`、`src/lib/ui.ts`、Tauri 后端

## 问题与非目标（N1 拷问产出）

### 真实意图
用真实网站 favicon 替换侧边栏 Page 条目的字母图标，让用户一眼识别各页面对应的网站。

### 决策记录

| 决策 | 结论 |
|---|---|
| favicon 来源 | `https://{hostname}/favicon.ico`，hostname = `new URL(page.host).hostname` |
| 加载中行为 | 先显示字母图标（默认），`<img>` 加载成功后切换显示 |
| 加载失败行为 | `onError` 隐藏 img，保留字母图标 |
| 默认 Chat 页 | 一视同仁，同样替换 |
| 视觉容器 | 24×24、`borderRadius:6`、透明背景；favicon img 16×16 居中 |

### 非目标
- 不使用外部 favicon 服务（Google S2、DuckDuckGo 等）
- 不解析页面 HTML 的 `<link rel="icon">`
- 不做 favicon 本地缓存（浏览器 HTTP 缓存已足够）

## 验证（DoD）

| 项目 | 状态 |
|---|---|
| 侧边栏 Page 条目显示 favicon img | ✅ | TDD: 4/4 favicon 测试通过，img src 在 HTML 确认 |
| favicon 加载失败时回退字母图标 | ✅ | onError 隐藏 img，字母 span 保持；TDD 负面测试覆盖 |
| 默认 Chat 页同样显示 favicon | ✅ | chatPage PageIcon 两处均已传 host prop |
| 收起侧边栏时图标正常显示 | ✅ | 折叠态两处 PageIcon 均已传 host prop |
| `tsc --noEmit` 通过 | ✅ | exit 0，无错误输出 |
| `bun run build` 通过 | ✅ | 418kB 包构建成功，exit 0 |

## Gate 审计记录

| Gate | 时间 | 决策摘要 | 确认方式 |
|---|---|---|---|
| Gate 1 | 2026-06-26 | 接受 NS→N1→N5→N7 四节点编排，规模L/风险L，current-agent | AskUserQuestion |
| Gate 2 | N/A | 规模L跳过 N3 定稿闸 | — |

## 节点执行追踪

| 节点 | 调用证明 | 状态 |
|---|---|---|
| NS | advisor自读(current-agent) + N/A(无跨仓) | ✅ 完成 |
| N1 | Skill("grill-with-docs") | ✅ 完成 |
| N5 | Skill("superpowers:test-driven-development") | ✅ 完成 |
| N7 | Skill("superpowers:verification-before-completion") + native:tsc+build+test | ✅ 完成 |

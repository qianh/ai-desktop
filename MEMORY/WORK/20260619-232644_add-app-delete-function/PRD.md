---
task: Add delete capability for Apps in sidebar
slug: 20260619-232644_add-app-delete-function
effort: standard
phase: complete
progress: 13/13
mode: interactive
started: 2026-06-19T15:26:44Z
updated: 2026-06-19T15:34:00Z
---

## Context

侧边栏 PAGES 分组每一项都有 `×` 删除按钮（`onDeletePage` → `DeletePageModal` 确认 → `removePage` → `remove_page` 命令 → `store.delete_page`）。APPS 分组（如 DingTalk）的列表项是单个 `<button>`，没有删除入口。本任务为 APPS 补上与 PAGES 一致的删除能力：列表项内 `×` 按钮 + 确认弹窗 + 前端 API + Rust 后端命令 + SQLite 删除。

请求要点：
- 明确想要：给 apps 加删除功能（"补上"）
- 隐含想要：与 pages 删除体验一致（确认弹窗、删除后切换选中项）
- 明确不要：无（未限定）
- 隐含不要：不破坏 pages 现有删除、不重写现有组件、不引入与现状不一致的交互

技术事实（已核实）：
- apps 不产生 capture session（sessions.target_type 恒为 'page'），故 delete_app 只需删 apps 表一行
- 现有分离式弹窗约定：AddPageModal / AddAppModal 各自独立 → 新增 DeleteAppModal 与 DeletePageModal 并列最一致

### Risks
- App 行当前是单 `<button>`，加删除按钮需改为 `<div>` 包裹（item button + delete button），易误改选中/样式
- 删除当前选中的 App 后需正确切换 activeId，否则详情区空白
- 后端编译（cargo）耗时，验证用 `cargo check` 而非完整 `tauri build`

## Criteria

- [x] ISC-1: store.rs 新增 delete_app 方法删除 apps 表对应行
- [x] ISC-2: commands.rs 新增 remove_app 命令并校验 app 存在
- [x] ISC-3: lib.rs invoke_handler 注册 remove_app 命令
- [x] ISC-4: 后端 cargo check 编译通过无报错
- [x] ISC-5: api.ts 新增 removeApp(appId) 调用 remove_app
- [x] ISC-6: Sidebar Props 新增 onDeleteApp 回调字段
- [x] ISC-7: App 行重构为 div 包裹含 × 删除按钮
- [x] ISC-8: 删除按钮 stopPropagation 不触发行选中
- [x] ISC-9: 新增 DeleteAppModal 删除确认弹窗组件
- [x] ISC-10: App.tsx handleDeleteApp 打开删除确认弹窗
- [x] ISC-11: confirmDeleteApp 调用 removeApp 并刷新列表
- [x] ISC-12: 删除当前选中 App 后正确切换 activeId
- [x] ISC-13: 前端 tsc --noEmit 类型检查通过
- [x] ISC-A1: 不改动 Pages 现有删除行为
- [x] ISC-A2: 仅增量新增，不删除或重写现有组件

## Decisions

- 删除确认采用独立 DeleteAppModal（而非泛化 DeletePageModal）：与既有 AddPageModal/AddAppModal 分离式约定一致，diff 最小、不触及 pages 流程。
- delete_app 只 `DELETE FROM apps`：apps 不产生 capture session（sessions.target_type 恒为 'page'），无需级联清理。
- 确认文案强调"只删 AppScope 记录、不卸载应用"，避免误解删除范围。
- /simplify 在 OBSERVE 备选但移除：项目非 git 仓库，无法生成 diff，改为人工复审。

## Verification

- ISC-4：`cargo check --manifest-path src-tauri/Cargo.toml` → exit 0，`Finished dev profile`，无报错无警告。
- ISC-13：`./node_modules/.bin/tsc --noEmit` → exit 0（覆盖 ISC-5/6/7/9/10/11，类型层面验证 prop 接线、import、组件签名一致）。
- ISC-7/8：Sidebar app 行已由单 `<button>` 改为 `<div>` 包裹 itemBtn + deleteBtn，删除按钮 `e.preventDefault()+e.stopPropagation()` 与 pages 完全一致。
- ISC-12：confirmDeleteApp 在 `activeId === appId` 时 `setActiveId(remainingApps[0]?.id || pages[0]?.id || "")`。
- ISC-A1：未触碰 handleDeletePage/confirmDeletePage/DeletePageModal，仅新增并行的 app 流程。
- 未做：未运行完整 `tauri:dev` 实机点击验证（仅静态 + 编译验证）。


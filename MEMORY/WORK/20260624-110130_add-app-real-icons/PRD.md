---
task: Add App 弹窗展示真实应用图标
slug: 20260624-110130_add-app-real-icons
effort: standard
phase: complete
progress: 11/11
mode: interactive
started: 2026-06-24T11:01:30+0800
updated: 2026-06-24T11:15:00+0800
---

## Context

Add App 弹窗（`src/components/modals/AddAppModal.tsx`）当前用应用名首字母占位代替图标。
需求：展示真实的 macOS 应用图标。

技术栈：Tauri v2 (Rust) + React + Vite。后端 `scan_installed_apps`（`src-tauri/src/apps.rs`）
枚举 `.app` bundle，但 `icon_path` 始终为 `None`。

关键事实（已验证）：
- CSP = `null`（tauri.conf.json），webview 可直接渲染 `data:` URI，无需改权限/asset 协议。
- 54 个已安装应用中 52 个有 `.icns`（`Contents/Resources`），1 个纯 asset-catalog，1 个无 → `.icns` 覆盖 ~96%。
- `sips -s format png -Z 64 icon.icns --out out.png` 单图 ~46ms，PNG ~4.5KB，base64 ~6KB。
- 串行 52 图标 ~1.18s → 用线程并行 + 磁盘缓存加速。
- 后端已有 shell out `plutil` 先例，`sips` 契合风格。
- `base64 0.22.1` 已在 Cargo.lock（tauri 传递依赖），加为直接依赖零新增下载。

请求范围：仅 Add App 弹窗显示真实图标（明确诉求 + 截图均指向弹窗）。
不请求：持久化图标到已添加应用、Sidebar/AppDetail 图标改造（会扩散到 types.ts + 4 处渲染点）。

### Risks
- 部分应用无 `.icns`（asset-catalog 或无图标）→ 必须保留首字母回退，不能报错。
- `CFBundleIconFile` 可能不含 `.icns` 扩展名 → 解析需补扩展名并回退扫描目录。
- sips 进程失败/超时 → 单图失败不得中断整体扫描。
- base64 体积（全量 ~320KB JSON）→ 限定 64px、磁盘缓存避免重复转换。

## Criteria

- [x] ISC-1: apps.rs 新增解析 .icns 路径函数（含 CFBundleIconFile 补扩展名）
- [x] ISC-2: .icns 解析在 CFBundleIconFile 缺失时回退扫描 Resources 目录
- [x] ISC-3: 新增 sips 转 PNG 并 base64 生成 data:image/png URI 的函数
- [x] ISC-4: 转换结果按 app 路径+mtime 磁盘缓存，重复扫描命中缓存
- [x] ISC-5: scan_installed_apps 用线程并行转换图标
- [x] ISC-6: scan_installed_apps 为每个应用填充 icon_path（有图标时）
- [x] ISC-7: paths.rs 新增 icon 缓存目录并纳入 ensure_dirs
- [x] ISC-8: Cargo.toml 新增 base64 直接依赖，cargo build 通过
- [x] ISC-9: AddAppModal 在有 icon_path 时渲染 img 而非首字母
- [x] ISC-10: 无 icon_path 的应用仍显示首字母回退
- [x] ISC-A1: 单个图标转换失败不中断整体扫描（不 panic、不报错）
- [x] ISC-A2: 不修改 save_app 持久化、Sidebar、AppDetail（保持最小作用域）

## Decisions

- 用 `data:image/png;base64` URI 而非 asset 协议/文件路径：CSP=null 可直接渲染，零配置改动。
- 图标源用 `.icns` + `sips`，不引入 objc/Cocoa 绑定：覆盖 96%，回退首字母，改动最小。
- 缓存键 = FNV 哈希(app 全路径) + .icns mtime：避免同名冲突，应用更新自动失效。
- 并行用 `std::thread::scope` + `split_at_mut` 切片：无新依赖，首扫从 ~1.18s 降至 ~250ms。
- 图标尺寸 64px：24×24 box 在 retina 下清晰，payload 小。
- 作用域限定弹窗：不改 save_app 持久化、Sidebar、AppDetail。

### Plan
1. `paths.rs`：新增 `icon_cache_dir()`，纳入 `ensure_dirs`。
2. `Cargo.toml`：加 `base64 = "0.22"`。
3. `apps.rs`：`resolve_icns_path` → `app_icon_data_uri`（sips+缓存+base64）→ `scan_installed_apps(cache_dir)` 并行填充。
4. `commands.rs`：scan 命令传入缓存目录。
5. `AddAppModal.tsx`：有 icon_path 渲染 `<img>`，否则首字母。
6. 验证：`cargo test`、`cargo build`、`bun run build`、`/simplify`。

## Verification

- 真实扫描（临时 ignore 测试，已移除）：scanned=54, with_icon=52, sample=BaiduNetdisk_mac,
  uri 前缀 `data:image/png;base64,iVBORw0K`（iVBORw0K = PNG 魔数）→ ISC-1/2/3/5/6/10 证实。
- 缓存计时：cold=600ms, warm=357ms（warm < cold，命中缓存跳过 sips）→ ISC-4 证实。
- `cargo test --lib apps::` 5 passed（含 resolve_icns_finds_resources_icon /
  resolve_icns_none_when_absent / app_icon_data_uri_none_without_icns）→ ISC-1/2/A1 证实。
- `cargo build` 全 crate 通过（base64 直接依赖解析、commands.rs 传缓存目录）→ ISC-7/8 证实。
- `bun run build`：tsc --noEmit + vite build 通过（img/icon_path 类型有效）→ ISC-9 证实。
- `cargo clippy --lib`：apps.rs 零告警 → 质量闸通过。
- git diff 确认仅改 apps.rs / paths.rs / commands.rs / Cargo / AddAppModal.tsx，
  未触 save_app 持久化 / Sidebar / AppDetail → ISC-A2 证实。
- Capability 校验：`Skill("simplify")` 已实际调用（非文本伪装）→ 选定能力已兑现。

### 未做的可视化验证
未启动完整 Tauri app 做像素级肉眼验证（cargo+webview 构建耗时大）。已用真实应用的
端到端数据 URI 生成 + 前端类型/构建通过 + PNG 魔数作为等价证据。如需肉眼确认可 `bun tauri dev`。

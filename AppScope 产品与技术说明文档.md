# AppScope 产品与技术说明文档

版本：v0.1
目标平台：macOS
技术框架：Tauri v2 + Rust
产品类型：应用/页面启动器 + 网络请求监控客户端

---

# 1. 产品概述

## 1.1 产品定位

AppScope 是一个面向开发者、测试工程师、技术支持和高级用户的 macOS 客户端。用户可以在 AppScope 中添加本机已安装的应用或具体网页地址，然后通过 AppScope 启动这些应用或页面，并监控其产生的网络请求。

产品体验类似于：

* 应用启动器
* Chrome 页面工作区
* HTTP/HTTPS 抓包工具
* 轻量级 Proxyman / Charles / Fiddler 替代方案
* 面向单个应用或单个页面的网络调试面板

核心价值是：

> 用户不用手动配置复杂代理，也不用全局抓取所有流量，而是可以围绕“某个应用”或“某个页面”建立独立调试会话，查看其网络请求、响应、Headers、Body、Timing 和错误信息。

---

## 1.2 要解决的问题

开发和测试过程中，经常会遇到以下场景：

1. 想看某个 macOS App 的 API 请求，但不想全局抓包。
2. 想单独打开一个 Chrome 页面，并只监控这个页面的请求。
3. 想快速复现某个网页或 SaaS 系统的请求问题。
4. 想查看请求 headers、cookies、payload、response body。
5. 想把某个 App 或页面固定到一个调试空间里，下次一键打开。
6. 想对请求做过滤、搜索、导出和回放。
7. 不想每次手动设置系统代理、安装证书、打开抓包工具、再打开目标应用。

AppScope 的目标是把这些步骤产品化。

---

# 2. 用户与场景

## 2.1 目标用户

### 开发者

主要需求：

* 调试前端页面请求
* 调试 Electron/Tauri/桌面客户端请求
* 查看本地应用与后端服务之间的 API 调用
* 复现线上环境接口问题
* 导出 HAR 或请求日志给后端排查

### QA / 测试工程师

主要需求：

* 验证接口是否正确调用
* 查看请求参数是否符合预期
* 记录某个测试流程下的请求链路
* 将请求日志附加到 bug report

### 技术支持 / 实施工程师

主要需求：

* 在客户机器上定位请求失败原因
* 查看是否 DNS、代理、证书、权限、后端错误导致异常
* 导出脱敏后的请求日志给研发团队

### 高级用户

主要需求：

* 理解某些应用在访问哪些服务
* 观察某些网页或工具的网络行为
* 排查本机网络问题

---

# 3. 产品范围

## 3.1 MVP 范围

第一版重点支持：

1. 添加 Chrome 页面
2. 添加本机应用
3. 通过 AppScope 启动 Chrome 页面
4. 启动本地代理服务
5. 针对 Chrome 独立会话抓取 HTTP/HTTPS 请求
6. 展示请求列表
7. 查看请求详情
8. 搜索和过滤请求
9. 安装和管理本机 CA 证书
10. 导出 HAR / JSON

MVP 不强制支持“任意 macOS App 的透明抓包”。

MVP 的主要验证目标是：

> 用户能在 AppScope 中添加一个网页或 Chrome 应用入口，一键打开，并看到这个页面产生的 HTTP/HTTPS 请求。

---

## 3.2 非目标范围

第一版不做以下能力：

1. 不承诺解密所有 App 的 HTTPS 请求。
2. 不绕过第三方 App 的 SSL Pinning。
3. 不拦截银行、支付、密码管理器等敏感应用。
4. 不做系统级防火墙。
5. 不做恶意流量拦截。
6. 不做 VPN 产品。
7. 不把第三方 App 的真实窗口嵌入 AppScope 窗口。
8. 不支持 iOS/Android 设备抓包。
9. 不做团队协作和云同步。
10. 不做自动破解、绕过、Hook、注入第三方 App 等高风险能力。

---

# 4. 核心功能设计

## 4.1 应用与页面管理

### 4.1.1 添加应用

用户可以添加 macOS 中已安装的应用，例如：

* Google Chrome
* Safari
* Slack
* Discord
* VS Code
* 自研客户端
* 其他 `.app` 应用

添加方式：

1. 从自动扫描的应用列表中选择。
2. 从 Finder 手动选择 `.app`。
3. 拖拽 `.app` 到 AppScope。
4. 后续版本支持通过 Bundle ID 搜索。

应用信息包括：

```json
{
  "id": "app_001",
  "name": "Google Chrome",
  "bundle_id": "com.google.Chrome",
  "app_path": "/Applications/Google Chrome.app",
  "icon_path": "...",
  "created_at": "2026-06-18T10:00:00Z",
  "launch_mode": "normal"
}
```

---

### 4.1.2 添加页面

用户可以添加一个具体 URL，例如：

* `https://admin.example.com`
* `https://console.example.com/projects/123`
* `https://localhost:3000`
* `http://127.0.0.1:5173`

页面信息包括：

```json
{
  "id": "page_001",
  "title": "Admin Console",
  "url": "https://admin.example.com",
  "browser": "Google Chrome",
  "profile_id": "profile_001",
  "proxy_mode": "session_proxy",
  "created_at": "2026-06-18T10:00:00Z"
}
```

---

## 4.2 启动模式

AppScope 支持三种启动模式。

---

### 4.2.1 普通启动模式

适用于普通 App。

行为：

1. 用户点击“打开”。
2. AppScope 调用 macOS 启动目标应用。
3. 不注入代理参数。
4. 仅作为应用启动器使用。

适合：

* 暂不需要抓包的应用
* 只需要集中管理入口的应用
* 后续需要再切换到抓包模式的应用

---

### 4.2.2 Chrome 会话抓包模式

适用于添加的 Chrome 页面。

行为：

1. AppScope 启动本地代理。
2. 创建独立 Chrome profile。
3. 用指定代理参数启动 Chrome。
4. 打开目标 URL。
5. 抓取该 Chrome 会话产生的请求。
6. 在 AppScope 中展示请求。

启动参数示例：

```bash
open -na "Google Chrome" --args \
  --user-data-dir="$HOME/Library/Application Support/AppScope/Profiles/profile_001" \
  --proxy-server="http=127.0.0.1:9090;https=127.0.0.1:9090" \
  --disable-quic \
  "https://example.com"
```

特点：

* 不影响用户当前 Chrome 主 profile。
* 不需要修改全局系统代理。
* 可以按页面/session 隔离请求。
* 最适合 MVP。

---

### 4.2.3 系统代理抓包模式

适用于遵循 macOS 系统代理设置的应用。

行为：

1. AppScope 启动本地代理。
2. 备份当前系统代理配置。
3. 设置系统 HTTP/HTTPS 代理到 `127.0.0.1:9090`。
4. 用户启动目标应用。
5. 目标应用如果遵循系统代理，则请求进入 AppScope。
6. 关闭抓包时恢复原系统代理。

优点：

* 实现成本比 Network Extension 低。
* 可以覆盖 Safari、部分原生 App、部分 Electron App。
* 可作为第二阶段能力。

限制：

* 不能保证所有 App 使用系统代理。
* 可能影响其他应用网络。
* 必须提供明显的“恢复系统代理”按钮。
* 异常退出时必须自动恢复或下次启动时提示恢复。

---

### 4.2.4 透明 App 抓包模式

适用于长期版本。

行为：

1. 用户选择一个或多个 App。
2. AppScope 配置 Network Extension。
3. Network Extension 只捕获被选择 App 的网络流。
4. 流量转发到本地代理解析。
5. AppScope UI 展示请求。

优点：

* 最接近“按 App 抓包”的最终产品体验。
* 不依赖目标应用是否遵循系统代理。
* 可以只捕获用户选择的应用。

限制：

* 工程复杂度高。
* 需要 Apple Developer entitlement。
* 需要处理 System Extension 安装、授权、签名、公证。
* HTTPS 明文仍然需要用户信任本地 CA。
* SSL Pinning 应用仍然无法保证解密。

---

# 5. 用户体验设计

## 5.1 首页

首页分为三部分：

```text
左侧：应用 / 页面列表
中间：当前 Session 请求列表
右侧：请求详情
```

左侧导航：

* All Sessions
* Pages
* Apps
* Certificates
* Settings

每个应用或页面卡片展示：

* 图标
* 名称
* 类型：App / Page
* 当前状态：未运行 / 运行中 / 抓包中 / 异常
* 最近请求数
* 最近启动时间

---

## 5.2 添加页面流程

用户流程：

```text
点击 Add Page
  → 输入 URL
  → 选择浏览器：Chrome
  → 选择抓包模式：Chrome Session
  → 保存
  → 点击 Open & Capture
  → 启动代理
  → 启动 Chrome 独立 Profile
  → 打开页面
  → AppScope 显示请求
```

首次使用时，如果 CA 未安装：

```text
点击 Open & Capture
  → 弹出证书安装引导
  → 用户安装并信任 CA
  → AppScope 检测证书状态
  → 继续启动抓包
```

---

## 5.3 添加应用流程

用户流程：

```text
点击 Add App
  → 展示已安装应用列表
  → 用户选择应用
  → 选择启动模式
      - Normal
      - System Proxy Capture
      - Transparent Capture
  → 保存
```

MVP 中，Transparent Capture 显示为 Coming Soon。

---

## 5.4 请求列表

请求列表字段：

| 字段      | 说明                                                  |
| ------- | --------------------------------------------------- |
| Method  | GET / POST / PUT / DELETE                           |
| Status  | HTTP 状态码                                            |
| Host    | 域名                                                  |
| Path    | 请求路径                                                |
| Type    | document / xhr / fetch / image / script / websocket |
| Size    | 响应体大小                                               |
| Time    | 请求耗时                                                |
| Started | 开始时间                                                |
| Source  | 来源 Session / App / Page                             |

支持过滤：

* Method
* Status code
* Host
* Path keyword
* MIME type
* Request body keyword
* Response body keyword
* Has error
* Has cookie
* Has auth header

---

## 5.5 请求详情

请求详情 Tabs：

1. Overview
2. Request Headers
3. Request Body
4. Response Headers
5. Response Body
6. Cookies
7. Timing
8. Raw
9. Notes

Overview 示例：

```json
{
  "method": "POST",
  "url": "https://api.example.com/v1/login",
  "status": 200,
  "duration_ms": 183,
  "request_size": 1024,
  "response_size": 4096,
  "session": "Admin Console",
  "started_at": "2026-06-18T10:00:00Z"
}
```

---

## 5.6 敏感信息保护

默认对以下字段做脱敏显示：

* `Authorization`
* `Cookie`
* `Set-Cookie`
* `X-Api-Key`
* `X-Auth-Token`
* `access_token`
* `refresh_token`
* `password`
* `client_secret`

用户可以点击“Reveal”临时查看。

导出时提供选项：

* 导出原始数据
* 导出脱敏数据
* 只导出元数据
* 不导出 body

---

# 6. 技术架构

## 6.1 总体架构

```text
AppScope.app
├── Tauri Frontend
│   ├── React / Vue / Svelte
│   ├── Request Viewer
│   ├── Session Manager UI
│   └── Settings UI
│
├── Tauri Rust Core
│   ├── App Scanner
│   ├── App Launcher
│   ├── Proxy Manager
│   ├── Certificate Manager
│   ├── Session Manager
│   ├── Flow Store
│   ├── Event Bridge
│   └── System Proxy Manager
│
├── Proxy Sidecar
│   ├── Option A: mitmdump
│   └── Option B: self-hosted Rust proxy
│
├── Local Database
│   ├── SQLite
│   ├── Flow Index
│   ├── Session Records
│   └── Settings
│
└── Optional Native Layer
    ├── Swift Helper
    ├── XPC Service
    └── Network Extension
```

---

## 6.2 为什么选择 Tauri + Rust

选择原因：

1. UI 开发效率高，可以使用成熟 Web 技术栈。
2. 桌面应用体积比 Electron 更小。
3. Rust 后端适合做进程管理、网络服务、文件存储和高性能数据处理。
4. Tauri 支持 sidecar，可以打包 mitmproxy 或自研代理。
5. 后续如果做跨平台，Tauri 可以复用大部分 UI 和 Rust core。
6. macOS 深层能力可以通过 Rust FFI、Swift helper 或 XPC 扩展。

---

## 6.3 前端技术栈

推荐：

```text
Tauri v2
React + TypeScript
TanStack Query
Zustand / Jotai
Monaco Editor
CodeMirror
Tailwind CSS
Radix UI / shadcn/ui
```

前端模块：

```text
src/
├── pages/
│   ├── Dashboard.tsx
│   ├── Sessions.tsx
│   ├── Requests.tsx
│   ├── Certificates.tsx
│   └── Settings.tsx
│
├── components/
│   ├── AppList.tsx
│   ├── RequestTable.tsx
│   ├── RequestDetail.tsx
│   ├── HeaderViewer.tsx
│   ├── BodyViewer.tsx
│   └── CertificateGuide.tsx
│
├── stores/
│   ├── sessionStore.ts
│   ├── flowStore.ts
│   └── settingsStore.ts
│
└── lib/
    ├── tauri.ts
    ├── format.ts
    └── filters.ts
```

---

## 6.4 Rust 后端模块

Rust crate 结构：

```text
src-tauri/src/
├── main.rs
├── commands/
│   ├── apps.rs
│   ├── launch.rs
│   ├── proxy.rs
│   ├── cert.rs
│   ├── sessions.rs
│   └── flows.rs
│
├── core/
│   ├── app_scanner.rs
│   ├── launcher.rs
│   ├── proxy_manager.rs
│   ├── cert_manager.rs
│   ├── system_proxy.rs
│   ├── session_manager.rs
│   └── flow_store.rs
│
├── sidecar/
│   ├── mitmproxy.rs
│   └── process.rs
│
├── db/
│   ├── mod.rs
│   ├── migrations.rs
│   └── models.rs
│
└── types/
    ├── app.rs
    ├── session.rs
    ├── flow.rs
    └── settings.rs
```

---

# 7. 抓包技术方案

## 7.1 方案分层

AppScope 的抓包能力分三层：

```text
Layer 1: Chrome Session Capture
  最适合 MVP，只捕获 AppScope 启动的 Chrome 独立会话。

Layer 2: System Proxy Capture
  捕获遵循系统代理的 App。

Layer 3: Transparent App Capture
  通过 Network Extension 捕获指定 App 的流量。
```

---

## 7.2 MVP 推荐实现：mitmproxy sidecar

MVP 中不建议自研完整 MITM 代理。推荐先把 mitmproxy 作为 sidecar 嵌入 AppScope。

优点：

* 快速获得 HTTP/HTTPS 抓包能力。
* 支持证书生成。
* 支持 request/response 事件。
* 支持 WebSocket。
* 支持导出 flow。
* 支持 addon 扩展。
* 便于快速验证产品体验。

缺点：

* 需要处理 Python/二进制打包。
* 性能和内存占用需要评估。
* UI 和 sidecar 通信需要设计。
* 长期商业化时，可能考虑替换为自研 Rust proxy。

---

## 7.3 sidecar 通信方式

推荐使用本地 WebSocket 或 Unix Domain Socket。

```text
mitmproxy addon
  → 将 flow event 序列化为 JSON
  → 发送到 AppScope Rust Core 的 local event server
  → Rust Core 写入 SQLite
  → Rust Core emit event 给 Tauri Frontend
```

事件流：

```text
request_started
request_headers
request_body
response_headers
response_body
request_finished
request_failed
websocket_message
```

示例事件：

```json
{
  "event": "response_finished",
  "flow_id": "flow_123",
  "session_id": "session_001",
  "method": "POST",
  "url": "https://api.example.com/v1/login",
  "host": "api.example.com",
  "path": "/v1/login",
  "status_code": 200,
  "request_headers": {},
  "response_headers": {},
  "request_body_preview": "{}",
  "response_body_preview": "{}",
  "duration_ms": 183,
  "started_at": "2026-06-18T10:00:00Z",
  "finished_at": "2026-06-18T10:00:00Z"
}
```

---

## 7.4 后续自研 Rust proxy 方向

当产品验证成功后，可以逐步把代理核心替换为 Rust 实现。

可选技术：

```text
tokio
hyper
h2
rustls
rcgen
x509-parser
tokio-rustls
httparse
tungstenite
```

自研代理模块：

```text
proxy-core/
├── listener
├── http_proxy
├── connect_tunnel
├── tls_mitm
├── certificate_authority
├── request_parser
├── response_parser
├── websocket
├── flow_recorder
└── upstream_client
```

自研代理优点：

* 更容易打包。
* 无 Python 运行时依赖。
* 性能可控。
* 与 Tauri/Rust core 一体化。
* 更适合商业产品长期维护。

自研代理缺点：

* 工程量大。
* TLS、HTTP/2、WebSocket、压缩、证书、边界条件很多。
* 初期不如 mitmproxy 稳定。

建议策略：

```text
0-6 个月：mitmproxy sidecar
6-12 个月：抽象 Proxy Engine 接口
12 个月后：评估是否替换为 Rust proxy
```

---

# 8. Chrome 页面抓包方案

## 8.1 独立 Profile

每个页面或工作区创建独立 Chrome profile。

路径示例：

```text
~/Library/Application Support/AppScope/ChromeProfiles/{profile_id}
```

目的：

1. 避免污染用户主 Chrome profile。
2. 保证代理参数生效。
3. 方便按页面隔离 Cookie、缓存和请求。
4. 支持多个页面并行调试。

---

## 8.2 启动参数

Chrome 启动参数：

```bash
open -na "Google Chrome" --args \
  --user-data-dir="{profile_path}" \
  --proxy-server="http=127.0.0.1:{port};https=127.0.0.1:{port}" \
  --disable-quic \
  --remote-debugging-port={cdp_port} \
  "{url}"
```

参数说明：

| 参数                        | 作用                   |
| ------------------------- | -------------------- |
| `-n`                      | 启动新的应用实例             |
| `--user-data-dir`         | 指定独立 Profile         |
| `--proxy-server`          | 指定本地代理               |
| `--disable-quic`          | 降低 HTTP/3/QUIC 对抓包影响 |
| `--remote-debugging-port` | 可选，用于 CDP 页面级辅助数据    |

---

## 8.3 CDP 辅助能力

Chrome DevTools Protocol 不作为主要抓包链路，但可以作为辅助能力。

可用于：

* 获取 page title
* 获取 tab URL
* 识别 request initiator
* 获取前端资源类型
* 关联 network request 与页面上下文
* 判断页面加载状态
* 获取 console errors

不依赖 CDP 解密 HTTPS。HTTPS 解密仍由代理和 CA 完成。

---

# 9. 证书体系设计

## 9.1 CA 生成

AppScope 首次启动抓包时生成本机 Root CA。

建议：

```text
CA 私钥路径：
~/Library/Application Support/AppScope/certs/rootCA.key

CA 证书路径：
~/Library/Application Support/AppScope/certs/rootCA.pem
```

安全要求：

1. 私钥只存储在本机。
2. 私钥不上传服务器。
3. 私钥文件权限限制为当前用户可读写。
4. 用户可以一键删除 CA。
5. 卸载应用时提供清理指引。
6. 导出请求日志时不包含 CA 私钥。

---

## 9.2 证书安装流程

首次开启 HTTPS 抓包时：

```text
检测 CA 是否存在
  → 不存在则生成
检测 CA 是否被系统信任
  → 未信任则展示引导
用户点击 Install Certificate
  → 打开 Keychain Access 或系统证书设置
用户手动信任
  → AppScope 检测状态
  → 继续抓包
```

不建议静默安装和信任证书。

产品上必须明确告诉用户：

> 信任 AppScope CA 后，AppScope 可以解密通过它代理的 HTTPS 流量。请只在你信任的设备和会话中开启抓包。

---

## 9.3 证书状态

证书页展示：

| 状态            | 说明            |
| ------------- | ------------- |
| Not Generated | 未生成           |
| Generated     | 已生成但未安装       |
| Installed     | 已安装但未完全信任     |
| Trusted       | 已信任，可解密 HTTPS |
| Invalid       | 文件损坏或证书不匹配    |
| Removed       | 已删除           |

提供操作：

* Generate CA
* Install CA
* Open Keychain
* Check Trust
* Remove CA
* Reset Certificate

---

# 10. 系统代理设计

## 10.1 设置系统代理

系统代理模式需要：

1. 获取当前网络服务列表。
2. 备份每个服务的代理配置。
3. 设置 HTTP proxy。
4. 设置 HTTPS proxy。
5. 可选设置 SOCKS proxy。
6. 关闭时恢复原配置。

建议用 macOS `networksetup` 命令实现 MVP。

示例：

```bash
networksetup -setwebproxy "Wi-Fi" 127.0.0.1 9090
networksetup -setsecurewebproxy "Wi-Fi" 127.0.0.1 9090
networksetup -setwebproxystate "Wi-Fi" on
networksetup -setsecurewebproxystate "Wi-Fi" on
```

恢复时：

```bash
networksetup -setwebproxystate "Wi-Fi" off
networksetup -setsecurewebproxystate "Wi-Fi" off
```

长期可以替换为 SystemConfiguration framework。

---

## 10.2 异常恢复

必须处理：

1. App 崩溃后系统代理未恢复。
2. 用户强制退出。
3. 代理端口被占用。
4. 用户切换网络。
5. VPN 与系统代理冲突。
6. 多网卡场景。
7. PAC 配置存在时的覆盖和恢复。

恢复机制：

```text
启动时检测是否存在 AppScope proxy residue
  → 如果存在，提示用户恢复
  → 提供一键恢复
```

---

# 11. Network Extension 设计

## 11.1 使用场景

Network Extension 用于第三阶段，实现：

* 按 App 捕获流量
* 不依赖系统代理
* 捕获不遵循系统代理的应用
* 更接近 Proxyman / Little Snitch 的产品体验

---

## 11.2 架构

```text
Target App
  ↓
Network Extension
  ↓
Local Redirect / Flow Handler
  ↓
AppScope Proxy Engine
  ↓
Remote Server
```

主 App 与扩展通信：

```text
Tauri Main App
  ↔ Rust Core
  ↔ Swift/XPC Helper
  ↔ Network Extension
```

Tauri 不直接实现 Network Extension。Network Extension 使用 Apple 原生工程实现，Tauri 负责调用和管理。

---

## 11.3 捕获粒度

捕获规则：

```json
{
  "target_type": "app",
  "bundle_id": "com.example.app",
  "signing_identifier": "com.example.app",
  "capture_mode": "transparent"
}
```

优先匹配：

1. Bundle ID
2. Signing Identifier
3. App Path
4. PID
5. Process Name

长期建议以 signing identifier / designated requirement 为主，避免仅靠路径匹配带来的安全问题。

---

## 11.4 风险

Network Extension 风险：

1. 需要 entitlement。
2. 需要签名和 notarization。
3. 用户需要授权 System Extension。
4. 调试困难。
5. 网络层边界条件多。
6. 不同 macOS 版本行为可能有差异。
7. 与 VPN、防火墙、代理软件可能冲突。

因此不建议 MVP 阶段投入。

---

# 12. 数据模型

## 12.1 表结构

### apps

```sql
CREATE TABLE apps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  bundle_id TEXT,
  app_path TEXT NOT NULL,
  icon_path TEXT,
  launch_mode TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### pages

```sql
CREATE TABLE pages (
  id TEXT PRIMARY KEY,
  title TEXT,
  url TEXT NOT NULL,
  browser_app_id TEXT,
  profile_id TEXT,
  capture_mode TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### sessions

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  status TEXT NOT NULL,
  proxy_port INTEGER,
  cdp_port INTEGER,
  started_at TEXT NOT NULL,
  ended_at TEXT
);
```

### flows

```sql
CREATE TABLE flows (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  method TEXT,
  url TEXT NOT NULL,
  scheme TEXT,
  host TEXT,
  path TEXT,
  status_code INTEGER,
  request_headers_json TEXT,
  response_headers_json TEXT,
  request_body_path TEXT,
  response_body_path TEXT,
  request_body_preview TEXT,
  response_body_preview TEXT,
  mime_type TEXT,
  duration_ms INTEGER,
  request_size INTEGER,
  response_size INTEGER,
  error TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT
);
```

### settings

```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

---

## 12.2 文件存储

大 body 不直接放 SQLite。

推荐：

```text
~/Library/Application Support/AppScope/
├── db/
│   └── appscope.sqlite
├── bodies/
│   ├── request/
│   └── response/
├── certs/
├── profiles/
├── logs/
└── exports/
```

Body 存储策略：

| Body 大小     | 存储方式                |
| ----------- | ------------------- |
| <= 64KB     | SQLite preview      |
| 64KB - 10MB | 文件存储                |
| > 10MB      | 默认不保存完整 body，仅保存元数据 |
| binary      | 默认保存 metadata，可手动保存 |

---

# 13. Tauri Command 设计

## 13.1 应用扫描

```rust
#[tauri::command]
async fn scan_installed_apps() -> Result<Vec<AppInfo>, String>
```

返回：

```json
[
  {
    "name": "Google Chrome",
    "bundle_id": "com.google.Chrome",
    "app_path": "/Applications/Google Chrome.app",
    "icon_path": "..."
  }
]
```

---

## 13.2 启动页面抓包

```rust
#[tauri::command]
async fn open_page_with_capture(page_id: String) -> Result<SessionInfo, String>
```

执行：

1. 读取 page 配置。
2. 确认代理是否运行。
3. 检查 CA 状态。
4. 创建 session。
5. 创建 Chrome profile。
6. 启动 Chrome。
7. 返回 session id。

---

## 13.3 停止 Session

```rust
#[tauri::command]
async fn stop_session(session_id: String) -> Result<(), String>
```

执行：

1. 停止目标子进程。
2. 停止或复用代理。
3. 标记 session ended。
4. 释放端口。
5. 恢复系统代理。

---

## 13.4 获取请求列表

```rust
#[tauri::command]
async fn list_flows(
  session_id: String,
  filter: FlowFilter,
  pagination: Pagination
) -> Result<Vec<FlowSummary>, String>
```

---

## 13.5 获取请求详情

```rust
#[tauri::command]
async fn get_flow_detail(flow_id: String) -> Result<FlowDetail, String>
```

---

## 13.6 证书管理

```rust
#[tauri::command]
async fn get_certificate_status() -> Result<CertificateStatus, String>

#[tauri::command]
async fn generate_certificate() -> Result<(), String>

#[tauri::command]
async fn open_certificate_guide() -> Result<(), String>

#[tauri::command]
async fn remove_certificate() -> Result<(), String>
```

---

# 14. 安全与隐私

## 14.1 基本原则

1. 默认不上传任何请求数据。
2. 默认只抓用户主动开启的 session。
3. 默认脱敏敏感 headers。
4. CA 私钥只保存在本机。
5. 明确提示用户抓包范围。
6. 支持一键停止所有抓包。
7. 支持一键删除历史请求。
8. 支持一键恢复系统代理。
9. 不提供绕过 SSL Pinning 能力。
10. 不自动抓取敏感应用。

---

## 14.2 敏感 App 黑名单

默认提示用户谨慎抓取以下类型 App：

* 银行
* 支付
* 证券
* 密码管理器
* 医疗
* 政府服务
* 企业 VPN
* 加密钱包
* 私密通信

不一定技术上禁止，但必须明确风险提示。

---

## 14.3 导出安全

导出时提供：

```text
[ ] Include request body
[ ] Include response body
[ ] Include cookies
[ ] Include authorization headers
[ ] Mask tokens
[ ] Mask passwords
```

默认导出脱敏版本。

---

# 15. 打包与分发

## 15.1 macOS 打包

使用 Tauri 构建 `.app` 和 `.dmg`。

包含：

```text
AppScope.app
├── Main executable
├── WebView frontend bundle
├── Rust backend
├── sidecar binaries
└── resources
```

---

## 15.2 Sidecar 打包

MVP：

```text
src-tauri/binaries/
├── mitmdump-aarch64-apple-darwin
└── mitmdump-x86_64-apple-darwin
```

构建时按架构打包。

---

## 15.3 签名与公证

发布 macOS 版本需要：

1. Apple Developer Account
2. Developer ID Application certificate
3. Hardened Runtime
4. Code signing
5. Notarization
6. Staple ticket
7. DMG signing

如果包含 Network Extension，则额外需要：

1. Network Extension entitlement
2. Provisioning Profile
3. System Extension approval flow
4. 更严格的签名和权限测试

---

# 16. 错误处理

## 16.1 常见错误

| 错误                          | 说明         | 处理          |
| --------------------------- | ---------- | ----------- |
| ProxyPortInUse              | 代理端口被占用    | 自动换端口或提示用户  |
| CertificateNotTrusted       | CA 未信任     | 展示证书引导      |
| ChromeNotFound              | 未找到 Chrome | 引导用户选择浏览器   |
| SystemProxyRestoreFailed    | 系统代理恢复失败   | 提供手动恢复命令    |
| SidecarCrashed              | 代理进程崩溃     | 自动重启或提示查看日志 |
| BodyTooLarge                | 响应体过大      | 只保存预览       |
| SSLPinningDetected          | 可能存在证书固定   | 显示无法解密说明    |
| NetworkExtensionNotApproved | 用户未批准扩展    | 展示授权引导      |

---

# 17. 性能设计

## 17.1 请求列表性能

请求量较大时：

1. 前端虚拟列表。
2. 后端分页查询。
3. SQLite 建索引。
4. Body 懒加载。
5. Response preview 截断。
6. 大文件按需读取。

索引：

```sql
CREATE INDEX idx_flows_session_id ON flows(session_id);
CREATE INDEX idx_flows_host ON flows(host);
CREATE INDEX idx_flows_status_code ON flows(status_code);
CREATE INDEX idx_flows_started_at ON flows(started_at);
```

---

## 17.2 数据清理

提供自动清理策略：

```text
保留最近 7 天
保留最近 30 天
保留最近 100 个 Session
超过 10GB 自动提醒清理
手动清理某个 Session
```

---

# 18. 版本路线图

## 18.1 v0.1 Prototype

目标：验证核心闭环。

功能：

* Tauri 基础 UI
* 添加 URL
* 启动 Chrome 独立 profile
* 启动 mitmproxy sidecar
* 展示请求列表
* 展示 headers/body
* 基础证书引导

验收标准：

* 可以添加 `https://example.com`
* 可以一键打开 Chrome
* 可以看到请求列表
* 可以查看响应内容
* 关闭 session 后代理进程退出

---

## 18.2 v0.2 MVP

目标：可用于真实开发调试。

功能：

* 添加 App
* 添加 Page
* Session 管理
* 请求过滤
* 请求详情
* CA 状态检测
* HAR 导出
* 脱敏导出
* 崩溃恢复
* 系统代理模式实验版

验收标准：

* Chrome 页面抓包稳定可用
* 系统代理模式可抓 Safari 和部分 App
* 异常退出后能恢复系统代理
* 请求列表 10,000 条不卡顿

---

## 18.3 v0.3 Beta

目标：对外小范围测试。

功能：

* 更完整的请求搜索
* WebSocket 支持
* GraphQL 友好展示
* JSON body 格式化
* cURL 复制
* Replay 基础版
* Map Local 基础版
* Rewrite 基础版
* 自动更新
* 崩溃日志

---

## 18.4 v1.0

目标：成为可发布产品。

功能：

* 稳定 Chrome Session Capture
* 稳定 System Proxy Capture
* 完整证书管理
* HAR/JSON/cURL 导出
* 请求重放
* 本地规则
* 请求收藏
* 敏感字段脱敏
* 安全卸载
* macOS 签名公证
* 官网下载

---

## 18.5 v2.0

目标：实现按 App 透明抓包。

功能：

* Network Extension
* 按 App 捕获
* 按 PID 捕获
* 按 Bundle ID 捕获
* 不依赖系统代理
* 更完整的连接层视图
* 透明抓包诊断工具

---

# 19. 工程里程碑

## Milestone 1：基础工程

任务：

* 创建 Tauri v2 项目
* 接入 React + TypeScript
* 建立 Rust command 调用
* 建立 SQLite
* 建立基础布局
* 建立日志系统

产出：

* 可运行空壳 App
* 可读写本地配置
* 可展示 mock 请求列表

---

## Milestone 2：Chrome Session

任务：

* 创建 Chrome profile
* 启动 Chrome
* 注入代理参数
* 管理 session 状态
* 检测 Chrome 是否安装
* 支持用户选择 Chrome 路径

产出：

* 可以从 AppScope 打开指定 URL

---

## Milestone 3：代理 Sidecar

任务：

* 打包 mitmproxy sidecar
* 启动/停止代理
* 分配端口
* 监听代理事件
* 建立 flow exporter
* 写入 SQLite

产出：

* Chrome 页面请求可进入 AppScope

---

## Milestone 4：请求 UI

任务：

* RequestTable
* RequestDetail
* Header viewer
* Body viewer
* JSON formatter
* Search/filter
* Copy as cURL
* Export HAR

产出：

* 基本可用抓包 UI

---

## Milestone 5：证书管理

任务：

* 检测 CA 状态
* 生成 CA
* 引导安装 CA
* 检测信任状态
* 删除 CA
* 安全提示

产出：

* HTTPS 抓包流程闭环

---

## Milestone 6：系统代理模式

任务：

* 读取系统代理配置
* 设置系统代理
* 恢复系统代理
* 异常恢复
* VPN/多网卡兼容测试

产出：

* 可以抓遵循系统代理的 App

---

## Milestone 7：Beta 发布

任务：

* 签名
* Notarization
* DMG 打包
* 自动更新
* 崩溃日志
* 用户反馈入口

产出：

* 可发给外部用户测试的 Beta 包

---

# 20. 技术风险

## 20.1 HTTPS 解密风险

风险：

* 用户未信任 CA。
* App 使用 SSL Pinning。
* App 不走代理。
* QUIC/HTTP3 导致代理不可见。
* 某些 binary body 无法友好展示。

应对：

* 明确证书状态。
* 提示 SSL Pinning 限制。
* Chrome 启动时禁用 QUIC。
* 提供 metadata-only 模式。
* 后续引入 Network Extension。

---

## 20.2 系统代理风险

风险：

* 系统代理恢复失败。
* 用户网络服务名称不同。
* 多网卡或 VPN 冲突。
* 用户手动修改系统代理。

应对：

* 设置前备份。
* 关闭时恢复。
* 启动时检测残留。
* 提供手动恢复命令。
* 日志记录每次代理变更。

---

## 20.3 Sidecar 风险

风险：

* mitmproxy 打包复杂。
* sidecar 被系统拦截。
* 进程崩溃。
* 多架构兼容问题。
* 后续升级管理复杂。

应对：

* sidecar health check。
* 每个版本绑定 sidecar 版本。
* 崩溃自动重启。
* 明确日志路径。
* 长期抽象 Proxy Engine 接口，支持替换。

---

# 21. 成功指标

## 21.1 产品指标

MVP 成功标准：

* 用户 3 分钟内完成首次 Chrome 页面抓包。
* 首次证书安装流程成功率 > 80%。
* Chrome Session 抓包成功率 > 90%。
* 请求列表 10,000 条以内流畅。
* 导出 HAR 成功率 > 95%。

---

## 21.2 技术指标

* App 冷启动 < 3 秒。
* 本地代理启动 < 2 秒。
* 请求事件延迟 < 300ms。
* 单 session 支持 10,000+ flows。
* 大 body 不阻塞 UI。
* 异常退出后代理恢复成功率 > 95%。

---

# 22. 推荐技术决策

最终推荐：

```text
主客户端：Tauri v2
前端：React + TypeScript
后端：Rust
数据库：SQLite
代理 MVP：mitmproxy sidecar
Chrome 抓包：独立 profile + proxy-server
系统代理：networksetup MVP，后续 SystemConfiguration
证书管理：Rust + macOS security/keychain 引导
透明抓包：后续 Network Extension + Swift/XPC Helper
```

核心策略：

1. 先做 Chrome 页面抓包，不一开始挑战任意 App 透明抓包。
2. 先复用 mitmproxy，不一开始自研完整代理内核。
3. 先做本地单机产品，不做云端同步。
4. 产品上明确 HTTPS 和 SSL Pinning 边界。
5. 架构上提前抽象 Proxy Engine，给未来自研 Rust proxy 或 Network Extension 留接口。

---

# 23. 一句话总结

AppScope 的第一版应该是：

> 一个基于 Tauri + Rust 的 macOS 网络调试客户端，用户可以添加 Chrome 页面或本机应用，通过独立会话启动目标，并用本地代理捕获和展示 HTTP/HTTPS 请求；MVP 聚焦 Chrome Session 抓包，后续扩展到系统代理和 Network Extension 按应用透明抓包。

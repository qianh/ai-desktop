# AppScope

A macOS app/page launcher + per-session HTTP(S) capture client.
Add a Chrome page or an installed app, launch it through an isolated session, and
inspect the HTTP/HTTPS requests it makes — without configuring a global proxy.

> This repository implements the UI from the Claude Design component `AppScope.dc.html`
> as a real **Tauri v2 + React + TypeScript** application. See
> `AppScope 产品与技术说明文档.md` for the full product/technical spec.

## Stack

| Layer | Choice |
|-------|--------|
| Shell | Tauri v2 (Rust) |
| Frontend | React 18 + TypeScript + Vite 5 |
| Styling | Inline styles (ported 1:1 from the design); no CSS framework |
| Backend | Rust core: SQLite Flow Store, mitmproxy sidecar, Chrome session, CA manager |
| Proxy | mitmproxy/mitmdump (dev: Homebrew; packaged: sidecar TBD) |

## Project layout

```
src/                      React frontend
  App.tsx                 Shell + all UI state (ported from the DC Component class)
  components/
    Sidebar, TitleBar, StatusBar
    FlowTable.tsx         Request list — layout variant A (inspector) & B (DevTools)
    FlowDetail.tsx        Request inspector (ported from FlowDetail.dc.html)
    CertManager, Settings, AppDetail, EmptyState
    modals/               AddPage / AddApp / CertGuide
  api.ts                  Tauri invoke wrappers (real pages/apps/flows/CA)
  data/mockData.ts        Legacy sample data (not used at runtime)
  lib/                    format.ts (size/color helpers), ui.ts (style atoms)
  types.ts                Domain types (Flow, Header, Cookie, Page, App)
src-tauri/                Tauri v2 Rust shell
  src/store.rs            SQLite Flow Store
  src/proxy.rs            mitmdump discovery, addon, JSONL sync
  src/chrome.rs           Chrome profile + proxy launch
  src/cert.rs             Local CA generate/status/remove
  src/apps.rs             Installed app scan + launch
  src/commands.rs         Tauri command surface (spec §13)
  src/bin/verify_mvp_capture.rs  CLI MVP verifier
  tauri.conf.json         devUrl :1420, frontendDist ../dist
  capabilities/           Window permissions
.cargo/config.toml        Project-local crates mirror (rsproxy) — see "Network" below
.design-import/           Imported design source + verification screenshots (reference)
```

## Prerequisites

- **mitmdump** for real HTTP capture in development:

```bash
brew install --cask mitmproxy
```

- **Google Chrome** for Open & Capture (GUI session).
- **HTTPS capture** requires trusting the AppScope Local CA (generate in Certificates UI).

## Run

```bash
# 1. install frontend deps (registry defaults to npmmirror in this environment)
bun install            # or: npm install

# 2a. run the frontend on its own in a browser (fast iteration)
bun run dev            # http://localhost:1420

# 2b. run the full desktop app (compiles the Rust shell, opens a native window)
bun run tauri:dev      # = tauri dev

# build a distributable
bun run tauri:build

# MVP verification (real proxied HTTP -> SQLite)
bun run verify:mvp-capture
```

## Network / mirrors (this environment)

`registry.npmjs.org` and `static.crates.io` are not reachable here, so:

- **npm** registry is set to `https://registry.npmmirror.com` (already configured).
- **cargo** uses a **project-local** `.cargo/config.toml` that replaces crates.io with
  the `rsproxy.cn` sparse index. This file only affects builds inside this repo — it does
  **not** modify your global `~/.cargo`. Delete it if you want stock crates.io behavior.

## Status

Implemented (this pass):

- Full UI faithfully matching the design: macOS window chrome, sidebar (Pages / Apps /
  Certificates / Settings), both layout variants (A inspector, B DevTools + waterfall),
  flow table with status/method color-coding + filter chips + text filter, request
  inspector with all tabs + sensitive-header masking, empty / app-detail / cert / settings
  states, and the Add Page / Add App / Cert Guide modals.
- Tauri v2 shell that compiles and wires the `invoke` command surface from spec §13.

Implemented (Chrome Session MVP):

- SQLite Flow Store with JSON/HAR export (sensitive values masked by default).
- mitmproxy/mitmdump proxy runtime with real JSONL flow events synced into SQLite.
- Chrome session launcher with isolated profile + proxy args.
- Certificate manager (generate / status / guide / remove).
- App scanner + normal launch entry.
- Frontend wired to Tauri commands — runtime no longer imports `mockData`.

## Icons

`src-tauri/icons/*.png` are generated placeholders (brand mark from `logo.svg`). For a
full icon set incl. `.icns`/`.ico`, run `bun run tauri icon path/to/icon.png`.

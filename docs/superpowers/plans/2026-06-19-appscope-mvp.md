# AppScope MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Chrome Session MVP so AppScope captures, persists, displays, and exports real HTTP flows without using `src/data/mockData.ts` as the runtime data source.

**Architecture:** Keep the existing Tauri v2 + React shell, but move product state to a Rust core with a SQLite Flow Store and Tauri command/event boundary. Use mitmdump as the proxy runtime: embedded sidecar when packaged, PATH fallback in development, and a mitmproxy addon that writes real flow events to a session JSONL file that Rust syncs into SQLite.

**Tech Stack:** Tauri v2, Rust 2021, rusqlite, React 18, TypeScript, Vite, mitmproxy/mitmdump, macOS Chrome/Keychain/filesystem.

---

## File Structure

- Modify `src-tauri/Cargo.toml`: add SQLite/test dependencies.
- Create `src-tauri/src/models.rs`: shared serializable Page/App/Session/Flow/CA/export models.
- Create `src-tauri/src/paths.rs`: AppScope support directory layout.
- Create `src-tauri/src/store.rs`: SQLite schema, migrations, CRUD, flow sync helpers.
- Create `src-tauri/src/export.rs`: JSON and HAR export generation with sensitive value masking.
- Create `src-tauri/src/proxy.rs`: mitmdump discovery, addon script generation, process start/stop, JSONL flow parsing.
- Create `src-tauri/src/chrome.rs`: Chrome discovery and isolated profile launch.
- Create `src-tauri/src/cert.rs`: Local CA status/generate/open/remove actions.
- Create `src-tauri/src/apps.rs`: installed app scanning and normal app launch.
- Modify `src-tauri/src/commands.rs`: replace stubs with real command wrappers.
- Modify `src-tauri/src/lib.rs`: register new commands and modules.
- Create `src-tauri/src/bin/verify_mvp_capture.rs`: command-line verifier for real HTTP capture persistence.
- Modify `package.json`: add `verify:mvp-capture`.
- Create `src/api.ts`: typed Tauri invoke wrappers and event helpers.
- Modify `src/types.ts`: align frontend types with command payloads.
- Modify `src/App.tsx`: remove `mockData`, load real pages/apps/flows, handle session state.
- Modify `src/components/modals/AddPageModal.tsx`: controlled URL save/open callbacks.
- Modify `src/components/modals/AddAppModal.tsx`: render scan results and save selected app.
- Modify `src/components/CertManager.tsx`: render real CA state/actions.
- Modify `src/components/FlowTable.tsx` and `src/components/FlowDetail.tsx` only as needed for nullable real fields.
- Create `scripts/` only if needed for verifier helpers; prefer the Rust verifier binary.

---

### Task 1: Rust Flow Store, Models, And Export Tests

**Files:**
- Modify: `src-tauri/Cargo.toml:15-18`
- Create: `src-tauri/src/models.rs`
- Create: `src-tauri/src/paths.rs`
- Create: `src-tauri/src/store.rs`
- Create: `src-tauri/src/export.rs`
- Modify: `src-tauri/src/lib.rs:1-22`

Current excerpt:

```rust
// src-tauri/src/commands.rs:8-28
use serde::Serialize;

#[derive(Serialize)]
pub struct AppInfo {
    pub name: String,
    pub bundle_id: String,
    pub app_path: String,
    pub icon_path: Option<String>,
}
```

**Scope boundary:** In scope: schema, migrations, CRUD, body preview fields, masking, JSON/HAR generation from stored data. Out of scope: proxy process, Chrome launch, frontend UI.

- [ ] **Step 1: Write failing Rust tests**

Add tests in `store.rs` and `export.rs` that create a temp AppScope data directory, insert one page/session/flow with `authorization`, `cookie`, and `set-cookie`, then assert:
- `list_flows(session_id)` returns the persisted flow.
- `get_flow_detail(flow_id)` returns headers and previews.
- JSON/HAR export masks sensitive values.

- [ ] **Step 2: Run tests and confirm red**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml store::tests export::tests
```

Expected: FAIL with missing modules/functions.

- [ ] **Step 3: Implement minimal models/store/export**

Use `rusqlite` with `bundled` if the environment requires it. Keep one model per concept and avoid repository abstractions. Use real SQLite, not JSON files.

- [ ] **Step 4: Run tests and confirm green**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml store::tests export::tests
```

Expected: PASS.

- [ ] **Done standard:** `cargo test --manifest-path src-tauri/Cargo.toml store::tests export::tests` exits 0 and export tests prove sensitive values are masked.

- [ ] **Escape hatch:** If adding `rusqlite` cannot fetch/build due registry issues, STOP and report the exact cargo error; do not replace SQLite with JSON persistence.

---

### Task 2: Proxy Runtime And Real Capture Verifier

**Files:**
- Create: `src-tauri/src/proxy.rs`
- Create: `src-tauri/src/bin/verify_mvp_capture.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `package.json:7-14`
- Test: Rust tests inside `proxy.rs`; verifier binary as integration command

Current excerpt:

```rust
// src-tauri/src/commands.rs:36-40
pub fn open_page_with_capture(page_id: String) -> Result<SessionInfo, String> {
    let _ = page_id;
    Err("not implemented: proxy sidecar + Chrome session capture pending (spec §6–8)".into())
}
```

**Scope boundary:** In scope: discover `mitmdump`, create addon file, start proxy on an available port, write real response flow events to JSONL, sync JSONL into SQLite, stop proxy. Out of scope: Chrome GUI launch and CA Keychain trust.

- [ ] **Step 1: Write failing proxy tests**

Tests should validate:
- `find_mitmdump()` returns a useful missing error when absent.
- `parse_flow_event_json()` maps a mitmproxy event into a Flow insert payload.
- `sync_event_file()` persists a flow into a temp SQLite database.

- [ ] **Step 2: Write failing verifier command**

Add `src-tauri/src/bin/verify_mvp_capture.rs` that:
- starts a local HTTP server,
- starts AppScope proxy runtime,
- sends one HTTP request through the proxy using `curl`,
- syncs the event file into SQLite,
- verifies at least one real flow was persisted,
- prints `MVP capture verified: real flow persisted`.

- [ ] **Step 3: Run and confirm red**

Run:

```bash
bun run verify:mvp-capture
```

Expected before implementation: FAIL. If `mitmdump` is missing, expected failure must explicitly say `mitmdump not found`.

- [ ] **Step 4: Implement minimal proxy/addon/verifier**

The mitmproxy addon must write real flow events, not generated sample data. The verifier may use HTTP to avoid CA/Keychain automation.

- [ ] **Step 5: Run verifier**

Run:

```bash
bun run verify:mvp-capture
```

Expected:

```text
MVP capture verified: real flow persisted
```

- [ ] **Done standard:** `bun run verify:mvp-capture` exits 0 and prints the exact expected line after a real proxied HTTP request.

- [ ] **Escape hatch:** If `mitmdump` is absent, STOP and request either mitmproxy installation or a packaged sidecar path; do not fake proxy events.

---

### Task 3: Chrome Session And Tauri Commands

**Files:**
- Create: `src-tauri/src/chrome.rs`
- Modify: `src-tauri/src/commands.rs:30-85`
- Modify: `src-tauri/src/lib.rs:1-22`
- Test: Rust tests in `chrome.rs` and command-core tests

Current excerpt:

```rust
// src-tauri/src/lib.rs:12-22
.invoke_handler(tauri::generate_handler![
    scan_installed_apps,
    open_page_with_capture,
    stop_session,
    list_flows,
    get_flow_detail,
    get_certificate_status,
    generate_certificate,
    open_certificate_guide,
    remove_certificate,
])
```

**Scope boundary:** In scope: save/list pages, start Chrome with isolated profile and proxy args, stop session, list/sync flows, get detail, export command. Out of scope: CDP features and full browser automation.

- [ ] **Step 1: Write failing tests**

Test URL validation, profile path generation, Chrome path discovery error handling, command-core behavior for `open_page_with_capture` when proxy is unavailable.

- [ ] **Step 2: Run red tests**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml chrome::tests commands::tests
```

Expected: FAIL with missing functions.

- [ ] **Step 3: Implement command-core functions**

Expose Tauri commands as thin wrappers over testable Rust functions. Return structured error strings/codes for ChromeNotFound, ProxyNotFound, DatabaseError, and InvalidUrl.

- [ ] **Step 4: Run tests**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml chrome::tests commands::tests
```

Expected: PASS.

- [ ] **Done standard:** Tauri command wrappers compile, core command tests pass, and `cargo test --manifest-path src-tauri/Cargo.toml` exits 0.

- [ ] **Escape hatch:** If Chrome is not installed, command tests must still pass by asserting the correct ChromeNotFound error; do not hardcode a fake Chrome success.

---

### Task 4: CA Management And App Entry

**Files:**
- Create: `src-tauri/src/cert.rs`
- Create: `src-tauri/src/apps.rs`
- Modify: `src-tauri/src/commands.rs:30-85`
- Modify: `src-tauri/src/lib.rs`
- Test: Rust tests in `cert.rs` and `apps.rs`

Current excerpt:

```rust
// src-tauri/src/commands.rs:64-85
pub fn get_certificate_status() -> Result<CertificateStatus, String> {
    Ok(CertificateStatus {
        state: "NotGenerated".into(),
    })
}
```

**Scope boundary:** In scope: CA file status, generate/open/remove local CA assets, Keychain trust detection best effort, scan `.app` bundles, normal app launch. Out of scope: automatic admin password entry, System Proxy Capture, Transparent Capture.

- [ ] **Step 1: Write failing tests**

Tests cover CA status from temp cert directory, remove CA files, app scan parsing from a fake `.app/Contents/Info.plist`, and launch command construction without executing real apps.

- [ ] **Step 2: Run red tests**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml cert::tests apps::tests
```

Expected: FAIL with missing modules.

- [ ] **Step 3: Implement CA and app entry logic**

Use filesystem and macOS command boundaries directly. Keep Keychain operations explicit and best-effort; user trust remains manual.

- [ ] **Step 4: Run tests**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml cert::tests apps::tests
```

Expected: PASS.

- [ ] **Done standard:** `cargo test --manifest-path src-tauri/Cargo.toml cert::tests apps::tests` exits 0, CA status is not hardcoded, and app scan tests use a real fake `.app` fixture.

- [ ] **Escape hatch:** If macOS `security`, `open`, or `plutil` behavior differs, STOP and report exact command/output; do not show Trusted unless detected.

---

### Task 5: Frontend Real Data Integration

**Files:**
- Create: `src/api.ts`
- Modify: `src/types.ts:1-91`
- Modify: `src/App.tsx:1-180`
- Modify: `src/components/modals/AddPageModal.tsx:25-66`
- Modify: `src/components/modals/AddAppModal.tsx:1-43`
- Modify: `src/components/CertManager.tsx:1-85`
- Modify if needed: `src/components/FlowTable.tsx`, `src/components/FlowDetail.tsx`, `src/components/Sidebar.tsx`, `src/components/AppDetail.tsx`

Current excerpt:

```tsx
// src/App.tsx:3-4
import { useMemo, useState } from "react";
import { buildAppData } from "./data/mockData";
```

**Scope boundary:** In scope: load real pages/apps/flows through Tauri invoke, save/open page, scan/save/launch app, CA actions, export actions, visible error states. Out of scope: redesigning the visual system or adding marketing/landing pages.

- [ ] **Step 1: Write failing frontend checks**

Add the no-mock verification into `package.json` or rely on N6 command:

```bash
bash -lc "! rg 'mockData' src --glob '!data/mockData.ts'"
```

Expected before implementation: FAIL because `src/App.tsx` imports `mockData`.

- [ ] **Step 2: Implement `src/api.ts`**

Wrap `@tauri-apps/api/core` `invoke` calls. In browser-only Vite mode, return explicit `Tauri backend unavailable` errors rather than mock data.

- [ ] **Step 3: Replace App state source**

Remove `buildAppData()`. Load pages/apps on mount, select real active page/app, poll or refresh flows for active session, and preserve existing table/detail layout.

- [ ] **Step 4: Wire modals and CertManager**

Convert static modal values into controlled submit callbacks. Render real scan results and CA status. Keep System Proxy/Transparent modes disabled or Coming Soon.

- [ ] **Step 5: Run checks**

Run:

```bash
bun run build
bash -lc "! rg 'mockData' src --glob '!data/mockData.ts'"
```

Expected: both exit 0.

- [ ] **Done standard:** `bun run build` exits 0 and the no-mock grep command exits 0.

- [ ] **Escape hatch:** If Tauri invoke types differ, STOP and inspect official installed `@tauri-apps/api` types; do not introduce a runtime mock fallback.

---

### Task 6: End-To-End Verification And Documentation

**Files:**
- Modify: `package.json:7-14`
- Modify: `docs/COMMANDS.md`
- Modify: `README.md`
- Modify: `docs/spec/appscope-mvp/spec.md`

Current excerpt:

```json
// package.json:7-14
"scripts": {
  "dev": "vite",
  "build": "tsc --noEmit && vite build",
  "preview": "vite preview",
  "tauri": "tauri",
  "tauri:dev": "tauri dev",
  "tauri:build": "tauri build"
}
```

**Scope boundary:** In scope: final command wiring, docs update, N5/N6 evidence capture. Out of scope: packaging notarization and release distribution.

- [ ] **Step 1: Add final verify script**

Ensure `package.json` contains:

```json
"verify:mvp-capture": "cargo run --manifest-path src-tauri/Cargo.toml --bin verify_mvp_capture"
```

- [ ] **Step 2: Run final verification commands**

Run:

```bash
bun run build
cargo test --manifest-path src-tauri/Cargo.toml
bun run verify:mvp-capture
bash -lc "! rg 'mockData' src --glob '!data/mockData.ts'"
```

Expected:
- build exits 0
- cargo tests exit 0
- verifier prints `MVP capture verified: real flow persisted`
- grep command exits 0

- [ ] **Step 3: Update docs**

Document dev prerequisite: `mitmdump` must be installed or packaged as sidecar for capture. Document that HTTPS requires trusting AppScope Local CA.

- [ ] **Done standard:** All four final commands pass and `README.md` no longer describes proxy/store/cert manager as unimplemented stubs.

- [ ] **Escape hatch:** If `mitmdump` is not installed, stop N6 and ask for install/sidecar approval; do not mark goal_condition complete.

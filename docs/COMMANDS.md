# AppScope Commands

This file is the command source of truth for the MVP spec.

## Frontend / Tauri

```bash
bun install
bun run dev
bun run build
bun run tauri:dev
bun run tauri:build
bun run verify:mvp-capture
```

Prerequisites for capture verification:
- `mitmdump` on PATH (macOS: `brew install --cask mitmproxy`)
- `curl` (macOS default)

Notes:
- `bun run build` currently maps to `tsc --noEmit && vite build`.
- `bun run dev` starts Vite on the Tauri dev URL configured in `src-tauri/tauri.conf.json`.
- `bun run tauri:dev` compiles and runs the native Tauri shell.

## Rust

```bash
cargo test --manifest-path src-tauri/Cargo.toml
cargo build --manifest-path src-tauri/Cargo.toml
```

## MVP Verification Target

MVP capture verification:

```bash
bun run verify:mvp-capture
```

Expected final output:

```text
MVP capture verified: real flow persisted
```

The verification must prove a real captured flow is persisted and surfaced without using `src/data/mockData.ts` as the runtime data source.

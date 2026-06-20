# AppScope Engineering Standards

## Product Boundary

- MVP must deliver a real Chrome Session Capture loop, not a UI-only mock.
- Runtime data must come from Tauri/Rust commands, persisted flow storage, or live events; `src/data/mockData.ts` may remain only as test fixture/demo data if not imported by production runtime.
- MVP should use mitmproxy sidecar first. Do not start by building a full custom Rust MITM proxy.
- Transparent capture for arbitrary macOS apps, Network Extension, SSL pinning bypass, mobile capture, cloud sync, and malicious traffic tooling are out of scope.

## Security And Privacy

- Capture only user-started sessions by default.
- Keep CA private keys and captured traffic local.
- Do not capture banking, payment, password manager, or other sensitive apps.
- Mask sensitive headers/cookies by default in UI and exports.
- Any system proxy or certificate change must have a recovery path.

## Architecture

- Frontend: React 18 + TypeScript + Vite.
- Shell/backend: Tauri v2 + Rust.
- Storage target: SQLite plus file-backed large bodies under the AppScope application support directory.
- External runtime boundary: Chrome, mitmproxy sidecar/addon, macOS Keychain/security tooling, filesystem exports.

## Testing Discipline

- High-risk implementation must follow TDD.
- TDD Guard is configured as a Codex hook, but it has shown fail-closed behavior during manual validation; if it blocks all implementation, stop and use the `/spec` failure branch instead of bypassing it silently.
- Every task in N4 must include a machine-executable Done command and expected output.

## Repository Constraint

This directory is currently not a git repository. Until git is initialized, spec drift tracking and unrelated-diff checks must be recorded with explicit file lists and command outputs instead of `git diff`.

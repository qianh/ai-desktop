## Context

AppScope (ai-desktop) is a Tauri v2 + React app using inline styles and CSS variables. The reference project hcode is a packaged ZCode Desktop Electron build with no TypeScript source — layout patterns are reverse-engineered from `out/renderer/assets/index-*.js`.

N1 decisions lock: 48px header, draggable sidebar (264px default, persisted), records in sidebar, content card, 3-tab side pane, master-detail settings, App Chat threads in app sidebar.

## Goals / Non-Goals

**Goals:**

- Align workspace shell partition and interaction with hcode (sidebar ‖ resize ‖ content card ‖ side pane).
- Keep `APP_TITLE_BAR_H` and Rust WebView bounds in sync at 48px.
- Preserve all five style presets and light/dark/system themes.
- Preserve capture, flow store, WebView embed, and Supabase upload behavior.

**Non-Goals:**

- Import Tailwind, Radix, `@zcode/ui`, or `react-resizable-panels`.
- Port ZCode workspace/task/git/terminal/wiki tabs.
- Mobile breakpoint overlay sidebar.
- Startup loading logo animation.
- Change Tauri command signatures or Rust business logic beyond bounds constants.

## Decisions

1. **Pure CSS/JS resize handles instead of react-resizable-panels.**
   - Rationale: N1 non-goal forbids the library; pointer-driven width on CSS variables is sufficient.
   - Alternative rejected: react-resizable-panels — dependency conflict with project constraints.

2. **Chrome Contract centralizes dimensions in `chromeLayout.ts`.**
   - Constants: `APP_TITLE_BAR_H = 48`, `APP_SIDEBAR_DEFAULT_W = 264`, `APP_SIDEBAR_MIN_W`, `APP_SIDEBAR_ICON_RAIL_W = 40`, `SIDE_PANE_MIN_W`, `CONTENT_CARD_RADIUS`, `CONTENT_CARD_PADDING`.
   - Rust `page_webview.rs` reads the same title bar height via shared comment contract (already exists for 39px).
   - Alternative rejected: scattered magic numbers in components.

3. **Side Pane replaces inspector overlay model.**
   - Tabs: Flows → `FlowTable`+`FlowDetail`; Intercepts → `InterceptPanel`; DevTools → existing `openPageWebviewDevtools` / `openMainDevtools` actions.
   - Width persisted separately from sidebar (`appscope:shell:side-pane-width-px`).
   - Alternative rejected: keep absolute `left: 58%` overlay — inconsistent with hcode side pane.

4. **App Chat threads as Sidebar section, not nested 220px rail.**
   - When `navMode === "app-chat"`, sidebar shows thread list section; main area is chat transcript + composer only.
   - Alternative rejected: nested `AppChatWorkspace` sidebar — conflicts with hcode single-rail IA.

5. **Settings master-detail with grouped nav sections.**
   - Left nav groups: General, Capture, Certificates, Data & Reporting, App Chat, Appearance.
   - Right pane renders existing settings forms without rewriting field logic.

## Risks / Trade-offs

- [Risk] WebView misalignment after header 39→48 and content card padding.
  → Mitigation: update `pageWebviewBounds.ts` tests first; verify against `page_webview.rs`.

- [Risk] Side pane tab migration breaks `derivePagePanelState` assumptions.
  → Mitigation: extend `pagePanelState.ts` with `sidePaneTab` + `sidePaneOpen`; add unit tests.

- [Risk] App Chat thread list in sidebar increases sidebar complexity.
  → Mitigation: collapsible "Threads" section; preserve `chatApi` / global memory wiring.

- [Risk] hcode bundle-only reference leads to pixel drift.
  → Mitigation: acceptance via structural tests + manual screenshot checklist, not pixel-perfect diff.

## Migration Plan

1. Bump chrome constants + Rust sync (TDD).
2. Introduce `AppShell` grid without changing nav handlers.
3. Sidebar resize + persistence.
4. Content card wrapper + bounds recalc.
5. Side pane tabs (migrate inspector content).
6. Settings master-detail shell.
7. App Chat sidebar integration.
8. Move session records to sidebar; remove TitleBar records button.

## Open Questions

- None blocking — N1 resolved all layout forks.
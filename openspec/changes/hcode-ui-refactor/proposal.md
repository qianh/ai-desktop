## Why

AppScope's current layout shell (39px TitleBar, fixed-width sidebar, flat content area, TitleBar session-records entry, nested App Chat sidebar) diverges from the hcode (ZCode Desktop) workspace shell the user wants to reference. The gap affects information architecture, resize behavior, and WebView chrome alignment.

This change refactors the **layout shell only** — aligning partition structure and interaction rhythm with hcode while preserving capture, WebView, and Supabase business logic.

## What Changes

- Workspace Header (TitleBar) height SHALL become **48px**, synced with Rust `page_webview` bounds.
- App Sidebar SHALL support **drag resize** (default 264px), **collapse to icon rail**, and **localStorage persistence**.
- Session Records navigation SHALL move from TitleBar into App Sidebar.
- Main workspace content SHALL render inside a **rounded Content Card** container.
- Right **Side Pane** SHALL become a multi-tab panel: **Flows**, **Intercepts**, **DevTools** — each resizable.
- Settings SHALL use **master-detail** navigation (left nav + right detail).
- App Chat thread list SHALL move into App-level Sidebar; main area shows chat content only.
- Shell-level CSS variables SHALL be added; existing `data-style` / `data-theme` presets remain compatible.

## Capabilities

### New Capabilities

- `layout-shell`: hcode-aligned workspace shell — resizable sidebar, content card, side pane tabs, master-detail settings, chrome contract.

### Modified Capabilities

- None at OpenSpec baseline level. Prior UI work lives in `docs/spec/ui-minimal-premium/spec.md` and is **extended**, not replaced.

## Impact

- Shell: `src/App.tsx`, new `src/components/AppShell.tsx` (or `src/lib/shellLayout.ts`)
- Chrome: `src/components/TitleBar.tsx`, `src/lib/chromeLayout.ts`, `src-tauri/src/page_webview.rs`
- Navigation: `src/components/Sidebar.tsx`, `src/components/AppChatWorkspace.tsx`, `src/components/Settings.tsx`
- Workspace: `src/components/SessionsWorkspace.tsx`, `src/lib/pagePanelState.ts`, `src/lib/pageWebviewBounds.ts`
- Side pane: new `src/components/SidePane.tsx`, migrate `FlowTable`, `InterceptPanel`, DevTools entry
- Theme: `src/index.css`, `src/theme/tokens.css`
- Tests: new shell layout tests + update `pageWebviewBounds.test.ts`, `Sidebar.*.test.ts`, `AppChatWorkspace.test.ts`
- Reference (read-only): `/Users/hong/John/ai/hcode/out/renderer/`
- Out of scope: Tailwind/Radix/react-resizable-panels, ZCode task system, mobile responsive, Rust command signatures, Supabase schema
## ADDED Requirements

### Requirement: Workspace header height
The system SHALL use a 48px workspace header (TitleBar) height, synchronized between TypeScript and Rust WebView bounds.

#### Scenario: Chrome constant
- **WHEN** `src/lib/chromeLayout.ts` is read
- **THEN** `APP_TITLE_BAR_H` equals `48`

#### Scenario: Rust sync
- **WHEN** `src-tauri/src/page_webview.rs` computes logical WebView top offset
- **THEN** it uses the same 48px title bar height documented in the chrome contract comment

### Requirement: Resizable app sidebar
The system SHALL provide a draggable App Sidebar with default width 264px, minimum width constraint, collapse to icon rail, and localStorage persistence across restarts.

#### Scenario: Default width
- **WHEN** the app loads and no persisted sidebar width exists
- **THEN** the sidebar width is 264px

#### Scenario: Drag resize
- **WHEN** the user drags the sidebar resize handle horizontally
- **THEN** the sidebar width updates in real time via CSS variable `--shell-sidebar-w`

#### Scenario: Persist width
- **WHEN** the user finishes a sidebar resize
- **THEN** the width is saved to localStorage key `appscope:shell:sidebar-width-px`

#### Scenario: Collapse
- **WHEN** the user toggles sidebar collapse
- **THEN** the sidebar shows the icon rail at 40px width without losing persisted expanded width

### Requirement: Session records in sidebar
The system SHALL expose Session Records navigation from the App Sidebar, not from the TitleBar.

#### Scenario: Sidebar entry
- **WHEN** the sidebar is rendered
- **THEN** a Records nav item is visible and sets `navMode` to `"records"`

#### Scenario: TitleBar removed
- **WHEN** the TitleBar is rendered
- **THEN** it does not contain a session-records toggle button

### Requirement: Content card container
The system SHALL wrap the active workspace main area in a rounded Content Card with border and background tokens compatible with all style presets.

#### Scenario: Card present in sessions mode
- **WHEN** `navMode` is `"sessions"` and a page session is active
- **THEN** the WebView and session chrome render inside a Content Card container with non-zero border radius

#### Scenario: WebView bounds account for card padding
- **WHEN** page WebView bounds are measured
- **THEN** horizontal and vertical insets include Content Card padding so the embedded page does not overlap the card border

### Requirement: Multi-tab side pane
The system SHALL provide a right Side Pane with tabs Flows, Intercepts, and DevTools, each showing the existing panel content for that capability.

#### Scenario: Flows tab
- **WHEN** the Side Pane is open and the Flows tab is active
- **THEN** `FlowTable` and `FlowDetail` (or equivalent flow inspector) are visible in the pane

#### Scenario: Intercepts tab
- **WHEN** the Side Pane is open and the Intercepts tab is active
- **THEN** `InterceptPanel` content is visible in the pane

#### Scenario: DevTools tab
- **WHEN** the Side Pane is open and the DevTools tab is active and a page WebView is inspectable
- **THEN** the user can trigger page or main DevTools from the pane without a TitleBar DevTools button

#### Scenario: Pane resize
- **WHEN** the user drags the side pane resize handle
- **THEN** the pane width updates and is persisted to localStorage key `appscope:shell:side-pane-width-px`

### Requirement: Settings master-detail
The system SHALL render Settings as a master-detail layout with left navigation and right detail content.

#### Scenario: Two-column layout
- **WHEN** `navMode` is `"settings"`
- **THEN** Settings displays a left nav column and a right detail column

#### Scenario: Nav switches section
- **WHEN** the user selects a settings section in the left nav
- **THEN** the right detail area shows that section's existing form fields

### Requirement: App Chat in app sidebar
The system SHALL show App Chat thread list in the App Sidebar and render only chat content in the main workspace area.

#### Scenario: Thread list location
- **WHEN** `navMode` is `"app-chat"`
- **THEN** the thread list appears in the App Sidebar, not in a nested secondary sidebar inside the main area

#### Scenario: Main chat area
- **WHEN** `navMode` is `"app-chat"` and a thread is selected
- **THEN** the main workspace shows the conversation transcript and composer without a duplicate thread rail

### Requirement: Theme compatibility
The system SHALL keep existing appearance presets (`data-style`, `data-theme`, `data-glass`) visually correct after the shell refactor.

#### Scenario: All presets build
- **WHEN** `bun run build` executes after the shell refactor
- **THEN** it exits with code 0

#### Scenario: Tests pass
- **WHEN** `bun run test` executes after the shell refactor
- **THEN** it exits with code 0
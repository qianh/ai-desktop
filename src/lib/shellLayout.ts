import {
  APP_SIDEBAR_DEFAULT_W,
  APP_SIDEBAR_ICON_RAIL_W,
  APP_SIDEBAR_MIN_W,
  APP_SIDE_PANE_DEFAULT_W,
  APP_SIDE_PANE_MIN_W,
} from "./chromeLayout";

export type SidePaneTab = "flows" | "intercepts" | "devtools";

export const SHELL_SIDEBAR_WIDTH_KEY = "appscope:shell:sidebar-width-px";
export const SHELL_SIDE_PANE_WIDTH_KEY = "appscope:shell:side-pane-width-px";

export type ShellLayoutState = {
  sidebarWidthPx: number;
  sidebarCollapsed: boolean;
  sidePaneWidthPx: number;
  sidePaneOpen: boolean;
  sidePaneTab: SidePaneTab;
  effectiveSidebarWidthPx: number;
};

export function clampSidebarWidth(
  widthPx: number,
  viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280,
): number {
  const max = Math.max(APP_SIDEBAR_MIN_W, Math.floor(viewportWidth * 0.5));
  return Math.min(max, Math.max(APP_SIDEBAR_MIN_W, Math.round(widthPx)));
}

export function clampSidePaneWidth(
  widthPx: number,
  viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280,
): number {
  const max = Math.max(APP_SIDE_PANE_MIN_W, Math.floor(viewportWidth * 0.65));
  return Math.min(max, Math.max(APP_SIDE_PANE_MIN_W, Math.round(widthPx)));
}

export function saveSidebarWidth(widthPx: number): void {
  localStorage.setItem(SHELL_SIDEBAR_WIDTH_KEY, String(clampSidebarWidth(widthPx)));
}

export function saveSidePaneWidth(widthPx: number): void {
  localStorage.setItem(SHELL_SIDE_PANE_WIDTH_KEY, String(clampSidePaneWidth(widthPx)));
}

function readStoredWidth(key: string, fallback: number, clamp: (n: number) => number): number {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(parsed);
}

export function loadShellLayoutState(
  overrides: Partial<Pick<ShellLayoutState, "sidebarCollapsed" | "sidePaneOpen" | "sidePaneTab">> = {},
): ShellLayoutState {
  const sidebarWidthPx = readStoredWidth(
    SHELL_SIDEBAR_WIDTH_KEY,
    APP_SIDEBAR_DEFAULT_W,
    (n) => clampSidebarWidth(n),
  );
  const sidePaneWidthPx = readStoredWidth(
    SHELL_SIDE_PANE_WIDTH_KEY,
    APP_SIDE_PANE_DEFAULT_W,
    (n) => clampSidePaneWidth(n),
  );
  const sidebarCollapsed = overrides.sidebarCollapsed ?? false;
  const sidePaneOpen = overrides.sidePaneOpen ?? false;
  const sidePaneTab = overrides.sidePaneTab ?? "flows";

  return {
    sidebarWidthPx,
    sidebarCollapsed,
    sidePaneWidthPx,
    sidePaneOpen,
    sidePaneTab,
    effectiveSidebarWidthPx: sidebarCollapsed ? APP_SIDEBAR_ICON_RAIL_W : sidebarWidthPx,
  };
}
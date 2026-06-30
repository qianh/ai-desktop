import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  APP_SIDEBAR_DEFAULT_W,
  APP_SIDEBAR_ICON_RAIL_W,
  APP_SIDEBAR_MIN_W,
} from "./chromeLayout";
import {
  clampSidebarWidth,
  loadShellLayoutState,
  saveSidebarWidth,
  SHELL_SIDEBAR_WIDTH_KEY,
} from "./shellLayout";

function makeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

describe("shellLayout", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeStorage());
    vi.stubGlobal("window", { innerWidth: 1280 });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("clamps sidebar width between min and max", () => {
    expect(clampSidebarWidth(100)).toBe(APP_SIDEBAR_MIN_W);
    expect(clampSidebarWidth(APP_SIDEBAR_DEFAULT_W)).toBe(APP_SIDEBAR_DEFAULT_W);
    expect(clampSidebarWidth(9999)).toBeLessThanOrEqual(window.innerWidth * 0.5);
  });

  it("persists sidebar width to localStorage", () => {
    saveSidebarWidth(300);
    expect(localStorage.getItem(SHELL_SIDEBAR_WIDTH_KEY)).toBe("300");
  });

  it("loads persisted sidebar width", () => {
    localStorage.setItem(SHELL_SIDEBAR_WIDTH_KEY, "280");
    const state = loadShellLayoutState();
    expect(state.sidebarWidthPx).toBe(280);
  });

  it("falls back to defaults when storage is empty", () => {
    const state = loadShellLayoutState();
    expect(state.sidebarWidthPx).toBe(APP_SIDEBAR_DEFAULT_W);
    expect(state.sidebarCollapsed).toBe(false);
    expect(state.sidePaneOpen).toBe(false);
    expect(state.sidePaneTab).toBe("flows");
  });

  it("uses icon rail width when collapsed", () => {
    const state = loadShellLayoutState({ sidebarCollapsed: true });
    expect(state.effectiveSidebarWidthPx).toBe(APP_SIDEBAR_ICON_RAIL_W);
  });
});
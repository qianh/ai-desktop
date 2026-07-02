import { describe, expect, it } from "vitest";
import { derivePagePanelState, deriveWorkspaceChrome } from "./pagePanelState";

const basePanel = {
  activeId: "page-a",
  pageId: "page-a",
  hasSessionForPage: true,
  deleteTargetId: null as string | null,
  overlayOpen: false,
};

describe("derivePagePanelState", () => {
  it("returns visible for active page capture in sessions mode", () => {
    expect(
      derivePagePanelState({ ...basePanel, navMode: "sessions" }),
    ).toBe("visible");
  });

  it("returns hidden in records mode so native webview does not cover the overlay", () => {
    expect(
      derivePagePanelState({ ...basePanel, navMode: "records" }),
    ).toBe("hidden");
  });

  it("returns layout-only when modal overlay blocks capture chrome", () => {
    expect(
      derivePagePanelState({ ...basePanel, navMode: "sessions", overlayOpen: true }),
    ).toBe("layout-only");
  });

  it("returns hidden for non-active pages", () => {
    expect(
      derivePagePanelState({ ...basePanel, navMode: "sessions", pageId: "page-b" }),
    ).toBe("hidden");
  });
});

describe("deriveWorkspaceChrome", () => {
  it("shows page capture only in sessions with an active session", () => {
    const chrome = deriveWorkspaceChrome({
      navMode: "sessions",
      hasActiveSession: true,
      deleteTargetId: null,
      flowCount: 3,
      loading: false,
    });
    expect(chrome.showPageCapture).toBe(true);
    expect(chrome.showFlows).toBe(true);
    expect(chrome.showEmpty).toBe(false);
  });

  it("hides page capture in records mode while keeping flows flag for fallback table", () => {
    const chrome = deriveWorkspaceChrome({
      navMode: "records",
      hasActiveSession: true,
      deleteTargetId: null,
      flowCount: 2,
      loading: false,
    });
    expect(chrome.showPageCapture).toBe(false);
    expect(chrome.showFlows).toBe(false);
  });
});

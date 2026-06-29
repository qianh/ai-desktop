export type NavMode = "sessions" | "records" | "settings" | "app-chat";

/** Per-page capture panel visibility derived from workspace navigation state. */
export type PagePanelState = "hidden" | "layout-only" | "visible";

export type DerivePagePanelInput = {
  navMode: NavMode;
  activeId: string;
  pageId: string;
  hasSessionForPage: boolean;
  deleteTargetId: string | null;
  overlayOpen: boolean;
};

export function derivePagePanelState(input: DerivePagePanelInput): PagePanelState {
  const {
    navMode,
    activeId,
    pageId,
    hasSessionForPage,
    deleteTargetId,
    overlayOpen,
  } = input;

  if (!hasSessionForPage || activeId !== pageId) {
    return "hidden";
  }

  if (navMode === "records") {
    return "layout-only";
  }

  if (navMode !== "sessions") {
    return "hidden";
  }

  if (deleteTargetId !== null || overlayOpen) {
    return "layout-only";
  }

  return "visible";
}

export type DeriveWorkspaceChromeInput = {
  navMode: NavMode;
  hasActiveSession: boolean;
  deleteTargetId: string | null;
  flowCount: number;
  loading: boolean;
};

export type WorkspaceChrome = {
  showPageCapture: boolean;
  showEmpty: boolean;
  showDeletePlaceholder: boolean;
  showFlows: boolean;
};

export function deriveWorkspaceChrome(input: DeriveWorkspaceChromeInput): WorkspaceChrome {
  const { navMode, hasActiveSession, deleteTargetId, flowCount, loading } = input;
  const sessionsMode = navMode === "sessions";

  const showPageCapture =
    sessionsMode && hasActiveSession && deleteTargetId === null;

  return {
    showPageCapture,
    showEmpty:
      sessionsMode && !showPageCapture && flowCount === 0 && !loading && deleteTargetId === null,
    showDeletePlaceholder: sessionsMode && deleteTargetId !== null && !showPageCapture,
    showFlows: sessionsMode && flowCount > 0,
  };
}

export function pageListIdentityKey(pages: { id: string; name: string; host: string; letter: string; color: string }[]): string {
  return pages.map((p) => `${p.id}|${p.name}|${p.host}|${p.letter}|${p.color}`).join("\n");
}

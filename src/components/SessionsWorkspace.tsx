import type { RefObject } from "react";
import type { Flow, InterceptedFetch, Page } from "../types";
import { isDefaultChatPage } from "../lib/ensureDefaultPage";
import { derivePagePanelState, deriveWorkspaceChrome } from "../lib/pagePanelState";
import type { NavMode } from "../lib/pagePanelState";
import PageBrowser from "./PageBrowser";
import SessionRecordsView from "./SessionRecordsView";
import EmptyState from "./EmptyState";

export type PageSessionMeta = {
  sessionId: string;
  proxyPort: number;
  pageUrl: string;
};

type Props = {
  navMode: NavMode;
  activeId: string;
  pages: Page[];
  sessionMetaByPage: Record<string, PageSessionMeta>;
  flowsByPage: Record<string, Flow[]>;
  flows: Flow[];
  interceptsByPage: Record<string, InterceptedFetch[]>;

  loading: boolean;
  deleteTargetId: string | null;
  overlayOpen: boolean;
  variant: "A" | "B";
  query: string;
  filter: string;
  selectedFlowId: string | null;
  recording: boolean;
  captureBusy: boolean;
  onSelectFlow: (flowId: string) => void;
  onQuery: (v: string) => void;
  onFilter: (v: string) => void;
  onToggleRecord: () => void;
  onClearFlows: () => void;
  onStartCapture: (pageId: string) => void;
  sidebarRef?: RefObject<HTMLElement | null>;
};

const LAYER = {
  capture: 1,
  records: 2,
  transient: 3,
} as const;

export default function SessionsWorkspace(p: Props) {
  const hasActiveSession = !!p.sessionMetaByPage[p.activeId];
  const chrome = deriveWorkspaceChrome({
    navMode: p.navMode,
    hasActiveSession,
    deleteTargetId: p.deleteTargetId,
    flowCount: p.flows.length,
    loading: p.loading,
  });

  const isInterceptReportingEnabled = (id: string) => {
    const page = p.pages.find((pg) => pg.id === id);
    if (page && isDefaultChatPage(page.host)) return true;
    return page?.interceptReportingEnabled ?? false;
  };

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--c-bg)" }}>
      {p.navMode === "sessions" && Object.keys(p.sessionMetaByPage).length > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            minWidth: 0,
            minHeight: 0,
            height: "100%",
            alignItems: "stretch",
            zIndex: LAYER.capture,
          }}
        >
          {Object.entries(p.sessionMetaByPage).map(([pageId, meta]) => {
            const interceptReportingEnabled = isInterceptReportingEnabled(pageId);
            return (
            <PageBrowser
              key={`${pageId}-${meta.proxyPort}`}
              pageId={pageId}
              url={meta.pageUrl}
              proxyPort={meta.proxyPort}
              interceptReportingEnabled={interceptReportingEnabled}
              panelState={derivePagePanelState({
                navMode: p.navMode,
                activeId: p.activeId,
                pageId,
                hasSessionForPage: true,
                deleteTargetId: p.deleteTargetId,
                overlayOpen: p.overlayOpen,
              })}
              sidebarRef={p.sidebarRef}
            />
          );
          })}
        </div>
      )}

      <div
        className="asc-session-records"
        style={{
          position: "absolute",
          inset: 0,
          display: p.navMode === "records" ? "flex" : "none",
          flexDirection: "column",
          zIndex: LAYER.records,
          background: "var(--c-bg)",
          isolation: "isolate",
        }}
      >
        <SessionRecordsView pages={p.pages} />
      </div>

      {chrome.showDeletePlaceholder && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: LAYER.transient,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--c-text-4)",
            fontSize: 13,
            background: "var(--c-bg)",
          }}
        >
          请在弹窗中确认删除…
        </div>
      )}

      {chrome.showEmpty && (
        <div
          style={{
            position: "relative",
            zIndex: LAYER.transient,
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <EmptyState
            busy={p.captureBusy}
            onOpenCapture={p.activeId ? () => p.onStartCapture(p.activeId) : undefined}
          />
        </div>
      )}

      {p.navMode === "sessions" && p.pages.length === 0 && !p.loading && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            color: "var(--c-text-4)",
            fontSize: 13,
            zIndex: LAYER.transient,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--c-text)" }}>还没有页面</div>
          <div>点击左侧 Pages 旁的 + 添加一个 URL</div>
        </div>
      )}

    </div>
  );
}

import type { Flow, InterceptedFetch, Page } from "../types";
import { isDefaultChatPage } from "../lib/ensureDefaultPage";
import { derivePagePanelState, deriveWorkspaceChrome } from "../lib/pagePanelState";
import type { NavMode } from "../lib/pagePanelState";
import PageBrowser from "./PageBrowser";
import SessionRecordsView from "./SessionRecordsView";
import FlowTable from "./FlowTable";
import EmptyState from "./EmptyState";
import InterceptPanel from "./InterceptPanel";

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
  inspectorOpen: boolean;
  query: string;
  filter: string;
  selectedFlowId: string | null;
  recording: boolean;
  captureBusy: boolean;
  onToggleInspector: () => void;
  onSelectFlow: (flowId: string) => void;
  onQuery: (v: string) => void;
  onFilter: (v: string) => void;
  onToggleRecord: () => void;
  onClearFlows: () => void;
  onStartCapture: (pageId: string) => void;
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

  const flowTableProps = {
    flows: p.flows,
    variant: p.variant,
    showWaterfall: true as const,
    query: p.query,
    filter: p.filter,
    selectedId: p.selectedFlowId,
    recording: p.recording,
    onSelect: p.onSelectFlow,
    onQuery: p.onQuery,
    onFilter: p.onFilter,
    onToggleRecord: p.onToggleRecord,
    onClear: p.onClearFlows,
  };

  const isInterceptReportingEnabled = (id: string) => {
    const page = p.pages.find((pg) => pg.id === id);
    if (page && isDefaultChatPage(page.host)) return true;
    return page?.interceptReportingEnabled ?? false;
  };

  return (
    <div style={{ flex: 1, minHeight: 0, position: "relative", display: "flex", flexDirection: "column" }}>
      {Object.keys(p.sessionMetaByPage).length > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            minWidth: 0,
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
              inspectorOpen={p.inspectorOpen}
              onToggleInspector={p.onToggleInspector}
              requestCount={(p.flowsByPage[pageId] || []).length}
            />
          );
          })}
          {p.inspectorOpen && chrome.showPageCapture && (
            <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
              {chrome.showFlows ? (
                <FlowTable {...flowTableProps} />
              ) : (
                <EmptyState busy={p.captureBusy} />
              )}
              {isInterceptReportingEnabled(p.activeId) &&
                (p.interceptsByPage[p.activeId]?.length ?? 0) > 0 && (
                <div style={{ borderTop: "1px solid #ededf0", maxHeight: "40%", overflow: "auto" }}>
                  <div
                    style={{
                      padding: "6px 10px",
                      fontWeight: 600,
                      fontSize: 11,
                      color: "var(--c-text-2)",
                      background: "var(--c-bg-2)",
                      borderBottom: "1px solid #ededf0",
                    }}
                  >
                    Intercepted Content ({p.interceptsByPage[p.activeId].length})
                  </div>
                  <InterceptPanel intercepts={p.interceptsByPage[p.activeId]} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: p.navMode === "records" ? "flex" : "none",
          flexDirection: "column",
          zIndex: LAYER.records,
          background: "var(--c-bg)",
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

      {!chrome.showPageCapture && chrome.showFlows && <FlowTable {...flowTableProps} />}
    </div>
  );
}

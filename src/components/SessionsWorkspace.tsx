import type { AppEntry, Flow, InterceptedFetch, Page } from "../types";
import { derivePagePanelState, deriveWorkspaceChrome } from "../lib/pagePanelState";
import type { NavMode } from "../lib/pagePanelState";
import PageBrowser from "./PageBrowser";
import SessionRecordsView from "./SessionRecordsView";
import FlowTable from "./FlowTable";
import EmptyState from "./EmptyState";
import AppDetail from "./AppDetail";
import InterceptPanel from "./InterceptPanel";

export type PageSessionMeta = {
  sessionId: string;
  proxyPort: number;
  pageUrl: string;
};

type Props = {
  navMode: NavMode;
  activeId: string;
  isApp: boolean;
  pages: Page[];
  active: Page | AppEntry | undefined;
  sessionMetaByPage: Record<string, PageSessionMeta>;
  flowsByPage: Record<string, Flow[]>;
  flows: Flow[];
  interceptsByPage: Record<string, InterceptedFetch[]>;
  recordsInvalidate: number;
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
  launchMode: string;
  onToggleInspector: () => void;
  onSelectFlow: (flowId: string) => void;
  onQuery: (v: string) => void;
  onFilter: (v: string) => void;
  onToggleRecord: () => void;
  onClearFlows: () => void;
  onStartCapture: (pageId: string) => void;
  onLaunchMode: (mode: string) => void;
  onLaunchApp: (appId: string) => void;
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
    isApp: p.isApp,
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
          {Object.entries(p.sessionMetaByPage).map(([pageId, meta]) => (
            <PageBrowser
              key={`${pageId}-${meta.proxyPort}`}
              pageId={pageId}
              url={meta.pageUrl}
              proxyPort={meta.proxyPort}
              panelState={derivePagePanelState({
                navMode: p.navMode,
                activeId: p.activeId,
                pageId,
                isActiveSelectionApp: p.isApp,
                hasSessionForPage: true,
                deleteTargetId: p.deleteTargetId,
                overlayOpen: p.overlayOpen,
              })}
              inspectorOpen={p.inspectorOpen}
              onToggleInspector={p.onToggleInspector}
              requestCount={(p.flowsByPage[pageId] || []).length}
            />
          ))}
          {p.inspectorOpen && chrome.showPageCapture && (
            <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
              {chrome.showFlows ? (
                <FlowTable {...flowTableProps} />
              ) : (
                <EmptyState busy={p.captureBusy} />
              )}
              {(p.interceptsByPage[p.activeId]?.length ?? 0) > 0 && (
                <div style={{ borderTop: "1px solid #ededf0", maxHeight: "40%", overflow: "auto" }}>
                  <div
                    style={{
                      padding: "6px 10px",
                      fontWeight: 600,
                      fontSize: 11,
                      color: "#5a5a5e",
                      background: "#fbfbfc",
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
          background: "#ffffff",
        }}
      >
        <SessionRecordsView pages={p.pages} invalidateKey={p.recordsInvalidate} />
      </div>

      {chrome.showApp && p.active && "bundle" in p.active && (
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
          <AppDetail
            app={p.active}
            launchMode={p.launchMode}
            onLaunchMode={p.onLaunchMode}
            onLaunch={() => p.onLaunchApp(p.active!.id)}
          />
        </div>
      )}

      {chrome.showDeletePlaceholder && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: LAYER.transient,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#9a9aa0",
            fontSize: 13,
            background: "#ffffff",
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

      {p.navMode === "sessions" && !p.isApp && p.pages.length === 0 && !p.loading && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            color: "#9a9aa0",
            fontSize: 13,
            zIndex: LAYER.transient,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600, color: "#1d1d1f" }}>还没有页面</div>
          <div>点击左侧 Pages 旁的 + 添加一个 URL</div>
        </div>
      )}

      {!chrome.showPageCapture && chrome.showFlows && <FlowTable {...flowTableProps} />}
    </div>
  );
}
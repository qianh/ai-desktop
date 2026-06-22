// AppScope shell — owns all UI state and routes between views.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen as tauriListen } from "@tauri-apps/api/event";
import {
  generateCertificate,
  getCertificateStatus,
  installCertificate,
  getFlowDetail,
  launchApp,
  listApps,
  listFlows,
  listPages,
  mapApiApp,
  mapApiPage,
  mapFlowListItem,
  openCertificateGuide,
  closePageWebview,
  setPageWebviewVisible,
  openPageWithCapture,
  removeApp,
  removeCertificate,
  removePage,
  saveApp,
  savePage,
  stopSession,
  type ApiApp,
} from "./api";
import { fmtSize } from "./lib/format";
import type { AppEntry, Flow, InterceptedFetch, Page } from "./types";
import TitleBar from "./components/TitleBar";
import StatusBar from "./components/StatusBar";
import Sidebar from "./components/Sidebar";
import FlowTable from "./components/FlowTable";
import EmptyState from "./components/EmptyState";
import PageBrowser from "./components/PageBrowser";
import AppDetail from "./components/AppDetail";
import CertManager from "./components/CertManager";
import InterceptPanel from "./components/InterceptPanel";
import Settings, { type Toggles, loadSupabaseConfig } from "./components/Settings";
import AddPageModal from "./components/modals/AddPageModal";
import AddAppModal from "./components/modals/AddAppModal";
import CertGuideModal from "./components/modals/CertGuideModal";
import DeletePageModal from "./components/modals/DeletePageModal";
import DeleteAppModal from "./components/modals/DeleteAppModal";

type NavMode = "sessions" | "certs" | "settings";
type ModalKind = null | "addPage" | "addApp" | "certGuide";

type PageSessionMeta = {
  sessionId: string;
  proxyPort: number;
  pageUrl: string;
};

export default function App() {
  const [pages, setPages] = useState<Page[]>([]);
  const [apps, setApps] = useState<AppEntry[]>([]);
  const [flowsByPage, setFlowsByPage] = useState<Record<string, Flow[]>>({});
  const [sessionsByPage, setSessionsByPage] = useState<Record<string, string>>({});
  const [sessionMetaByPage, setSessionMetaByPage] = useState<Record<string, PageSessionMeta>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [navMode, setNavMode] = useState<NavMode>("sessions");
  const [activeId, setActiveId] = useState<string>("");
  const [variant, setVariant] = useState<"A" | "B">("A");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [recording, setRecording] = useState(true);
  const [modal, setModal] = useState<ModalKind>(null);
  const [clear, setClear] = useState<Record<string, boolean>>({});
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [launchMode, setLaunchMode] = useState("normal");
  const [toggles, setToggles] = useState<Toggles>({ mask: true, quic: true, login: false, autoclean: true });
  const [certState, setCertState] = useState("NotGenerated");
  const [captureBusy, setCaptureBusy] = useState(false);
  const captureInFlight = useRef<Set<string>>(new Set());
  const autoCaptureAttempted = useRef<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteAppTarget, setDeleteAppTarget] = useState<{ id: string; name: string } | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [interceptsByPage, setInterceptsByPage] = useState<Record<string, InterceptedFetch[]>>({});

  const refreshPages = useCallback(async () => {
    const apiPages = await listPages();
    setPages((prev) => {
      const flowMap = Object.fromEntries(prev.map((p) => [p.id, p.flows]));
      const statusMap = Object.fromEntries(prev.map((p) => [p.id, p.status]));
      return apiPages.map((p) => {
        const mapped = mapApiPage(p);
        mapped.flows = flowMap[p.id] || [];
        mapped.status = statusMap[p.id] || mapped.status;
        return mapped;
      });
    });
  }, []);

  const refreshApps = useCallback(async () => {
    const apiApps = await listApps();
    setApps(
      apiApps.map((app) =>
        mapApiApp(app, app.id || app.bundle_id)
      )
    );
  }, []);

  const refreshCert = useCallback(async () => {
    const status = await getCertificateStatus();
    setCertState(status.state);
  }, []);

  const refreshFlowsForPage = useCallback(async (pageId: string) => {
    const sessionId = sessionsByPage[pageId];
    if (!sessionId) return;
    const items = await listFlows(sessionId);
    const flows = items.map(mapFlowListItem);
    setFlowsByPage((prev) => ({ ...prev, [pageId]: flows }));
    setPages((prev) =>
      prev.map((p) => (p.id === pageId ? { ...p, flows, status: "capturing" } : p))
    );
  }, [sessionsByPage]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await Promise.all([refreshPages(), refreshApps(), refreshCert()]);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshApps, refreshCert, refreshPages]);

  useEffect(() => {
    if (!activeId && pages.length > 0) {
      setActiveId(pages[0].id);
    }
  }, [activeId, pages]);

  useEffect(() => {
    const capturingPages = pages.filter((p) => p.status === "capturing" && sessionsByPage[p.id]);
    if (!capturingPages.length || !recording) return;
    const timer = window.setInterval(() => {
      capturingPages.forEach((p) => {
        refreshFlowsForPage(p.id).catch((e) =>
          setError(e instanceof Error ? e.message : String(e))
        );
      });
    }, 1500);
    return () => window.clearInterval(timer);
  }, [pages, recording, refreshFlowsForPage, sessionsByPage]);

  const find = (id: string) => pages.find((p) => p.id === id) || apps.find((a) => a.id === id);
  const isAppId = (id: string) => !!apps.find((a) => a.id === id);

  const activeFlows = (id?: string) => {
    const a = id || activeId;
    if (isAppId(a)) return [];
    if (clear[a]) return [];
    return flowsByPage[a] || pages.find((p) => p.id === a)?.flows || [];
  };

  const firstId = (id: string): string | null => {
    const f = activeFlows(id);
    if (!f.length) return null;
    return f[0].id;
  };

  const selectSession = (id: string) => {
    const app = isAppId(id);
    setNavMode("sessions");
    setActiveId(id);
    if (!app) setSelectedFlowId(firstId(id));
  };

  const active = find(activeId);
  const isApp = isAppId(activeId);
  const sessionsMode = navMode === "sessions";
  const flows = activeFlows();

  const totalCount = String(
    pages.reduce((a, p) => a + (clear[p.id] ? 0 : (flowsByPage[p.id] || p.flows).length), 0)
  );
  const titleSuffix =
    navMode === "certs" ? "Certificates" : navMode === "settings" ? "Settings" : active ? active.name : "AppScope";

  const done = flows.filter((f) => f.status != null);
  const xfer = done.reduce((a, f) => a + (f.size || 0), 0);
  const statusLeft = error
    ? `Error · ${error}`
    : loading
    ? "Loading…"
    : isApp
    ? active
      ? `${active.name} · Normal launch`
      : ""
    : flows.length
    ? `${flows.length} requests · ${fmtSize(xfer)} transferred`
    : "Idle — no requests";

  const toggleInspector = useCallback(() => setInspectorOpen((v) => !v), []);

  const clearFlows = () => {
    setClear((c) => ({ ...c, [activeId]: true }));
    setSelectedFlowId(null);
  };
  const toggle = (k: keyof Toggles) => setToggles((t) => ({ ...t, [k]: !t[k] }));

  const handleSavePage = async (url: string, name?: string) => {
    const saved = await savePage(name, url);
    await refreshPages();
    setActiveId(saved.id);
    setModal(null);
  };

  const beginPageCapture = async (pageId: string, session: Awaited<ReturnType<typeof openPageWithCapture>>) => {
    setSessionsByPage((s) => ({ ...s, [pageId]: session.id }));
    setSessionMetaByPage((s) => ({
      ...s,
      [pageId]: {
        sessionId: session.id,
        proxyPort: session.proxy_port,
        pageUrl: session.page_url,
      },
    }));
    setPages((prev) =>
      prev.map((p) => (p.id === pageId ? { ...p, status: "capturing" as const } : p))
    );
    setActiveId(pageId);
    setClear((c) => ({ ...c, [pageId]: false }));
    setRecording(true);
    const items = await listFlows(session.id);
    const flows = items.map(mapFlowListItem);
    setFlowsByPage((prev) => ({ ...prev, [pageId]: flows }));
  };

  const seenInterceptIds = useRef(new Set<string>());

  const handleIntercepts = useCallback((pageId: string, items: InterceptedFetch[]) => {
    const fresh = items.filter((it) => !seenInterceptIds.current.has(it.id));
    if (fresh.length === 0) return;
    for (const it of fresh) seenInterceptIds.current.add(it.id);

    setInterceptsByPage((prev) => ({
      ...prev,
      [pageId]: [...(prev[pageId] || []), ...fresh],
    }));

    const sbConfig = loadSupabaseConfig();
    if (sbConfig.url && sbConfig.key) {
      const rows = fresh.map((item) => ({ ...item, page_id: pageId }));
      fetch(`${sbConfig.url}/rest/v1/intercepts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: sbConfig.key,
          Authorization: `Bearer ${sbConfig.key}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify(rows),
      })
        .then((resp) => {
          if (!resp.ok) resp.text().then((t) => console.error("[appscope][supabase] upload failed:", resp.status, t));
          else console.log(`[appscope][supabase] uploaded ${rows.length} rows`);
        })
        .catch((e) => console.error("[appscope][supabase] fetch error:", e));
    }
  }, []);

  useEffect(() => {
    const unlisten = tauriListen<{ page_id: string; items: InterceptedFetch[] }>(
      "page-content-intercept",
      (event) => {
        const { page_id, items } = event.payload;
        if (items && items.length > 0) {
          handleIntercepts(page_id, items);
        }
      },
    );
    return () => { unlisten.then((fn) => fn()); };
  }, [handleIntercepts]);

  const handleStartCaptureForPage = async (pageId: string) => {
    if (captureBusy || sessionMetaByPage[pageId] || captureInFlight.current.has(pageId)) return;
    captureInFlight.current.add(pageId);
    setCaptureBusy(true);
    setError(null);
    try {
      const session = await openPageWithCapture(pageId);
      await beginPageCapture(pageId, session);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      captureInFlight.current.delete(pageId);
      setCaptureBusy(false);
    }
  };

  const handleOpenCapture = async (url: string, name?: string) => {
    const saved = await savePage(name, url);
    await refreshPages();
    setCaptureBusy(true);
    setError(null);
    try {
      const session = await openPageWithCapture(saved.id);
      await beginPageCapture(saved.id, session);
      setModal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCaptureBusy(false);
    }
  };

  const handleSaveApp = async (app: ApiApp) => {
    await saveApp(app);
    await refreshApps();
    setModal(null);
  };

  const handleLaunchApp = async (appId: string) => {
    await launchApp(appId);
  };

  const handleSelectFlow = async (flowId: string) => {
    setSelectedFlowId(flowId);
    try {
      const detail = await getFlowDetail(flowId);
      setFlowsByPage((prev) => {
        const pageId = activeId;
        const current = prev[pageId] || [];
        return {
          ...prev,
          [pageId]: current.map((f) => (f.id === flowId ? detail : f)),
        };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDeletePage = (pageId: string) => {
    const page = pages.find((p) => p.id === pageId);
    // Native child webview renders above HTML — hide it so the confirm dialog is visible.
    void setPageWebviewVisible(pageId, false).catch(() => undefined);
    setDeleteTarget({ id: pageId, name: page?.name || "Page" });
  };

  const confirmDeletePage = async () => {
    if (!deleteTarget) return;
    const pageId = deleteTarget.id;

    setError(null);
    const sessionId = sessionsByPage[pageId];
    if (sessionId) {
      await stopSession(sessionId);
    }
    await closePageWebview(pageId).catch(() => undefined);
    await removePage(pageId);

    const remainingPages = pages.filter((p) => p.id !== pageId);

    captureInFlight.current.delete(pageId);
    autoCaptureAttempted.current.delete(pageId);
    setPages(remainingPages);
    setFlowsByPage((prev) => {
      const next = { ...prev };
      delete next[pageId];
      return next;
    });
    setSessionsByPage((prev) => {
      const next = { ...prev };
      delete next[pageId];
      return next;
    });
    setSessionMetaByPage((prev) => {
      const next = { ...prev };
      delete next[pageId];
      return next;
    });
    setClear((prev) => {
      const next = { ...prev };
      delete next[pageId];
      return next;
    });

    if (activeId === pageId) {
      setActiveId(remainingPages[0]?.id || apps[0]?.id || "");
      setSelectedFlowId(null);
    }

    setDeleteTarget(null);
    await refreshPages();
  };

  const handleDeleteApp = (appId: string) => {
    const app = apps.find((a) => a.id === appId);
    setDeleteAppTarget({ id: appId, name: app?.name || "App" });
  };

  const confirmDeleteApp = async () => {
    if (!deleteAppTarget) return;
    const appId = deleteAppTarget.id;

    setError(null);
    await removeApp(appId);

    const remainingApps = apps.filter((a) => a.id !== appId);
    setApps(remainingApps);

    if (activeId === appId) {
      setActiveId(remainingApps[0]?.id || pages[0]?.id || "");
      setSelectedFlowId(null);
    }

    setDeleteAppTarget(null);
    await refreshApps();
  };

  const handleStopRecording = async () => {
    const sessionId = sessionsByPage[activeId];
    if (sessionId) {
      await stopSession(sessionId);
      setPages((prev) => prev.map((p) => (p.id === activeId ? { ...p, status: "idle" } : p)));
      setSessionsByPage((s) => {
        const next = { ...s };
        delete next[activeId];
        return next;
      });
      setSessionMetaByPage((s) => {
        const next = { ...s };
        delete next[activeId];
        return next;
      });
    }
    setRecording((r) => !r);
  };

  const enrichedPages = useMemo(
    () =>
      pages.map((p) => ({
        ...p,
        flows: clear[p.id] ? [] : flowsByPage[p.id] || p.flows,
      })),
    [clear, flowsByPage, pages]
  );

  const activeSessionMeta = sessionMetaByPage[activeId];
  const noOverlay = modal == null && deleteTarget == null && deleteAppTarget == null;
  const deletingActivePage = deleteTarget?.id === activeId;
  const showApp = sessionsMode && isApp;
  const showPageCapture =
    sessionsMode && !isApp && !!activeSessionMeta && !deletingActivePage && deleteTarget == null;
  const showEmpty =
    sessionsMode && !isApp && !showPageCapture && flows.length === 0 && !loading && !deleteTarget;
  const showDeletePlaceholder = sessionsMode && !isApp && !!deleteTarget && !showPageCapture;
  const showFlows = sessionsMode && !isApp && flows.length > 0;

  useEffect(() => {
    if (
      !sessionsMode ||
      isApp ||
      !activeId ||
      activeSessionMeta ||
      loading ||
      captureBusy ||
      autoCaptureAttempted.current.has(activeId)
    ) {
      return;
    }

    autoCaptureAttempted.current.add(activeId);
    void handleStartCaptureForPage(activeId);
  }, [activeId, activeSessionMeta, captureBusy, isApp, loading, sessionsMode]);

  return (
    <div
      style={{
        height: "100vh",
        width: "100%",
        boxSizing: "border-box",
        display: "flex",
        background: "#ffffff",
        fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Text',system-ui,sans-serif",
      }}
    >
      <div
        style={{
          flex: 1,
          minWidth: 0,
          background: "#ffffff",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <TitleBar
          titleSuffix={titleSuffix}
          variant={variant}
          onVariant={setVariant}
          inspectorOpen={inspectorOpen}
          onToggleInspector={toggleInspector}
        />

        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          <Sidebar
            pages={enrichedPages}
            apps={apps}
            navMode={navMode}
            activeId={activeId}
            totalCount={totalCount}
            query={query}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
            onQuery={setQuery}
            onSelectAll={() => pages[0] && selectSession(pages[0].id)}
            onSelect={selectSession}
            onDeletePage={handleDeletePage}
            onDeleteApp={handleDeleteApp}
            onAddPage={() => setModal("addPage")}
            onAddApp={() => setModal("addApp")}
            onCerts={() => setNavMode("certs")}
            onSettings={() => setNavMode("settings")}
          />

          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0, background: "#ffffff" }}>
            {navMode === "certs" && (
              <CertManager
                state={certState}
                onInstall={async () => {
                  try {
                    await installCertificate();
                    await refreshCert();
                    setModal("certGuide");
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                  }
                }}
                onOpenGuide={async () => {
                  try {
                    await openCertificateGuide();
                    setModal("certGuide");
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                  }
                }}
                onGenerate={async () => {
                  try {
                    await generateCertificate();
                    await refreshCert();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                  }
                }}
                onRemove={async () => {
                  try {
                    await removeCertificate();
                    await refreshCert();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                  }
                }}
                onRefresh={refreshCert}
              />
            )}
            {navMode === "settings" && <Settings toggles={toggles} onToggle={toggle} />}
            {showApp && active && "bundle" in active && (
              <AppDetail
                app={active}
                launchMode={launchMode}
                onLaunchMode={setLaunchMode}
                onLaunch={() => handleLaunchApp(active.id)}
              />
            )}
            {showDeletePlaceholder && (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#9a9aa0",
                  fontSize: 13,
                }}
              >
                请在弹窗中确认删除…
              </div>
            )}
            {showEmpty && (
              <EmptyState
                busy={captureBusy}
                onOpenCapture={
                  activeId ? () => handleStartCaptureForPage(activeId) : undefined
                }
              />
            )}
            {sessionsMode && !isApp && pages.length === 0 && !loading && (
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
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 600, color: "#1d1d1f" }}>还没有页面</div>
                <div>点击左侧 Pages 旁的 + 添加一个 URL</div>
              </div>
            )}
            {Object.keys(sessionMetaByPage).length > 0 && (
              <div style={{
                display: "flex",
                minWidth: 0,
                position: "relative",
                ...(showPageCapture
                  ? { flex: 1, minHeight: 0 }
                  : { flex: "none" as const, height: 0, overflow: "hidden" as const }),
              }}>
                {Object.entries(sessionMetaByPage).map(([pgId, meta]) => (
                  <PageBrowser
                    key={pgId}
                    pageId={pgId}
                    url={meta.pageUrl}
                    proxyPort={meta.proxyPort}
                    active={activeId === pgId && sessionsMode && !isApp && noOverlay}
                    inspectorOpen={inspectorOpen}
                    onToggleInspector={toggleInspector}
                    requestCount={(flowsByPage[pgId] || []).length}
                  />
                ))}
                {inspectorOpen && showPageCapture && (
                <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
                  {showFlows ? (
                    <FlowTable
                      flows={flows}
                      variant={variant}
                      showWaterfall
                      query={query}
                      filter={filter}
                      selectedId={selectedFlowId}
                      recording={recording}
                      onSelect={handleSelectFlow}
                      onQuery={setQuery}
                      onFilter={setFilter}
                      onToggleRecord={handleStopRecording}
                      onClear={clearFlows}
                    />
                  ) : (
                    <EmptyState busy={captureBusy} />
                  )}
                  {(interceptsByPage[activeId]?.length ?? 0) > 0 && (
                    <div style={{ borderTop: "1px solid #ededf0", maxHeight: "40%", overflow: "auto" }}>
                      <div style={{ padding: "6px 10px", fontWeight: 600, fontSize: 11, color: "#5a5a5e", background: "#fbfbfc", borderBottom: "1px solid #ededf0" }}>
                        Intercepted Content ({interceptsByPage[activeId].length})
                      </div>
                      <InterceptPanel intercepts={interceptsByPage[activeId]} />
                    </div>
                  )}
                </div>
                )}
              </div>
            )}
            {!showPageCapture && showFlows && (
              <FlowTable
                flows={flows}
                variant={variant}
                showWaterfall
                query={query}
                filter={filter}
                selectedId={selectedFlowId}
                recording={recording}
                onSelect={handleSelectFlow}
                onQuery={setQuery}
                onFilter={setFilter}
                onToggleRecord={handleStopRecording}
                onClear={clearFlows}
              />
            )}
          </div>
        </div>

        <StatusBar
          statusLeft={statusLeft}
          live={recording && flows.length > 0}
          proxyPort={activeSessionMeta?.proxyPort}
          certState={certState}
          quicDisabled={toggles.quic}
        />
      </div>

      {(modal != null || deleteTarget != null || deleteAppTarget != null) && (
        <div
          onClick={() => {
            if (deleteTarget || deleteAppTarget) return;
            setModal(null);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(20,20,24,.34)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            backdropFilter: "blur(1.5px)",
          }}
        >
          {deleteTarget && (
            <DeletePageModal
              pageName={deleteTarget.name}
              onClose={() => setDeleteTarget(null)}
              onConfirm={confirmDeletePage}
            />
          )}
          {deleteAppTarget && (
            <DeleteAppModal
              appName={deleteAppTarget.name}
              onClose={() => setDeleteAppTarget(null)}
              onConfirm={confirmDeleteApp}
            />
          )}
          {modal === "addPage" && (
            <AddPageModal
              onClose={() => setModal(null)}
              onSave={handleSavePage}
              onOpenCapture={handleOpenCapture}
              onOpenCertGuide={() => setModal("certGuide")}
            />
          )}
          {modal === "addApp" && (
            <AddAppModal onClose={() => setModal(null)} onSave={handleSaveApp} />
          )}
          {modal === "certGuide" && (
            <CertGuideModal
              onClose={() => setModal(null)}
              onOpenKeychain={async () => {
                try {
                  await openCertificateGuide();
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                }
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

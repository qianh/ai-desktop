// AppScope shell — owns all UI state and routes between views.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen as tauriListen } from "@tauri-apps/api/event";
import {
  getCertificateStatus,
  getFlowDetail,
  listFlows,
  listPages,
  mapApiPage,
  mapFlowListItem,
  openCertificateGuide,
  uploadInterceptsToSupabase,
  closePageWebview,
  openMainDevtools,
  openPageWithCapture,
  openPageWebviewDevtools,
  removePage,
  savePage,
  setPageInterceptReporting,
  stopSession,
} from "./api";

import type { Flow, InterceptedFetch, Page } from "./types";
import TitleBar from "./components/TitleBar";
import Sidebar from "./components/Sidebar";
import SessionsWorkspace from "./components/SessionsWorkspace";

import Settings, { type Toggles, loadSupabaseConfig } from "./components/Settings";
import { bindLiquidPointer } from "./hooks/useLiquidPointer";
import {
  applyAppearance,
  loadGlassIntensity,
  loadStylePreset,
  loadThemeMode,
  saveGlassIntensity,
  saveStylePreset,
  saveThemeMode,
  type GlassIntensity,
  type StylePreset,
  type ThemeMode,
} from "./lib/appearance";
import {
  DEFAULT_PAGE_DISPLAY_NAME,
  ensureChatInterceptReporting,
  ensureDefaultPage,
  isDefaultChatPage,
  markDefaultPageRemoved,
  pickStartupPageId,
} from "./lib/ensureDefaultPage";
import AddPageModal from "./components/modals/AddPageModal";
import CertGuideModal from "./components/modals/CertGuideModal";
import DeletePageModal from "./components/modals/DeletePageModal";
import { useCertHandlers } from "./hooks/useCertHandlers";
import { APP_TITLE_BAR_H } from "./lib/chromeLayout";
import {
  BACKGROUND_CAPTURE_STOP_DELAY_MS,
  shouldStopGlobalRecordingAfterStops,
  stopPageCapture,
} from "./lib/captureLifecycle";

type NavMode = "sessions" | "records" | "settings";
type ModalKind = null | "addPage" | "certGuide";

type PageSessionMeta = {
  sessionId: string;
  proxyPort: number;
  pageUrl: string;
};

export default function App() {
  const [pages, setPages] = useState<Page[]>([]);
  const [flowsByPage, setFlowsByPage] = useState<Record<string, Flow[]>>({});
  const [sessionsByPage, setSessionsByPage] = useState<Record<string, string>>({});
  const [sessionMetaByPage, setSessionMetaByPage] = useState<Record<string, PageSessionMeta>>({});
  const [, setError] = useState<string | null>(null);
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
  const [toggles, setToggles] = useState<Toggles>({ mask: true, quic: true, login: false, autoclean: true });
  const [theme, setTheme] = useState<ThemeMode>(() => loadThemeMode());
  const [stylePreset, setStylePreset] = useState<StylePreset>(() => loadStylePreset());
  const [glassIntensity, setGlassIntensity] = useState<GlassIntensity>(() => loadGlassIntensity());
  const [certState, setCertState] = useState("NotGenerated");
  const [captureBusy, setCaptureBusy] = useState(false);
  const captureInFlight = useRef<Set<string>>(new Set());
  const autoCaptureAttempted = useRef<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [interceptsByPage, setInterceptsByPage] = useState<Record<string, InterceptedFetch[]>>({});

  const changeTheme = (t: ThemeMode) => {
    setTheme(t);
    saveThemeMode(t);
  };

  const changeStylePreset = (style: StylePreset) => {
    setStylePreset(style);
    saveStylePreset(style);
  };

  const changeGlassIntensity = (intensity: GlassIntensity) => {
    setGlassIntensity(intensity);
    saveGlassIntensity(intensity);
  };

  useEffect(() => {
    applyAppearance(stylePreset, theme, glassIntensity);
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyAppearance(stylePreset, "system", glassIntensity);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [stylePreset, theme, glassIntensity]);

  useEffect(() => {
    if (stylePreset !== "glass") return;
    return bindLiquidPointer();
  }, [stylePreset]);

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

  const refreshCert = useCallback(async () => {
    const status = await getCertificateStatus();
    setCertState(status.state);
  }, []);

  const certHandlers = useCertHandlers(refreshCert, setError, () => setModal("certGuide"));

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
        await ensureDefaultPage();
        await ensureChatInterceptReporting();
        await Promise.all([refreshPages(), refreshCert()]);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshCert, refreshPages]);

  useEffect(() => {
    if (!activeId && pages.length > 0) {
      const startupId = pickStartupPageId(pages);
      if (startupId) setActiveId(startupId);
    }
  }, [activeId, pages]);

  useEffect(() => {
    const pollPages = pages.filter((p) => {
      if (!sessionsByPage[p.id]) return false;
      return recording || p.interceptReportingEnabled || isDefaultChatPage(p.host);
    });
    if (!pollPages.length) return;
    const timer = window.setInterval(() => {
      pollPages.forEach((p) => {
        refreshFlowsForPage(p.id).catch((e) =>
          setError(e instanceof Error ? e.message : String(e))
        );
      });
    }, 1500);
    return () => window.clearInterval(timer);
  }, [pages, recording, refreshFlowsForPage, sessionsByPage]);

  const find = (id: string) => pages.find((p) => p.id === id);

  const activeFlows = (id?: string) => {
    const a = id || activeId;
    if (clear[a]) return [];
    return flowsByPage[a] || pages.find((p) => p.id === a)?.flows || [];
  };

  const firstId = (id: string): string | null => {
    const f = activeFlows(id);
    if (!f.length) return null;
    return f[0].id;
  };

  const selectSession = (id: string) => {
    setNavMode("sessions");
    setActiveId(id);
    setSelectedFlowId(firstId(id));
    autoCaptureAttempted.current.delete(id);
  };

  const handleOpenSessionRecords = () => {
    setNavMode((mode) => (mode === "records" ? "sessions" : "records"));
  };

  const active = find(activeId);
  const sessionsMode = navMode === "sessions";
  const recordsMode = navMode === "records";
  const flows = activeFlows();

  const titleSuffix =
    navMode === "settings"
      ? "Settings"
      : recordsMode
      ? "会话记录"
      : active
      ? !isDefaultChatPage(active.host)
        ? active.name
        : DEFAULT_PAGE_DISPLAY_NAME
      : "枢境";

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
  const pendingUploadIds = useRef(new Set<string>());
  const pendingIntercepts = useRef<Array<{ pageId: string; items: InterceptedFetch[] }>>([]);
  const pagesById = useMemo(() => Object.fromEntries(pages.map((p) => [p.id, p])), [pages]);
  const pagesByIdRef = useRef(pagesById);
  pagesByIdRef.current = pagesById;

  const handleIntercepts = useCallback((pageId: string, items: InterceptedFetch[]) => {
    if (!pageId) {
      console.warn("[appscope][supabase] skip upload: missing page_id in intercept event");
      return;
    }
    const page = pagesByIdRef.current[pageId];
    if (!page) {
      pendingIntercepts.current.push({ pageId, items });
      return;
    }
    if (!page.interceptReportingEnabled && !isDefaultChatPage(page.host)) {
      console.warn(
        `[appscope][supabase] skip upload: reporting disabled for page ${pageId}`,
      );
      return;
    }

    const fresh = items.filter(
      (it) => !seenInterceptIds.current.has(it.id) && !pendingUploadIds.current.has(it.id),
    );
    if (fresh.length === 0) return;
    for (const it of fresh) pendingUploadIds.current.add(it.id);

    setInterceptsByPage((prev) => ({
      ...prev,
      [pageId]: [...(prev[pageId] || []), ...fresh],
    }));

    console.log(
      `[appscope] received ${fresh.length} intercept(s) for page ${pageId}`,
      fresh.map((it) => `${it.method} ${it.url.slice(0, 96)}`),
    );

    const sbConfig = loadSupabaseConfig();
    if (!sbConfig.url || !sbConfig.key) {
      for (const it of fresh) pendingUploadIds.current.delete(it.id);
      console.warn("[appscope][supabase] skip upload: Supabase not configured in Settings");
      return;
    }

    void uploadInterceptsToSupabase(pageId, fresh, sbConfig)
      .then(() => {
        for (const it of fresh) {
          seenInterceptIds.current.add(it.id);
          pendingUploadIds.current.delete(it.id);
        }
        console.log(`[appscope][supabase] uploaded ${fresh.length} rows for page ${pageId}`);
      })
      .catch((e) => {
        for (const it of fresh) pendingUploadIds.current.delete(it.id);
        console.error("[appscope][supabase] upload failed:", e);
      });
  }, []);

  const handleToggleInterceptReporting = useCallback(
    async (pageId: string, enabled: boolean) => {
      const page = pages.find((p) => p.id === pageId);
      if (page && isDefaultChatPage(page.host)) {
        if (!enabled) return;
        if (!page.interceptReportingEnabled) {
          await setPageInterceptReporting(pageId, true);
          setPages((prev) =>
            prev.map((p) =>
              p.id === pageId ? { ...p, interceptReportingEnabled: true } : p,
            ),
          );
        }
        return;
      }
      setPages((prev) =>
        prev.map((p) => (p.id === pageId ? { ...p, interceptReportingEnabled: enabled } : p)),
      );
      try {
        await setPageInterceptReporting(pageId, enabled);
        if (enabled) {
          seenInterceptIds.current.clear();
        } else {
          setInterceptsByPage((prev) => ({ ...prev, [pageId]: [] }));
        }
      } catch (e) {
        // Roll back the optimistic toggle (it is always a flip, so previous = !enabled).
        setPages((prev) =>
          prev.map((p) =>
            p.id === pageId ? { ...p, interceptReportingEnabled: !enabled } : p,
          ),
        );
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [pages],
  );

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

  useEffect(() => {
    if (!pages.length || pendingIntercepts.current.length === 0) return;
    const queued = pendingIntercepts.current.splice(0);
    for (const { pageId, items } of queued) {
      handleIntercepts(pageId, items);
    }
  }, [pages, handleIntercepts]);

  const handleStartCaptureForPage = async (pageId: string) => {
    if (captureBusy || captureInFlight.current.has(pageId)) return;
    if (sessionMetaByPage[pageId]) return;

    captureInFlight.current.add(pageId);
    setCaptureBusy(true);
    setError(null);
    let started = false;
    try {
      const session = await openPageWithCapture(pageId);
      await beginPageCapture(pageId, session);
      started = true;
    } catch (e) {
      autoCaptureAttempted.current.delete(pageId);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (!started) {
        autoCaptureAttempted.current.delete(pageId);
      }
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
    const name =
      page && isDefaultChatPage(page.host) ? DEFAULT_PAGE_DISPLAY_NAME : page?.name || "Page";
    setDeleteTarget({ id: pageId, name });
  };

  const confirmDeletePage = async () => {
    if (!deleteTarget) return;
    const pageId = deleteTarget.id;
    const deletedPage = pages.find((p) => p.id === pageId);

    setError(null);
    const sessionId = sessionsByPage[pageId];
    if (sessionId) {
      await stopSession(sessionId);
    }
    await closePageWebview(pageId).catch(() => undefined);
    await removePage(pageId);

    if (deletedPage && isDefaultChatPage(deletedPage.host)) {
      markDefaultPageRemoved();
    }

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
      setActiveId(remainingPages[0]?.id || "");
      setSelectedFlowId(null);
    }

    setDeleteTarget(null);
    await refreshPages();
  };

  const clearCaptureStateForPages = useCallback((pageIds: string[]) => {
    const stopped = new Set(pageIds);
    setPages((prev) =>
      prev.map((p) => (stopped.has(p.id) ? { ...p, status: "idle" } : p)),
    );
    setSessionsByPage((prev) => {
      const next = { ...prev };
      for (const pageId of pageIds) delete next[pageId];
      return next;
    });
    setSessionMetaByPage((prev) => {
      const next = { ...prev };
      for (const pageId of pageIds) delete next[pageId];
      return next;
    });
  }, []);

  const stopCaptureEntries = useCallback(
    async (entries: Array<[string, string]>) => {
      const stoppedPageIds: string[] = [];
      for (const [pageId, sessionId] of entries) {
        try {
          await stopPageCapture(pageId, sessionId, {
            stopSession,
            closePageWebview,
          });
          stoppedPageIds.push(pageId);
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
      if (stoppedPageIds.length > 0) {
        const stopGlobalRecording = shouldStopGlobalRecordingAfterStops(
          sessionsByPage,
          stoppedPageIds,
        );
        clearCaptureStateForPages(stoppedPageIds);
        if (stopGlobalRecording) setRecording(false);
      }
    },
    [clearCaptureStateForPages, sessionsByPage],
  );

  const handleStopRecording = async () => {
    const sessionId = sessionsByPage[activeId];
    if (sessionId) {
      await stopCaptureEntries([[activeId, sessionId]]);
      return;
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
  const activeCaptureEntries = useMemo(
    () => Object.entries(sessionsByPage),
    [sessionsByPage],
  );
  const overlayOpen = modal != null;
  const canInspectActivePage = (sessionsMode || recordsMode) && Boolean(activeId && activeSessionMeta);

  const handleOpenDevtools = useCallback(async () => {
    try {
      setError(null);
      if (canInspectActivePage) {
        await openPageWebviewDevtools(activeId);
        return;
      }
      await openMainDevtools();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("[appscope] open devtools failed:", e);
      setError(message);
    }
  }, [activeId, canInspectActivePage]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey || !event.altKey || event.key.toLowerCase() !== "i") return;
      event.preventDefault();
      void handleOpenDevtools();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleOpenDevtools]);

  useEffect(() => {
    if (activeCaptureEntries.length === 0) return;

    let timer: number | null = null;
    const clearTimer = () => {
      if (timer != null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };
    const stopAllCaptures = () => {
      clearTimer();
      void stopCaptureEntries(activeCaptureEntries);
    };
    const scheduleBackgroundStop = () => {
      clearTimer();
      if (document.visibilityState === "hidden") {
        timer = window.setTimeout(stopAllCaptures, BACKGROUND_CAPTURE_STOP_DELAY_MS);
      }
    };

    document.addEventListener("visibilitychange", scheduleBackgroundStop);
    window.addEventListener("pagehide", stopAllCaptures);
    window.addEventListener("beforeunload", stopAllCaptures);
    scheduleBackgroundStop();

    return () => {
      clearTimer();
      document.removeEventListener("visibilitychange", scheduleBackgroundStop);
      window.removeEventListener("pagehide", stopAllCaptures);
      window.removeEventListener("beforeunload", stopAllCaptures);
    };
  }, [activeCaptureEntries, stopCaptureEntries]);

  useEffect(() => {
    if (
      !sessionsMode ||
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
  }, [activeId, activeSessionMeta, captureBusy, loading, sessionsMode]);

  return (
    <div
      className="asc-app-root"
      style={{
        height: "100%",
        width: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "var(--c-bg)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <div
        className="asc-app-shell"
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          height: "100%",
          background: "var(--c-bg)",
          overflow: "hidden",
          display: "grid",
          gridTemplateRows: `${APP_TITLE_BAR_H}px 1fr`,
          gridTemplateColumns: "1fr",
        }}
      >
        <TitleBar
          titleSuffix={titleSuffix}
          variant={variant}
          onVariant={setVariant}
          inspectorOpen={inspectorOpen}
          onToggleInspector={toggleInspector}
          onOpenSessionRecords={handleOpenSessionRecords}
          sessionRecordsActive={recordsMode}
          onOpenDevtools={handleOpenDevtools}
          canInspectPage={canInspectActivePage}
        />

        <div className="asc-workspace" style={{ minHeight: 0, overflow: "hidden", display: "flex", background: "var(--c-bg)" }}>
          <Sidebar
            ref={sidebarRef}
            pages={enrichedPages}
            navMode={navMode}
            activeId={activeId}
            query={query}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
            onQuery={setQuery}
            onSelect={selectSession}
            onDeletePage={handleDeletePage}
            onToggleInterceptReporting={handleToggleInterceptReporting}
            onAddPage={() => setModal("addPage")}
            onSettings={() => setNavMode("settings")}
          />

          <div
            className="asc-content-panel"
            style={{ flex: 1, minWidth: 0, position: "relative", display: "flex", flexDirection: "column", minHeight: 0, height: "100%", overflow: "hidden", background: "var(--c-bg)" }}
          >
            {navMode === "settings" && (
              <Settings
                toggles={toggles}
                onToggle={toggle}
                theme={theme}
                onTheme={changeTheme}
                stylePreset={stylePreset}
                onStylePreset={changeStylePreset}
                glassIntensity={glassIntensity}
                onGlassIntensity={changeGlassIntensity}
                cert={{ state: certState, ...certHandlers }}
              />
            )}
            {(sessionsMode || recordsMode) && (
              <SessionsWorkspace
                navMode={navMode}
                activeId={activeId}
                pages={pages}
                sessionMetaByPage={sessionMetaByPage}
                flowsByPage={flowsByPage}
                flows={flows}
                interceptsByPage={interceptsByPage}
                loading={loading}
                deleteTargetId={deleteTarget?.id ?? null}
                overlayOpen={overlayOpen}
                variant={variant}
                inspectorOpen={inspectorOpen}
                query={query}
                filter={filter}
                selectedFlowId={selectedFlowId}
                recording={recording}
                captureBusy={captureBusy}
                onToggleInspector={toggleInspector}
                onSelectFlow={handleSelectFlow}
                onQuery={setQuery}
                onFilter={setFilter}
                onToggleRecord={handleStopRecording}
                onClearFlows={clearFlows}
                onStartCapture={handleStartCaptureForPage}
                sidebarRef={sidebarRef}
              />
            )}
          </div>
        </div>
      </div>

      {(modal != null || deleteTarget != null) && (
        <div
          onClick={() => {
            if (deleteTarget) return;
            setModal(null);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--c-overlay)",
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
          {modal === "addPage" && (
            <AddPageModal
              onClose={() => setModal(null)}
              onSave={handleSavePage}
              onOpenCapture={handleOpenCapture}
              onOpenCertGuide={() => setModal("certGuide")}
            />
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

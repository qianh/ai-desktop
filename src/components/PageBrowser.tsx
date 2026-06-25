// Embedded page webview — loads the capture target inside AppScope via a Rust-mounted child webview.
// Webview is created on mount and closed on unmount. Visibility is toggled via show/hide
// so switching pages does not reload.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  closePageWebview,
  formatInvokeError,
  getPageWebviewUrl,
  mountPageWebview,
  setPageWebviewVisible,
  syncPageWebviewBounds,
} from "../api";
import { isTauriRuntime } from "../api";
import type { PagePanelState } from "../lib/pagePanelState";
import { measurePageWebviewHorizontal } from "../lib/pageWebviewBounds";

type Props = {
  pageId: string;
  url: string;
  proxyPort: number;
  interceptReportingEnabled: boolean;
  panelState: PagePanelState;
  inspectorOpen: boolean;
  sidebarRef?: RefObject<HTMLElement | null>;
};

type PageWebviewLoadEvent = {
  page_id: string;
  label: string;
  event: "started" | "finished";
  url: string;
};

const LOAD_TIMEOUT_MS = 30_000;
const URL_POLL_INTERVAL_MS = 1_500;
const MOUNT_MEASURE_ATTEMPTS = 24;
const BOUNDS_SYNC_DEBOUNCE_MS = 80;

function logBoundsSyncError(context: string, err: unknown): void {
  console.warn(`[PageBrowser] ${context}`, err);
}

function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let timer: number | null = null;
  return ((...args: never[]) => {
    if (timer != null) window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), ms);
  }) as T;
}

async function waitForHostSize(host: HTMLElement, attempts = 40): Promise<DOMRect | null> {
  for (let i = 0; i < attempts; i += 1) {
    const rect = host.getBoundingClientRect();
    if (rect.width >= 80 && rect.height >= 120) return rect;
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
  }
  return null;
}

function targetHost(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function looksLoaded(currentUrl: string | null | undefined, expectedUrl: string): boolean {
  if (!currentUrl) return false;
  const normalized = currentUrl.trim().toLowerCase();
  if (!normalized || normalized === "about:blank") return false;
  const host = targetHost(expectedUrl);
  if (!host) return normalized.startsWith(expectedUrl.toLowerCase());
  return normalized.includes(host.toLowerCase());
}

export default function PageBrowser({
  pageId,
  url,
  proxyPort,
  interceptReportingEnabled,
  panelState,
  inspectorOpen,
  sidebarRef,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const lastNavUrlRef = useRef(url);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const panelStateRef = useRef(panelState);
  panelStateRef.current = panelState;

  useEffect(() => {
    lastNavUrlRef.current = url;
  }, [pageId, url]);

  const layoutActive = panelState !== "hidden";
  const active = panelState === "visible";

  const measureHorizontal = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return null;
    return measurePageWebviewHorizontal(panel, sidebarRef?.current);
  }, [sidebarRef]);

  const pushBounds = useCallback(() => {
    const edges = measureHorizontal();
    if (!edges) return;
    void syncPageWebviewBounds(pageId, edges.sidebarRight, edges.panelRight).catch((err) =>
      logBoundsSyncError("sync bounds", err),
    );
  }, [measureHorizontal, pageId]);

  const debouncedPushBounds = useCallback(debounce(pushBounds, BOUNDS_SYNC_DEBOUNCE_MS), [pushBounds]);

  // Mount effect — create webview once, close only on component unmount
  useLayoutEffect(() => {
    if (!isTauriRuntime() || !hostRef.current) {
      setStatus("loading");
      setError(null);
      return;
    }

    const host = hostRef.current;
    let resizeObserver: ResizeObserver | null = null;
    let sidebarObserver: ResizeObserver | null = null;
    let unlistenLoad: (() => void) | null = null;
    let loadTimeout: number | null = null;
    let pollTimer: number | null = null;
    let cancelled = false;
    let loaded = false;
    let webviewMounted = false;
    setMounted(false);

    const clearLoadTimeout = () => {
      if (loadTimeout != null) {
        window.clearTimeout(loadTimeout);
        loadTimeout = null;
      }
    };

    const clearPollTimer = () => {
      if (pollTimer != null) {
        window.clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const markReady = () => {
      if (cancelled || loaded) return;
      loaded = true;
      clearLoadTimeout();
      clearPollTimer();
      setStatus("ready");
      setError(null);
    };

    const failLoad = (message: string) => {
      if (cancelled || loaded) return;
      clearLoadTimeout();
      clearPollTimer();
      void closePageWebview(pageId);
      webviewMounted = false;
      setMounted(false);
      setStatus("error");
      setError(message);
    };

    const scheduleLoadTimeout = () => {
      clearLoadTimeout();
      loadTimeout = window.setTimeout(() => {
        failLoad(
          "页面 WebView 已创建，但 30 秒内没有完成加载。若目标为 HTTPS，请先在 Settings → Certificates 中安装并信任本地 CA；也可能是目标站点阻止了 WKWebView。",
        );
      }, LOAD_TIMEOUT_MS);
    };

    const measureHost = () => {
      const panel = panelRef.current;
      if (!panel) return null;
      return measurePageWebviewHorizontal(panel, sidebarRef?.current);
    };

    const syncBounds = async () => {
      const edges = measureHost();
      if (!edges) return;
      await syncPageWebviewBounds(pageId, edges.sidebarRight, edges.panelRight);
    };

    const rememberNavUrl = (currentUrl: string | null | undefined) => {
      if (!currentUrl) return;
      const trimmed = currentUrl.trim();
      if (!trimmed || trimmed.toLowerCase() === "about:blank") return;
      lastNavUrlRef.current = trimmed;
    };

    const pollWebviewUrl = async () => {
      if (cancelled || loaded) return;
      try {
        const currentUrl = await getPageWebviewUrl(pageId);
        rememberNavUrl(currentUrl);
        const expected = lastNavUrlRef.current || url;
        if (looksLoaded(currentUrl, expected)) {
          markReady();
        }
      } catch {
        // webview may still be mounting
      }
    };

    const ensureListener = async () => {
      if (unlistenLoad) return;
      unlistenLoad = await listen<PageWebviewLoadEvent>("page-webview-load", (event) => {
        const payload = event.payload;
        if (cancelled || payload.page_id !== pageId) return;

        if (payload.event === "started") {
          rememberNavUrl(payload.url);
          setStatus("loading");
          setError(null);
          scheduleLoadTimeout();
          return;
        }

        rememberNavUrl(payload.url);
        markReady();
      });
    };

    const createWebview = async (): Promise<boolean> => {
      if (webviewMounted || cancelled) return true;

      const edges = measureHost();
      const panel = panelRef.current;
      const panelRect = panel?.getBoundingClientRect();
      if (!edges || !panelRect || panelRect.width < 80 || panelRect.height < 120) {
        return false;
      }

      await ensureListener();
      if (cancelled) return false;

      setStatus("loading");
      setError(null);
      loaded = false;

      const mountUrl = lastNavUrlRef.current || url;
      await mountPageWebview(
        pageId,
        mountUrl,
        proxyPort,
        interceptReportingEnabled,
        edges.sidebarRight,
        edges.panelRight,
      );
      if (cancelled) {
        await closePageWebview(pageId);
        return false;
      }

      webviewMounted = true;
      setMounted(true);

      if (panelStateRef.current === "visible") {
        await syncBounds();
        await setPageWebviewVisible(pageId, true);
      } else {
        await setPageWebviewVisible(pageId, false);
      }

      scheduleLoadTimeout();
      if (!pollTimer) {
        pollTimer = window.setInterval(() => {
          void pollWebviewUrl();
        }, URL_POLL_INTERVAL_MS);
      }
      void pollWebviewUrl();
      return true;
    };

    const failMeasure = () => {
      if (!sidebarRef?.current) {
        failLoad("无法测量侧栏边界。请确认侧栏已展开后重试。");
        return;
      }
      failLoad("无法测量页面面板边界。请调整窗口大小后重试。");
    };

    const boot = async () => {
      await ensureListener();
      if (cancelled) return;

      const measureEl = hostRef.current ?? panelRef.current ?? host;
      const rect = await waitForHostSize(measureEl);
      if (!rect || cancelled) {
        setStatus("error");
        setError("页面容器尺寸为 0，无法挂载 WebView。请展开窗口或点击左侧「上报会话」查看历史上报。");
        return;
      }

      for (let attempt = 0; attempt < MOUNT_MEASURE_ATTEMPTS; attempt += 1) {
        if (cancelled) return;
        if (await createWebview()) return;
        await new Promise((r) => requestAnimationFrame(() => r(undefined)));
      }

      if (!cancelled && !webviewMounted) {
        failMeasure();
      }
    };

    const onLayoutChange = () => {
      if (panelStateRef.current !== "hidden") {
        void syncBounds().catch((err) => logBoundsSyncError("layout sync", err));
      }
      if (!webviewMounted) {
        void createWebview().catch((e) => {
          console.error(e);
          setStatus("error");
          setError(formatInvokeError(e));
        });
      }
    };

    resizeObserver = new ResizeObserver(onLayoutChange);
    resizeObserver.observe(panelRef.current ?? host);

    const sidebarEl = sidebarRef?.current;
    if (sidebarEl) {
      sidebarObserver = new ResizeObserver(onLayoutChange);
      sidebarObserver.observe(sidebarEl);
    }

    const onWindowResize = () => {
      if (panelStateRef.current !== "hidden") {
        void syncBounds().catch((err) => logBoundsSyncError("window resize sync", err));
      }
    };
    window.addEventListener("resize", onWindowResize);

    void boot().catch((e) => {
      console.error(e);
      setStatus("error");
      setError(formatInvokeError(e));
    });

    return () => {
      cancelled = true;
      webviewMounted = false;
      setMounted(false);
      clearLoadTimeout();
      clearPollTimer();
      unlistenLoad?.();
      resizeObserver?.disconnect();
      sidebarObserver?.disconnect();
      window.removeEventListener("resize", onWindowResize);
      void closePageWebview(pageId);
    };
  }, [pageId, url, proxyPort, interceptReportingEnabled, sidebarRef]);

  // Visibility effect — show/hide native webview when panel state changes
  useEffect(() => {
    if (!isTauriRuntime() || !mounted) return;
    if (panelState === "visible") {
      const show = async () => {
        const panel = panelRef.current;
        const host = hostRef.current;
        if (!panel && !host) return;
        const measureEl = host ?? panel!;
        const sized = await waitForHostSize(measureEl);
        if (sized && panel) {
          const edges = measurePageWebviewHorizontal(panel, sidebarRef?.current);
          if (edges) {
            await syncPageWebviewBounds(pageId, edges.sidebarRight, edges.panelRight);
          }
        }
        await setPageWebviewVisible(pageId, true);
      };
      void show().catch((err) => logBoundsSyncError("show webview", err));
    } else {
      void setPageWebviewVisible(pageId, false).catch((err) => logBoundsSyncError("hide webview", err));
    }
  }, [pageId, panelState, mounted, sidebarRef]);

  // Keep bounds in sync when host stays sized but webview is hidden (e.g. 会话记录 overlay)
  useEffect(() => {
    if (!isTauriRuntime() || !mounted || panelState !== "layout-only") return;
    const measureEl = hostRef.current ?? panelRef.current;
    if (!measureEl) return;
    void waitForHostSize(measureEl)
      .then((sized) => {
        const panel = panelRef.current;
        if (!sized || !panel) return;
        const edges = measurePageWebviewHorizontal(panel, sidebarRef?.current);
        if (!edges) return;
        return syncPageWebviewBounds(pageId, edges.sidebarRight, edges.panelRight);
      })
      .catch((err) => logBoundsSyncError("layout-only sync", err));
  }, [pageId, panelState, mounted, sidebarRef]);

  // Re-sync bounds when inspector panel toggles (layout width changes)
  useEffect(() => {
    if (!isTauriRuntime() || !mounted || panelState !== "visible") return;
    const timer = window.setTimeout(pushBounds, BOUNDS_SYNC_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [panelState, mounted, inspectorOpen, pushBounds]);

  // Window focus can drift native webview over the sidebar — debounced re-sync.
  useEffect(() => {
    if (!isTauriRuntime() || !mounted || panelState !== "visible") return;
    const onFocus = () => debouncedPushBounds();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [mounted, panelState, debouncedPushBounds]);

  const panelStyle: CSSProperties = layoutActive
    ? {
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
        ...(inspectorOpen && active ? { width: "58%" } : { right: 0 }),
        minWidth: 0,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        borderRight: inspectorOpen && active ? "1px solid #ededf0" : "none",
        background: "var(--c-bg)",
        visibility: active ? "visible" : "hidden",
        pointerEvents: active ? "auto" : "none",
        overflow: "hidden",
      }
    : {
        position: "absolute",
        width: 0,
        height: 0,
        overflow: "hidden",
        opacity: 0,
        pointerEvents: "none",
      };

  return (
    <div ref={panelRef} style={panelStyle}>
      <div ref={hostRef} style={{ flex: 1, minHeight: 0, position: "relative", background: "var(--c-bg)" }}>
        {layoutActive && status === "loading" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              color: "var(--c-text-4)",
              pointerEvents: "none",
            }}
          >
            正在加载页面…
          </div>
        )}
        {layoutActive && status === "error" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: 24,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: "#d23b30" }}>页面加载失败</div>
            <div style={{ fontSize: 12, color: "var(--c-text-3)", lineHeight: 1.5, maxWidth: 360 }}>{error}</div>
            <div style={{ fontSize: 11.5, color: "var(--c-text-4)" }}>
              请确认 Certificates 已 Trusted，然后重新点击 Open &amp; Capture
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
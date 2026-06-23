// Embedded page webview — loads the capture target inside AppScope via a Rust-mounted child webview.
// Webview is created on mount and closed on unmount. Visibility is toggled via show/hide
// so switching pages does not reload.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

type Props = {
  pageId: string;
  url: string;
  proxyPort: number;
  active: boolean;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  requestCount: number;
};

type PageWebviewLoadEvent = {
  page_id: string;
  label: string;
  event: "started" | "finished";
  url: string;
};

const LOAD_TIMEOUT_MS = 30_000;
const URL_POLL_INTERVAL_MS = 1_500;

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
  active,
  inspectorOpen,
  onToggleInspector,
  requestCount,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const activeRef = useRef(active);
  activeRef.current = active;

  // Mount effect — create webview once, close only on component unmount
  useLayoutEffect(() => {
    if (!isTauriRuntime() || !hostRef.current) {
      setStatus("loading");
      setError(null);
      return;
    }

    const host = hostRef.current;
    let resizeObserver: ResizeObserver | null = null;
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
          "页面 WebView 已创建，但 30 秒内没有完成加载。若目标为 HTTPS，请先在 Certificates 中安装并信任本地 CA；也可能是目标站点阻止了 WKWebView。"
        );
      }, LOAD_TIMEOUT_MS);
    };

    const syncBounds = async () => {
      const rect = host.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      await syncPageWebviewBounds(pageId, rect.x, rect.y, rect.width, rect.height);
    };

    const pollWebviewUrl = async () => {
      if (cancelled || loaded) return;
      try {
        const currentUrl = await getPageWebviewUrl(pageId);
        if (looksLoaded(currentUrl, url)) {
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
          setStatus("loading");
          setError(null);
          scheduleLoadTimeout();
          return;
        }

        markReady();
      });
    };

    const createWebview = async () => {
      if (webviewMounted || cancelled) return;

      const rect = host.getBoundingClientRect();
      if (rect.width < 80 || rect.height < 120) return;

      await ensureListener();
      if (cancelled) return;

      setStatus("loading");
      setError(null);
      loaded = false;

      await mountPageWebview(pageId, url, proxyPort, rect.x, rect.y, rect.width, rect.height);
      if (cancelled) {
        await closePageWebview(pageId);
        return;
      }

      webviewMounted = true;
      setMounted(true);

      if (activeRef.current) {
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
    };

    const boot = async () => {
      await ensureListener();
      if (cancelled) return;

      const rect = await waitForHostSize(host);
      if (!rect || cancelled) {
        setStatus("error");
        setError("页面容器尺寸为 0，无法挂载 WebView。请展开窗口或点击左侧「上报会话」查看历史上报。");
        return;
      }

      await createWebview();
    };

    resizeObserver = new ResizeObserver(() => {
      if (activeRef.current) {
        void syncBounds().catch(() => undefined);
      }
      if (!webviewMounted) {
        void createWebview().catch((e) => {
          console.error(e);
          setStatus("error");
          setError(formatInvokeError(e));
        });
      }
    });
    resizeObserver.observe(host);

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
      void closePageWebview(pageId);
    };
  }, [pageId, url, proxyPort]);

  // Visibility effect — show/hide native webview when active changes
  useEffect(() => {
    if (!isTauriRuntime() || !mounted) return;
    if (active) {
      const show = async () => {
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
        const rect = hostRef.current?.getBoundingClientRect();
        if (rect && rect.width >= 1 && rect.height >= 1) {
          await syncPageWebviewBounds(pageId, rect.x, rect.y, rect.width, rect.height);
        }
        await setPageWebviewVisible(pageId, true);
      };
      void show().catch(() => undefined);
    } else {
      void setPageWebviewVisible(pageId, false).catch(() => undefined);
    }
  }, [pageId, active, mounted]);

  // Re-sync bounds when inspector panel toggles (layout width changes)
  useEffect(() => {
    if (!isTauriRuntime() || !mounted || !active) return;
    const timer = window.setTimeout(() => {
      const rect = hostRef.current?.getBoundingClientRect();
      if (rect && rect.width >= 1 && rect.height >= 1) {
        void syncPageWebviewBounds(pageId, rect.x, rect.y, rect.width, rect.height).catch(
          () => undefined,
        );
      }
    }, 80);
    return () => window.clearTimeout(timer);
  }, [pageId, active, mounted, inspectorOpen]);

  return (
    <div
      style={
        active
          ? {
              flex: inspectorOpen ? "0 0 58%" : 1,
              minWidth: 0,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              borderRight: inspectorOpen ? "1px solid #ededf0" : "none",
              background: "#f6f6f8",
            }
          : {
              position: "absolute",
              width: 0,
              height: 0,
              overflow: "hidden",
              opacity: 0,
              pointerEvents: "none",
            }
      }
    >
      {active && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px 6px 12px",
            borderBottom: "1px solid #ededf0",
            flex: "none",
            background: "#fbfbfc",
          }}
        >
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 11.5,
              color: "#8a8a8e",
              fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {url}
          </span>
          <button
            onClick={onToggleInspector}
            title={inspectorOpen ? "收起请求面板" : "展开请求面板"}
            style={{
              flex: "none",
              fontSize: 11,
              color: "#5a5a5e",
              background: "#ededf0",
              border: "0.5px solid #d9d9de",
              borderRadius: 6,
              padding: "3px 9px",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {inspectorOpen ? "隐藏请求 ›" : `‹ 请求${requestCount ? ` ${requestCount}` : ""}`}
          </button>
        </div>
      )}
      <div ref={hostRef} style={{ flex: 1, minHeight: 0, position: "relative", background: "#ffffff" }}>
        {active && status === "loading" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              color: "#9a9aa0",
              pointerEvents: "none",
            }}
          >
            正在加载页面…
          </div>
        )}
        {active && status === "error" && (
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
            <div style={{ fontSize: 12, color: "#8a8a8e", lineHeight: 1.5, maxWidth: 360 }}>{error}</div>
            <div style={{ fontSize: 11.5, color: "#9a9aa0" }}>
              请确认 Certificates 已 Trusted，然后重新点击 Open &amp; Capture
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

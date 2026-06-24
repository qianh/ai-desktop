import { useCallback, useEffect, useState } from "react";
import { fetchReportedIntercepts, REPORTED_INTERCEPTS_LIMIT } from "../api";
import { formatTimestamp } from "../lib/format";
import { loadSupabaseConfig } from "../lib/supabase";
import { truncateBody } from "../lib/truncate";
import type { InterceptedFetch } from "../types";
import { ACCENT } from "../lib/ui";

type Props = {
  pageId: string;
};

function truncateUrl(url: string, max = 60): string {
  return url.length > max ? url.slice(0, max) + "…" : url;
}

function Bubble({
  role,
  label,
  body,
}: {
  role: "user" | "assistant";
  label: string;
  body: string | null;
}) {
  const isUser = role === "user";
  const [expanded, setExpanded] = useState(false);
  const preview = expanded ? { text: body || "—", truncated: false } : truncateBody(body);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        marginBottom: 6,
      }}
    >
      <span style={{ fontSize: 10, color: "var(--c-text-4)", marginBottom: 2 }}>{label}</span>
      <div
        style={{
          maxWidth: "92%",
          padding: "8px 10px",
          borderRadius: 10,
          background: isUser ? "var(--c-user-bubble-bg)" : "var(--c-bg-3)",
          border: `1px solid ${isUser ? "var(--c-user-bubble-border)" : "var(--c-border-2)"}`,
          fontSize: 11,
          lineHeight: 1.45,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
          color: "var(--c-text)",
          maxHeight: expanded ? 400 : undefined,
          overflow: expanded ? "auto" : undefined,
        }}
      >
        {preview.text}
      </div>
      {preview.truncated && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          style={{
            marginTop: 2,
            fontSize: 10,
            border: "none",
            background: "none",
            color: ACCENT,
            cursor: "pointer",
            padding: 0,
          }}
        >
          展开全文
        </button>
      )}
    </div>
  );
}

export default function ReportedSessionPanel({ pageId }: Props) {
  const [items, setItems] = useState<InterceptedFetch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    const config = loadSupabaseConfig();
    if (!config.url || !config.key) {
      setError(null);
      setItems([]);
      setLoaded(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchReportedIntercepts(pageId, config, signal);
      if (signal?.aborted) return;
      setItems(rows);
      setLoaded(true);
    } catch (e) {
      if (signal?.aborted) return;
      setError(e instanceof Error ? e.message : String(e));
      setLoaded(true);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [pageId]);

  useEffect(() => {
    const ac = new AbortController();
    setLoaded(false);
    setItems([]);
    setError(null);
    void load(ac.signal);
    return () => ac.abort();
  }, [load]);

  const config = loadSupabaseConfig();
  const unconfigured = !config.url || !config.key;

  if (unconfigured) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "var(--c-text-4)", fontSize: 12 }}>
        <div style={{ marginBottom: 8 }}>未配置 Supabase</div>
        <div>请在 Settings → Cloud Sync 中填写 URL 和 API Key</div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 10px",
          borderBottom: "1px solid #ededf0",
          background: "var(--c-bg-2)",
          flex: "none",
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--c-text-2)" }}>
          上报记录 {loaded && !loading ? `(${items.length})` : ""}
          {loaded && items.length >= REPORTED_INTERCEPTS_LIMIT && (
            <span style={{ fontWeight: 400, color: "#c97b20", marginLeft: 6 }}>
              仅显示最近 {REPORTED_INTERCEPTS_LIMIT} 条
            </span>
          )}
        </span>
        <button
          onClick={() => void load()}
          disabled={loading}
          style={{
            fontSize: 11,
            padding: "3px 10px",
            borderRadius: 6,
            border: "1px solid #d4d4da",
            background: "var(--c-bg)",
            cursor: loading ? "default" : "pointer",
            color: ACCENT,
          }}
        >
          {loading ? "加载中…" : "刷新"}
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: "10px 12px",
            background: "#fff5f5",
            borderBottom: "1px solid #f0d0d0",
            fontSize: 11,
            color: "#d23b30",
          }}
        >
          {error}
          <button
            onClick={() => void load()}
            style={{
              marginLeft: 8,
              fontSize: 11,
              border: "none",
              background: "none",
              color: ACCENT,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            重试
          </button>
        </div>
      )}

      <div style={{ flex: 1, overflow: "auto", padding: "10px 12px" }}>
        {loaded && !loading && items.length === 0 && !error && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--c-text-4)", fontSize: 12 }}>
            暂无上报记录
          </div>
        )}
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              marginBottom: 16,
              paddingBottom: 12,
              borderBottom: "1px solid #f0f0f2",
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: "var(--c-text-4)",
                marginBottom: 8,
                fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
              }}
            >
              {formatTimestamp(item.timestamp)} · {item.method} · {truncateUrl(item.url)}
            </div>
            <Bubble role="user" label="用户" body={item.req_body} />
            <Bubble role="assistant" label="AI" body={item.resp_body} />
          </div>
        ))}
      </div>
    </div>
  );
}
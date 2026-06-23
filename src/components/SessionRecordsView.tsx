import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchConversationIntercepts, fetchSessionRecordSummaries, REPORTED_INTERCEPTS_LIMIT } from "../api";
import { formatTimestamp } from "../lib/format";
import { conversationPreview, parseConversationBodies } from "../lib/conversationFilter";
import { loadSupabaseConfig } from "../lib/supabase";
import { truncateBody } from "../lib/truncate";
import type { InterceptedFetch, Page, SessionRecordSummary } from "../types";
import { ACCENT, iconStyle } from "../lib/ui";

type Props = {
  pages: Page[];
  selectedPageId: string | null;
  onSelectPage: (pageId: string) => void;
};

const refreshBtnStyle = (loading: boolean): React.CSSProperties => ({
  fontSize: 12,
  padding: "5px 12px",
  borderRadius: 6,
  border: "1px solid #d4d4da",
  background: "#fff",
  cursor: loading ? "default" : "pointer",
  color: ACCENT,
});

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
        marginBottom: 8,
      }}
    >
      <span style={{ fontSize: 10, color: "#9a9aa0", marginBottom: 2 }}>{label}</span>
      <div
        style={{
          maxWidth: "88%",
          padding: "10px 12px",
          borderRadius: 12,
          background: isUser ? "#e8f0fe" : "#f3f3f5",
          border: `1px solid ${isUser ? "#c5d9f8" : "#e0e0e4"}`,
          fontSize: 13,
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          color: "#1d1d1f",
          maxHeight: expanded ? 480 : undefined,
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
            marginTop: 4,
            fontSize: 11,
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

function ConversationDetail({ pageId, pageName }: { pageId: string; pageName: string }) {
  const [items, setItems] = useState<InterceptedFetch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const config = loadSupabaseConfig();
      if (!config.url || !config.key) return;
      setLoading(true);
      setError(null);
      try {
        const rows = await fetchConversationIntercepts(pageId, config, signal);
        if (signal?.aborted) return;
        setItems(rows);
      } catch (e) {
        if (signal?.aborted) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [pageId],
  );

  useEffect(() => {
    const ac = new AbortController();
    setItems([]);
    void load(ac.signal);
    return () => ac.abort();
  }, [load]);

  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          borderBottom: "1px solid #ededf0",
          background: "#fbfbfc",
          flex: "none",
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#1d1d1f" }}>{pageName}</div>
          <div style={{ fontSize: 11, color: "#9a9aa0", marginTop: 2 }}>
            {loading ? "加载中…" : `${items.length} 条对话记录`}
            {!loading && items.length >= REPORTED_INTERCEPTS_LIMIT && (
              <span style={{ color: "#c97b20", marginLeft: 6 }}>
                （仅显示最近 {REPORTED_INTERCEPTS_LIMIT} 条）
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          style={refreshBtnStyle(loading)}
        >
          刷新
        </button>
      </div>

      {error && (
        <div style={{ padding: "10px 16px", background: "#fff5f5", color: "#d23b30", fontSize: 12 }}>
          {error}
        </div>
      )}

      <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
        {!loading && items.length === 0 && !error && (
          <div style={{ padding: 48, textAlign: "center", color: "#9a9aa0", fontSize: 13 }}>
            暂无对话记录
            <div style={{ fontSize: 12, marginTop: 8 }}>仅展示对话类请求，已过滤 analytics 等噪音</div>
          </div>
        )}
        {items.map((item) => {
          const { user, assistant, rawReq, rawResp } = parseConversationBodies(item);
          const urlShort =
            item.url.length > 72 ? item.url.slice(0, 72) + "…" : item.url;
          return (
            <div
              key={item.id}
              style={{
                marginBottom: 24,
                paddingBottom: 20,
                borderBottom: "1px solid #f0f0f2",
              }}
            >
              <div style={{ fontSize: 11, color: "#9a9aa0", marginBottom: 12 }}>
                {formatTimestamp(item.timestamp)} · {item.method} · {urlShort}
              </div>
              {user && <Bubble role="user" label="用户" body={user} />}
              {assistant && <Bubble role="assistant" label="AI" body={assistant} />}
              {!user && !assistant && rawReq && (
                <Bubble role="user" label="请求体（未识别为对话）" body={rawReq} />
              )}
              {!user && !assistant && rawResp && (
                <Bubble role="assistant" label="响应体（未识别为对话）" body={rawResp} />
              )}
              {!user && !assistant && !rawReq && !rawResp && (
                <div style={{ fontSize: 12, color: "#9a9aa0" }}>{conversationPreview(item)}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SessionRecordsView({ pages, selectedPageId, onSelectPage }: Props) {
  const [summaries, setSummaries] = useState<SessionRecordSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = useMemo(() => loadSupabaseConfig(), []);
  const unconfigured = !config.url || !config.key;

  const loadSummaries = useCallback(
    async (signal?: AbortSignal) => {
      if (!config.url || !config.key) return;
      setLoading(true);
      setError(null);
      try {
        const rows = await fetchSessionRecordSummaries(pages, config, signal);
        if (signal?.aborted) return;
        setSummaries(rows);
      } catch (e) {
        if (signal?.aborted) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [config.key, config.url, pages],
  );

  useEffect(() => {
    const ac = new AbortController();
    void loadSummaries(ac.signal);
    return () => ac.abort();
  }, [loadSummaries]);

  const selected =
    summaries.find((s) => s.pageId === selectedPageId) ||
    summaries.find((s) => s.recordCount > 0) ||
    summaries[0];

  if (unconfigured) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 8,
          color: "#9a9aa0",
          fontSize: 13,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, color: "#1d1d1f" }}>未配置 Supabase</div>
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
          padding: "10px 16px",
          borderBottom: "1px solid #e0e0e4",
          background: "#f6f6f8",
          flex: "none",
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: "#1d1d1f" }}>会话记录</span>
        <button
          onClick={() => void loadSummaries()}
          disabled={loading}
          style={refreshBtnStyle(loading)}
        >
          {loading ? "加载中…" : "刷新列表"}
        </button>
      </div>

      {error && (
        <div style={{ padding: "8px 16px", background: "#fff5f5", color: "#d23b30", fontSize: 12 }}>
          {error}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        <div
          style={{
            width: 280,
            flex: "none",
            borderRight: "1px solid #e0e0e4",
            overflow: "auto",
            background: "#fafafa",
          }}
        >
          {summaries.length === 0 && !loading && (
            <div style={{ padding: 24, textAlign: "center", color: "#9a9aa0", fontSize: 12 }}>
              暂无 Page，请先添加页面
            </div>
          )}
          {summaries.map((s) => {
            const sel = (selectedPageId || selected?.pageId) === s.pageId;
            return (
              <button
                key={s.pageId}
                onClick={() => onSelectPage(s.pageId)}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  width: "100%",
                  border: "none",
                  borderBottom: "1px solid #ededf0",
                  background: sel ? ACCENT + "18" : "transparent",
                  cursor: "pointer",
                  padding: "12px 14px",
                  textAlign: "left",
                }}
              >
                <span style={iconStyle(s.color)}>{s.letter}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#1d1d1f" }}>{s.pageName}</span>
                    <span
                      style={{
                        fontSize: 11,
                        color: s.recordCount > 0 ? ACCENT : "#9a9aa0",
                        fontFamily: "ui-monospace,Menlo,monospace",
                        flex: "none",
                      }}
                    >
                      {s.recordCount}
                    </span>
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontSize: 11,
                      color: "#9a9aa0",
                      marginTop: 2,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {s.pageHost}
                  </span>
                  {s.preview && (
                    <span
                      style={{
                        fontSize: 11.5,
                        color: "#5a5a5e",
                        marginTop: 6,
                        lineHeight: 1.4,
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {s.preview}
                    </span>
                  )}
                  {s.lastTimestamp && (
                    <span style={{ display: "block", fontSize: 10, color: "#b0b0b6", marginTop: 4 }}>
                      {formatTimestamp(s.lastTimestamp)}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {(selectedPageId || selected?.pageId) ? (
          <ConversationDetail
            pageId={selectedPageId || selected!.pageId}
            pageName={selected?.pageName || "会话"}
          />
        ) : (
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
            从左侧选择一个会话查看对话记录
          </div>
        )}
      </div>
    </div>
  );
}
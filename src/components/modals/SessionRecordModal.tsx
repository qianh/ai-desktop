import { useEffect, useState } from "react";
import { fetchInterceptById, resolveConversationMessages } from "../../api";
import { formatTimestamp } from "../../lib/format";
import {
  parseConversationBodies,
  type ConversationMessage,
} from "../../lib/conversationFilter";
import { loadSupabaseConfig, type SupabaseConfig } from "../../lib/supabase";
import { truncateBody } from "../../lib/truncate";
import { ACCENT } from "../../lib/ui";
import type { InterceptedFetch } from "../../types";
import ConversationMarkdown from "../ConversationMarkdown";

const MODAL_VIEWPORT_HEIGHT = "80vh";

function hasAnyBody(record: InterceptedFetch): boolean {
  return record.req_body != null || record.resp_body != null;
}

type Props = {
  record: InterceptedFetch;
  config?: SupabaseConfig;
  onClose: () => void;
};

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
  const text = body || "—";
  const preview = isUser
    ? expanded
      ? { text, truncated: false }
      : truncateBody(body)
    : { text, truncated: false };
  const useMarkdown = !isUser;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        marginBottom: 8,
      }}
    >
      <span style={{ fontSize: 10, color: "var(--c-text-4)", marginBottom: 2 }}>{label}</span>
      <div
        style={{
          maxWidth: isUser ? "88%" : "96%",
          padding: "10px 12px",
          borderRadius: 12,
          background: isUser ? "var(--c-user-bubble-bg)" : "var(--c-bg-3)",
          border: `1px solid ${isUser ? "var(--c-user-bubble-border)" : "var(--c-border-2)"}`,
          fontSize: 13,
          lineHeight: 1.5,
          whiteSpace: useMarkdown ? "normal" : "pre-wrap",
          wordBreak: "break-word",
          color: "var(--c-text)",
          maxHeight: isUser && expanded ? "40vh" : undefined,
          overflow: isUser && expanded ? "auto" : undefined,
        }}
      >
        {useMarkdown ? <ConversationMarkdown content={preview.text} /> : preview.text}
      </div>
      {isUser && preview.truncated && (
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

export default function SessionRecordModal({ record: initialRecord, config, onClose }: Props) {
  const [record, setRecord] = useState<InterceptedFetch | null>(
    hasAnyBody(initialRecord) ? initialRecord : null,
  );
  const [messages, setMessages] = useState<ConversationMessage[] | null>(null);
  const [loading, setLoading] = useState(!hasAnyBody(initialRecord));
  const [error, setError] = useState<string | null>(null);
  const [threadWarning, setThreadWarning] = useState<string | null>(null);
  const resolvedConfig = config ?? loadSupabaseConfig();
  const display = record ?? initialRecord;
  const bodies = display.req_body != null || display.resp_body != null
    ? parseConversationBodies(display)
    : null;
  const urlShort = display.url.length > 72 ? display.url.slice(0, 72) + "…" : display.url;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    setMessages(null);
    if (hasAnyBody(initialRecord)) {
      setRecord(initialRecord);
      return;
    }
    setRecord(null);
  }, [initialRecord.id, initialRecord.req_body, initialRecord.resp_body]);

  useEffect(() => {
    if (!resolvedConfig.url || !resolvedConfig.key) {
      setLoading(false);
      setError("未配置 Supabase");
      return;
    }

    const ac = new AbortController();

    async function loadDetail() {
      setLoading(true);
      setError(null);
      setThreadWarning(null);
      setMessages(null);

      try {
        let loaded = hasAnyBody(initialRecord) ? initialRecord : null;
        if (!loaded) {
          const row = await fetchInterceptById(initialRecord.id, resolvedConfig, ac.signal);
          if (ac.signal.aborted) return;
          if (!row) {
            setError("记录不存在或已被删除");
            return;
          }
          loaded = {
            ...row,
            req_body: row.req_body ?? initialRecord.req_body,
            resp_body: row.resp_body ?? initialRecord.resp_body,
          };
        }

        if (ac.signal.aborted) return;
        setRecord(loaded);

        const thread = await resolveConversationMessages(loaded, resolvedConfig, ac.signal);
        if (ac.signal.aborted) return;
        setMessages(thread.messages);
        if (thread.loadError) {
          setThreadWarning(`部分对话记录加载失败：${thread.loadError}`);
        } else if (thread.partial) {
          setThreadWarning("对话记录过多，仅显示部分内容");
        }
      } catch (e) {
        if (ac.signal.aborted) return;
        if (e instanceof Error && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }

    void loadDetail();
    return () => ac.abort();
  }, [initialRecord, resolvedConfig.url, resolvedConfig.key]);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: 1120,
        maxWidth: "96vw",
        height: MODAL_VIEWPORT_HEIGHT,
        maxHeight: MODAL_VIEWPORT_HEIGHT,
        background: "var(--c-bg)",
        borderRadius: 13,
        border: "1px solid var(--c-border-3)",
        boxShadow: "0 24px 80px rgba(0,0,0,.6), 0 0 0 0.5px var(--c-border-3)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 18px",
          borderBottom: "1px solid var(--c-border)",
          background: "var(--c-bg-2)",
          flex: "none",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text)" }}>对话详情</div>
          <div style={{ fontSize: 11, color: "var(--c-text-4)", marginTop: 2 }}>
            {formatTimestamp(display.timestamp)} · {display.method} · {urlShort}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            appearance: "none",
            border: "none",
            background: "none",
            cursor: "pointer",
            fontSize: 20,
            lineHeight: 1,
            color: "var(--c-text-4)",
            padding: "4px 8px",
            flex: "none",
          }}
          aria-label="关闭"
        >
          ×
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "16px 20px" }}>
        {loading && (
          <div style={{ fontSize: 12, color: "var(--c-text-4)" }}>加载对话内容…</div>
        )}
        {error && !loading && (
          <div style={{ fontSize: 12, color: "#d23b30" }}>{error}</div>
        )}
        {threadWarning && !loading && !error && (
          <div style={{ fontSize: 12, color: "#b45309", marginBottom: 10 }}>{threadWarning}</div>
        )}
        {!loading && !error && messages && messages.length > 0 && (
          <>
            {messages.map((msg, index) => (
              <Bubble
                key={`${msg.role}-${index}`}
                role={msg.role}
                label={msg.role === "user" ? "用户" : "AI"}
                body={msg.text}
              />
            ))}
          </>
        )}
        {!loading && !error && (!messages || messages.length === 0) && bodies && (
          <>
            {bodies.user && <Bubble role="user" label="用户" body={bodies.user} />}
            {bodies.assistant && (
              <Bubble
                role="assistant"
                label={bodies.assistant.startsWith("会话标题：") ? "会话" : "AI"}
                body={bodies.assistant}
              />
            )}
            {!bodies.user && !bodies.assistant && bodies.rawReq && (
              <Bubble role="user" label="请求体（未识别为对话）" body={bodies.rawReq} />
            )}
            {!bodies.user && !bodies.assistant && bodies.rawResp && (
              <Bubble role="assistant" label="响应体（未识别为对话）" body={bodies.rawResp} />
            )}
            {!bodies.user && !bodies.assistant && !bodies.rawReq && !bodies.rawResp && display.preview_text && (
              <Bubble role="assistant" label="会话" body={display.preview_text} />
            )}
            {!bodies.user && !bodies.assistant && !bodies.rawReq && !bodies.rawResp && !display.preview_text && (
              <div style={{ fontSize: 12, color: "var(--c-text-4)" }}>（无请求/响应 body）</div>
            )}
          </>
        )}
        {!loading && !error && (!messages || messages.length === 0) && !bodies && display.preview_text && (
          <Bubble role="assistant" label="会话" body={display.preview_text} />
        )}
        {!loading && !error && (!messages || messages.length === 0) && !bodies && !display.preview_text && (
          <div style={{ fontSize: 12, color: "var(--c-text-4)" }}>（无请求/响应 body）</div>
        )}
      </div>
    </div>
  );
}
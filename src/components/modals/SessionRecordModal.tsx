import { useEffect, useState } from "react";
import { formatTimestamp } from "../../lib/format";
import { parseConversationBodies } from "../../lib/conversationFilter";
import { truncateBody } from "../../lib/truncate";
import { ACCENT } from "../../lib/ui";
import type { InterceptedFetch } from "../../types";

type Props = {
  record: InterceptedFetch;
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

export default function SessionRecordModal({ record, onClose }: Props) {
  const { user, assistant, rawReq, rawResp } = parseConversationBodies(record);
  const urlShort = record.url.length > 72 ? record.url.slice(0, 72) + "…" : record.url;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: 1120,
        maxWidth: "96vw",
        maxHeight: "85vh",
        background: "#fff",
        borderRadius: 13,
        boxShadow: "0 24px 60px rgba(0,0,0,.4)",
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
          borderBottom: "1px solid #ededf0",
          background: "#fbfbfc",
          flex: "none",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#1d1d1f" }}>对话详情</div>
          <div style={{ fontSize: 11, color: "#9a9aa0", marginTop: 2 }}>
            {formatTimestamp(record.timestamp)} · {record.method} · {urlShort}
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
            color: "#9a9aa0",
            padding: "4px 8px",
            flex: "none",
          }}
          aria-label="关闭"
        >
          ×
        </button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
        {user && <Bubble role="user" label="用户" body={user} />}
        {assistant && <Bubble role="assistant" label="AI" body={assistant} />}
        {!user && !assistant && rawReq && (
          <Bubble role="user" label="请求体（未识别为对话）" body={rawReq} />
        )}
        {!user && !assistant && rawResp && (
          <Bubble role="assistant" label="响应体（未识别为对话）" body={rawResp} />
        )}
        {!user && !assistant && !rawReq && !rawResp && (
          <div style={{ fontSize: 12, color: "#9a9aa0" }}>（无请求/响应 body）</div>
        )}
      </div>
    </div>
  );
}
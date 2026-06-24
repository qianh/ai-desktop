import { useState } from "react";
import type { InterceptedFetch } from "../types";

type Props = {
  intercepts: InterceptedFetch[];
};

function truncatePreview(text: string | null, maxLen = 200): string {
  if (!text) return "—";
  return text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function statusColor(status: number): string {
  if (status >= 200 && status < 300) return "#30a14e";
  if (status >= 300 && status < 400) return "#c97b20";
  if (status >= 400) return "#d23b30";
  return "var(--c-text-3)";
}

export default function InterceptPanel({ intercepts }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (intercepts.length === 0) {
    return (
      <div
        style={{
          padding: 24,
          textAlign: "center",
          color: "var(--c-text-4)",
          fontSize: 12,
        }}
      >
        等待拦截数据…
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: "auto", fontSize: 12 }}>
      {intercepts.map((item) => {
        const expanded = expandedId === item.id;
        return (
          <div
            key={item.id}
            style={{
              borderBottom: "1px solid var(--c-border)",
              cursor: "pointer",
            }}
          >
            <div
              onClick={() => setExpandedId(expanded ? null : item.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                background: expanded ? "var(--c-bg-2)" : "transparent",
              }}
            >
              <span
                style={{
                  fontWeight: 600,
                  color: "var(--c-text-2)",
                  minWidth: 40,
                  fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
                  fontSize: 11,
                }}
              >
                {item.method}
              </span>
              <span
                style={{
                  color: statusColor(item.status),
                  minWidth: 28,
                  fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
                  fontSize: 11,
                }}
              >
                {item.status || "ERR"}
              </span>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: "var(--c-text)",
                  fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
                  fontSize: 11,
                }}
              >
                {item.url}
              </span>
              <span style={{ color: "var(--c-text-3)", fontSize: 10, whiteSpace: "nowrap" }}>
                {formatTime(item.duration_ms)}
              </span>
              <span style={{ color: "var(--c-text-4)", fontSize: 10 }}>
                {expanded ? "▼" : "▶"}
              </span>
            </div>
            {expanded && (
              <div style={{ padding: "8px 10px 12px 58px", background: "var(--c-bg-2)" }}>
                {item.req_body && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontWeight: 600, color: "var(--c-text-2)", marginBottom: 4 }}>
                      Request Body
                    </div>
                    <pre
                      style={{
                        margin: 0,
                        padding: 8,
                        background: "var(--c-bg-2)",
                        border: "1px solid var(--c-border)",
                        borderRadius: 4,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                        fontSize: 11,
                        maxHeight: 200,
                        overflow: "auto",
                        color: "var(--c-text)",
                        fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
                      }}
                    >
                      {truncatePreview(item.req_body, 2000)}
                    </pre>
                  </div>
                )}
                {item.resp_body && (
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--c-text-2)", marginBottom: 4 }}>
                      Response Body
                    </div>
                    <pre
                      style={{
                        margin: 0,
                        padding: 8,
                        background: "var(--c-bg-2)",
                        border: "1px solid var(--c-border)",
                        borderRadius: 4,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                        fontSize: 11,
                        maxHeight: 300,
                        overflow: "auto",
                        color: "var(--c-text)",
                        fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
                      }}
                    >
                      {truncatePreview(item.resp_body, 5000)}
                    </pre>
                  </div>
                )}
                {item.error && (
                  <div style={{ color: "#d23b30", marginTop: 4 }}>
                    Error: {item.error}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

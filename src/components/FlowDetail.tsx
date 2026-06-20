// Request inspector — a React port of FlowDetail.dc.html.
// Tabs: Overview / Request+Response Headers / Bodies / Cookies / Timing / Raw / Notes.
import { useState, type CSSProperties } from "react";
import type { Cookie, Flow, Header } from "../types";
import { methodColor, statusColor } from "../lib/format";

const MASK = "•••••••••••••• (已脱敏)";
const MASK_SHORT = "••••••••••••";

const tabsDef: [string, string][] = [
  ["overview", "Overview"],
  ["reqh", "Request Headers"],
  ["reqb", "Request Body"],
  ["resph", "Response Headers"],
  ["respb", "Response Body"],
  ["cookies", "Cookies"],
  ["timing", "Timing"],
  ["raw", "Raw"],
  ["notes", "Notes"],
];

const timingDef: [string, keyof Flow["timing"], string][] = [
  ["Stalled", "blocked", "#b8b8bd"],
  ["DNS", "dns", "#9b8afb"],
  ["Connect", "connect", "#f2b33d"],
  ["TLS", "tls", "#34a853"],
  ["Request sent", "send", "#5b9bd5"],
  ["Waiting (TTFB)", "wait", "#e0863b"],
  ["Content download", "receive", "#2d7d46"],
];

const wrap: CSSProperties = {
  height: "100%",
  display: "flex",
  flexDirection: "column",
  background: "#ffffff",
  fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Text',system-ui,sans-serif",
  color: "#1d1d1f",
  minHeight: 0,
  overflow: "hidden",
};
const headerRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "200px 1fr",
  columnGap: 12,
  padding: "6px 16px",
  borderBottom: "1px solid #f3f3f5",
  font: "12px ui-monospace,'SF Mono',Menlo,monospace",
  alignItems: "baseline",
};
const revealBtn: CSSProperties = {
  appearance: "none",
  border: "none",
  background: "none",
  color: "#007aff",
  cursor: "pointer",
  font: "11px -apple-system,system-ui",
  padding: 0,
  whiteSpace: "nowrap",
};
const preStyle: CSSProperties = {
  margin: 0,
  padding: "14px 16px",
  font: "12px/1.65 ui-monospace,'SF Mono',Menlo,monospace",
  color: "#1d1d1f",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};
const bodyTypeBar: CSSProperties = {
  padding: "8px 16px",
  display: "flex",
  gap: 10,
  alignItems: "center",
  borderBottom: "1px solid #f3f3f5",
  fontSize: 11,
  color: "#8a8a8e",
};
const emptyMsg: CSSProperties = { padding: "24px 16px", color: "#98989d", fontSize: 12.5 };

export default function FlowDetail({ flow }: { flow: Flow | null }) {
  const [tab, setTab] = useState("overview");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const toggle = (id: string) => setRevealed((r) => ({ ...r, [id]: !r[id] }));

  if (!flow) {
    return (
      <div style={wrap}>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            color: "#b0b0b5",
          }}
        >
          <div style={{ width: 40, height: 40, borderRadius: 9, border: "1.5px dashed #d4d4d8" }} />
          <div style={{ fontSize: 12.5, color: "#98989d" }}>选择一条请求查看详情</div>
        </div>
      </div>
    );
  }

  const f = flow;
  const pending = f.status == null;
  const statusLabel = pending ? "Pending" : `${f.status} ${f.statusText || ""}`;

  const renderHeaderRows = (arr: Header[], prefix: string) =>
    arr.map((h, i) => {
      const id = prefix + i;
      const sens = !!h.sensitive;
      const hidden = sens && !revealed[id];
      return (
        <div key={id} style={headerRow}>
          <div style={{ color: "#6e6e73", wordBreak: "break-all" }}>{h.name}</div>
          <div style={{ color: "#1d1d1f", wordBreak: "break-all", display: "flex", gap: 8, alignItems: "baseline" }}>
            <span style={{ flex: 1, minWidth: 0 }}>{hidden ? MASK : h.value}</span>
            {sens && (
              <button onClick={() => toggle(id)} style={revealBtn}>
                {revealed[id] ? "Hide" : "Reveal"}
              </button>
            )}
          </div>
        </div>
      );
    });

  const renderCookieInline = (arr: Cookie[] | undefined, prefix: string) =>
    (arr || []).map((c, i) => {
      const id = prefix + i;
      const sens = !!c.sensitive;
      const hidden = sens && !revealed[id];
      return (
        <div
          key={id}
          style={{
            display: "grid",
            gridTemplateColumns: "160px 1fr",
            columnGap: 12,
            padding: "6px 0",
            borderBottom: "1px solid #f3f3f5",
            font: "12px ui-monospace,Menlo,monospace",
            alignItems: "baseline",
          }}
        >
          <div style={{ color: "#6e6e73" }}>{c.name}</div>
          <div style={{ color: "#1d1d1f", wordBreak: "break-all", display: "flex", gap: 8 }}>
            <span style={{ flex: 1, minWidth: 0 }}>{hidden ? MASK_SHORT : c.value}</span>
            {sens && (
              <button onClick={() => toggle(id)} style={revealBtn}>
                {revealed[id] ? "Hide" : "Reveal"}
              </button>
            )}
          </div>
        </div>
      );
    });

  const overviewRows: [string, string][] = [
    ["Method", f.method],
    ["URL", f.url],
    ["Status", pending ? "Pending" : `${f.status} ${f.statusText || ""}`],
    ["Protocol", f.protocol || "h2"],
    ["Type", f.typeLabel || f.type],
    ["Remote", f.remote || `${f.host}:443`],
    ["Request size", f.reqSizeLabel || "—"],
    ["Response size", f.sizeLabel || "—"],
    ["Duration", pending ? "—" : `${f.time} ms`],
    ["Started", f.started],
    ["Session", "Acme Console"],
  ];

  const reqBody = f.reqBody || { kind: "none" };
  const respBody = f.respBody || { kind: "none" };
  const isBinary = ["image", "font", "media", "binary"].includes(respBody.kind);

  const tm = f.timing;
  const total = timingDef.reduce((a, [, k]) => a + (tm[k] || 0), 0) || 1;
  const segs = timingDef
    .filter(([, k]) => (tm[k] || 0) > 0)
    .map(([label, k, color]) => ({ label, color, ms: tm[k] || 0 }));

  let raw = `${f.method} ${f.path || "/"} HTTP/2\n`;
  (f.reqHeaders || []).forEach((h) => {
    raw += `${h.name}: ${h.sensitive ? "•••••• (masked)" : h.value}\n`;
  });
  raw += "\n——————————\n\n";
  raw += `HTTP/2 ${pending ? "(pending)" : `${f.status} ${f.statusText || ""}`}\n`;
  (f.respHeaders || []).forEach((h) => {
    raw += `${h.name}: ${h.sensitive ? "•••••• (masked)" : h.value}\n`;
  });

  const reqCookieRows = renderCookieInline(f.reqCookies, "rc");
  const respCookies = f.respCookies || [];

  return (
    <div style={wrap}>
      {/* header */}
      <div
        style={{
          padding: "9px 14px",
          borderBottom: "1px solid #ededf0",
          display: "flex",
          alignItems: "center",
          gap: 9,
          flex: "none",
          background: "#fbfbfc",
        }}
      >
        <span
          style={{
            font: "600 11px ui-monospace,'SF Mono',Menlo,monospace",
            padding: "2px 7px",
            borderRadius: 4,
            background: methodColor(f.method) + "1a",
            color: methodColor(f.method),
            flex: "none",
          }}
        >
          {f.method}
        </span>
        <span
          style={{
            font: "500 12px ui-monospace,'SF Mono',Menlo,monospace",
            color: "#1d1d1f",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            flex: 1,
            minWidth: 0,
          }}
        >
          {f.path}
        </span>
        <span
          style={{
            font: "600 11.5px ui-monospace,'SF Mono',Menlo,monospace",
            color: statusColor(f.status),
            flex: "none",
          }}
        >
          {statusLabel}
        </span>
      </div>

      {/* tabs */}
      <div
        style={{
          display: "flex",
          padding: "0 6px",
          borderBottom: "1px solid #ededf0",
          flex: "none",
          overflowX: "auto",
          background: "#fbfbfc",
        }}
      >
        {tabsDef.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              appearance: "none",
              border: "none",
              background: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 12,
              padding: "9px 11px",
              whiteSpace: "nowrap",
              borderBottom: "2px solid " + (tab === key ? "#007aff" : "transparent"),
              color: tab === key ? "#007aff" : "#6e6e73",
              fontWeight: tab === key ? 590 : 400,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* body */}
      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        {tab === "overview" && (
          <div style={{ padding: "14px 16px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "118px 1fr",
                rowGap: 9,
                columnGap: 14,
                fontSize: 12.5,
                alignItems: "baseline",
              }}
            >
              {overviewRows.map(([k, v]) => (
                <div key={k} style={{ display: "contents" }}>
                  <div style={{ color: "#8a8a8e" }}>{k}</div>
                  <div style={{ color: "#1d1d1f", fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", wordBreak: "break-all" }}>
                    {v}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "reqh" && <div style={{ padding: "6px 0" }}>{renderHeaderRows(f.reqHeaders, "qh")}</div>}
        {tab === "resph" && <div style={{ padding: "6px 0" }}>{renderHeaderRows(f.respHeaders, "sh")}</div>}

        {tab === "reqb" &&
          (reqBody.kind === "none" ? (
            <div style={emptyMsg}>该请求没有 Body</div>
          ) : (
            <>
              <div style={bodyTypeBar}>{reqBody.ctype || "application/json"}</div>
              <pre style={preStyle}>{reqBody.text || ""}</pre>
            </>
          ))}

        {tab === "respb" &&
          (respBody.kind === "none" ? (
            <div style={emptyMsg}>无响应 Body</div>
          ) : isBinary ? (
            <div style={{ padding: "18px 16px" }}>
              <div style={{ fontSize: 11, color: "#8a8a8e", marginBottom: 10 }}>{respBody.ctype}</div>
              <div
                style={{
                  height: 150,
                  borderRadius: 8,
                  border: "1px solid #ededf0",
                  backgroundImage: "repeating-linear-gradient(45deg,#f6f6f8 0 10px,#f0f0f3 10px 20px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#a0a0a6",
                  font: "11px ui-monospace,Menlo,monospace",
                }}
              >
                {respBody.note || "binary preview"}
              </div>
            </div>
          ) : (
            <>
              <div style={bodyTypeBar}>{respBody.ctype}</div>
              <pre style={preStyle}>{respBody.text || ""}</pre>
            </>
          ))}

        {tab === "cookies" && (
          <div style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#8a8a8e", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>
              Request Cookies
            </div>
            {reqCookieRows.length === 0 ? <div style={{ color: "#98989d", fontSize: 12.5, marginBottom: 18 }}>无</div> : reqCookieRows}
            <div style={{ fontSize: 11, fontWeight: 600, color: "#8a8a8e", textTransform: "uppercase", letterSpacing: ".04em", margin: "18px 0 8px" }}>
              Response Cookies
            </div>
            {respCookies.length === 0 ? (
              <div style={{ color: "#98989d", fontSize: 12.5 }}>无</div>
            ) : (
              respCookies.map((c, i) => {
                const id = "sc" + i;
                const sens = !!c.sensitive;
                const hidden = sens && !revealed[id];
                const meta = c.meta || (c.domain ? `${c.domain} · ${c.path || "/"}${c.httpOnly ? " · HttpOnly" : ""}${c.secure ? " · Secure" : ""}` : "");
                return (
                  <div key={id} style={{ border: "1px solid #ededf0", borderRadius: 8, padding: "10px 12px", marginBottom: 8, font: "12px ui-monospace,Menlo,monospace" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                      <span style={{ color: "#6e6e73" }}>{c.name}</span>
                      <span style={{ color: "#1d1d1f", flex: 1, minWidth: 0, wordBreak: "break-all" }}>{hidden ? MASK_SHORT : c.value}</span>
                      {sens && (
                        <button onClick={() => toggle(id)} style={revealBtn}>
                          {revealed[id] ? "Hide" : "Reveal"}
                        </button>
                      )}
                    </div>
                    {meta && <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 5, color: "#8a8a8e" }}>{meta}</div>}
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === "timing" && (
          <div style={{ padding: 16 }}>
            <div style={{ display: "flex", height: 22, borderRadius: 5, overflow: "hidden", border: "1px solid #ededf0", marginBottom: 6 }}>
              {segs.map((s) => (
                <div key={s.label} style={{ width: `${((s.ms / total) * 100).toFixed(2)}%`, background: s.color }} />
              ))}
            </div>
            <div style={{ fontSize: 11, color: "#8a8a8e", textAlign: "right", marginBottom: 14 }}>
              总计 {f.time != null ? f.time + " ms" : "—"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", rowGap: 2, fontSize: 12.5 }}>
              {segs.map((s) => (
                <div key={s.label} style={{ display: "contents" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid #f3f3f5" }}>
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: s.color, flex: "none" }} />
                    <span style={{ color: "#1d1d1f" }}>{s.label}</span>
                  </div>
                  <div style={{ padding: "5px 0", borderBottom: "1px solid #f3f3f5", fontFamily: "ui-monospace,Menlo,monospace", color: "#6e6e73", textAlign: "right" }}>
                    {s.ms.toFixed(1)} ms
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "raw" && <pre style={{ ...preStyle, font: "11.5px/1.7 ui-monospace,'SF Mono',Menlo,monospace" }}>{raw}</pre>}

        {tab === "notes" && (
          <div style={{ padding: "14px 16px" }}>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="为这条请求添加备注，导出时一并附带…"
              style={{
                width: "100%",
                boxSizing: "border-box",
                minHeight: 160,
                resize: "vertical",
                border: "1px solid #e2e2e4",
                borderRadius: 8,
                padding: "11px 12px",
                font: "13px/1.6 -apple-system,system-ui",
                color: "#1d1d1f",
                outline: "none",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Left sidebar — search, Pages, Apps, Certificates, Settings.
import type { CSSProperties } from "react";
import type { AppEntry, Page } from "../types";
import { ACCENT, iconStyle } from "../lib/ui";

const rowBase: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  width: "100%",
  border: "none",
  background: "none",
  cursor: "pointer",
  borderRadius: 8,
  padding: "6px 9px",
  marginBottom: 1,
};
const navBase: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  width: "100%",
  border: "none",
  background: "none",
  cursor: "pointer",
  borderRadius: 7,
  padding: "6px 9px",
  font: "13px -apple-system,system-ui",
  color: "#1d1d1f",
  textAlign: "left",
};

const sectionHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 8px 4px",
};
const sectionLabel: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  color: "#9a9aa0",
  letterSpacing: ".06em",
  textTransform: "uppercase",
};
const addBtn: CSSProperties = {
  appearance: "none",
  border: "none",
  background: "none",
  cursor: "pointer",
  color: "#8a8a8e",
  fontSize: 15,
  lineHeight: 1,
  padding: "0 2px",
};
const itemBtn: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  flex: 1,
  minWidth: 0,
  border: "none",
  background: "none",
  cursor: "pointer",
  padding: "6px 0 6px 9px",
  textAlign: "left",
};
const deleteBtn: CSSProperties = {
  appearance: "none",
  border: "none",
  background: "none",
  cursor: "pointer",
  color: "#9a9aa0",
  fontSize: 15,
  lineHeight: 1,
  padding: "6px 8px",
  flex: "none",
  position: "relative",
  zIndex: 2,
};
const collapseToggle: CSSProperties = {
  appearance: "none",
  border: "none",
  background: "none",
  cursor: "pointer",
  color: "#9a9aa0",
  fontSize: 13,
  lineHeight: 1,
  padding: "4px 6px",
  borderRadius: 5,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
function collapsedIconBtn(sel: boolean): CSSProperties {
  return {
    ...collapseToggle,
    background: sel ? ACCENT + "22" : "none",
    width: 28,
    height: 28,
    borderRadius: 7,
    fontSize: 12,
    fontWeight: 600,
  };
}

function reportingTip(enabled: boolean): string {
  return enabled ? "拦截与上报：已开启" : "拦截与上报：已关闭";
}

type ReportingToggleProps = {
  pageId: string;
  enabled: boolean;
  compact?: boolean;
  onToggle: (pageId: string, enabled: boolean) => void | Promise<void>;
};

function ReportingToggle({ pageId, enabled, compact, onToggle }: ReportingToggleProps) {
  const tip = reportingTip(enabled);
  const btnStyle: CSSProperties = {
    appearance: "none",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
    color: enabled ? ACCENT : "#8e8e93",
    background: enabled ? (compact ? "rgba(0, 122, 255, 0.12)" : "rgba(0, 122, 255, 0.1)") : "transparent",
    ...(compact
      ? { width: 18, height: 14, borderRadius: 4, fontSize: 9, padding: 0 }
      : {
          flex: "none",
          width: 22,
          height: 22,
          borderRadius: 6,
          fontSize: 13,
          position: "relative",
          zIndex: 2,
          transition: "background 0.12s ease, color 0.12s ease",
        }),
  };

  return (
    <span className="asc-hover-tip">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void onToggle(pageId, !enabled);
        }}
        aria-label={tip}
        aria-pressed={enabled}
        style={btnStyle}
      >
        {enabled ? "◉" : "○"}
      </button>
      <span className="asc-hover-tip__bubble" role="tooltip">
        {tip}
      </span>
    </span>
  );
}

type Props = {
  pages: Page[];
  apps: AppEntry[];
  navMode: string;
  activeId: string;
  query: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onQuery: (v: string) => void;
  onSelect: (id: string) => void;
  onDeletePage: (id: string) => void | Promise<void>;
  onToggleInterceptReporting: (pageId: string, enabled: boolean) => void | Promise<void>;
  onDeleteApp: (id: string) => void | Promise<void>;
  onAddPage: () => void;
  onAddApp: () => void;
  onCerts: () => void;
  onSettings: () => void;
  onOpenSessionRecords: () => void;
  sessionRecordsActive: boolean;
};

export default function Sidebar(p: Props) {
  const sessionsMode = p.navMode === "sessions";
  const navSel = (on: boolean): CSSProperties => (on ? { ...navBase, background: ACCENT + "1f" } : navBase);
  const rowSel = (on: boolean): CSSProperties => (on ? { ...rowBase, background: ACCENT + "22" } : rowBase);

  if (p.collapsed) {
    return (
      <div
        style={{
          width: 40,
          flex: "none",
          background: "#f3f3f5",
          borderRight: "1px solid #e0e0e4",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          minHeight: 0,
          paddingTop: 8,
          gap: 6,
        }}
      >
        <button
          onClick={p.onToggleCollapse}
          title="展开侧边栏"
          style={{ ...collapseToggle, marginBottom: 4 }}
        >
          ▶
        </button>
        <button
          onClick={p.onOpenSessionRecords}
          title="会话记录"
          style={{ ...collapseToggle, background: p.sessionRecordsActive ? ACCENT + "1f" : "none" }}
        >
          💬
        </button>
        {p.pages.map((pg) => {
          const sel = sessionsMode && p.activeId === pg.id;
          const isCapturing = pg.status === "capturing";
          return (
            <div
              key={pg.id}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}
            >
              <button
                onClick={() => p.onSelect(pg.id)}
                title={pg.name}
                style={{ ...collapsedIconBtn(sel), color: pg.color || "#5a5a5e", position: "relative" }}
              >
                {pg.letter}
                {isCapturing && (
                  <span className="asc-page-status asc-page-status--live" aria-hidden />
                )}
              </button>
              <ReportingToggle
                pageId={pg.id}
                enabled={pg.interceptReportingEnabled}
                compact
                onToggle={p.onToggleInterceptReporting}
              />
            </div>
          );
        })}
        {p.apps.map((a) => (
          <button
            key={a.id}
            onClick={() => p.onSelect(a.id)}
            title={a.name}
            style={{ ...collapsedIconBtn(sessionsMode && p.activeId === a.id), color: a.color || "#5a5a5e" }}
          >
            {a.letter}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={p.onCerts} title="Certificates" style={{ ...collapseToggle, marginBottom: 2 }}>
          🛡
        </button>
        <button onClick={p.onSettings} title="Settings" style={{ ...collapseToggle, marginBottom: 8 }}>
          ⚙
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: 246, flex: "none", background: "#f3f3f5", borderRight: "1px solid #e0e0e4", display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* search + collapse */}
      <div style={{ padding: "10px 11px 6px", display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, background: "#e7e7ea", borderRadius: 7, padding: "5px 9px" }}>
          <span style={{ color: "#9a9aa0", fontSize: 12 }}>⌕</span>
          <input
            value={p.query}
            onChange={(e) => p.onQuery(e.target.value)}
            placeholder="搜索请求 / Host / Path"
            style={{ flex: 1, minWidth: 0, border: "none", background: "none", outline: "none", font: "12px -apple-system,system-ui", color: "#1d1d1f" }}
          />
        </div>
        <button
          onClick={p.onToggleCollapse}
          title="收起侧边栏"
          style={collapseToggle}
        >
          ◀
        </button>
      </div>

      {/* scroll list */}
      <div style={{ flex: 1, overflow: "auto", minHeight: 0, padding: "2px 8px 8px" }}>
        <button onClick={p.onOpenSessionRecords} style={navSel(p.sessionRecordsActive)}>
          <span style={{ width: 18, textAlign: "center", fontSize: 13 }}>💬</span>
          <span style={{ flex: 1, textAlign: "left" }}>会话记录</span>
        </button>

        <div style={sectionHeader}>
          <span style={sectionLabel}>Pages</span>
          <button onClick={p.onAddPage} title="Add Page" style={addBtn}>
            +
          </button>
        </div>
        {p.pages.map((pg) => {
          const sel = sessionsMode && p.activeId === pg.id;
          const isCapturing = pg.status === "capturing";
          const reportingOn = pg.interceptReportingEnabled;
          return (
            <div key={pg.id} style={{ ...rowSel(sel), padding: 0, overflow: "visible" }}>
              <button onClick={() => p.onSelect(pg.id)} style={itemBtn}>
                <span style={{ position: "relative", flex: "none", display: "flex" }}>
                  <span style={iconStyle(pg.color)}>{pg.letter}</span>
                  {isCapturing && (
                    <span className="asc-page-status asc-page-status--live" aria-hidden />
                  )}
                </span>
                <span style={{ flex: 1, textAlign: "left", minWidth: 0, overflow: "hidden" }}>
                  <span style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#1d1d1f", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {pg.name}
                  </span>
                  <span style={{ display: "block", fontSize: 11, color: "#9a9aa0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pg.host}</span>
                </span>
              </button>
              <ReportingToggle
                pageId={pg.id}
                enabled={reportingOn}
                onToggle={p.onToggleInterceptReporting}
              />
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  p.onDeletePage(pg.id);
                }}
                title="Delete Page"
                aria-label={`Delete ${pg.name}`}
                style={deleteBtn}
              >
                ×
              </button>
            </div>
          );
        })}

        <div style={{ ...sectionHeader, paddingTop: 14 }}>
          <span style={sectionLabel}>Apps</span>
          <button onClick={p.onAddApp} title="Add App" style={addBtn}>
            +
          </button>
        </div>
        {p.apps.map((a) => {
          const sel = sessionsMode && p.activeId === a.id;
          return (
            <div key={a.id} style={{ ...rowSel(sel), padding: 0, overflow: "hidden" }}>
              <button onClick={() => p.onSelect(a.id)} style={itemBtn}>
                <span style={iconStyle(a.color)}>{a.letter}</span>
                <span style={{ flex: 1, textAlign: "left", minWidth: 0, overflow: "hidden" }}>
                  <span style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#1d1d1f", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {a.name}
                  </span>
                  <span style={{ display: "block", fontSize: 11, color: "#9a9aa0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.mode}</span>
                </span>
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  p.onDeleteApp(a.id);
                }}
                title="Delete App"
                aria-label={`Delete ${a.name}`}
                style={deleteBtn}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {/* footer nav */}
      <div style={{ borderTop: "1px solid #e0e0e4", padding: 8, display: "flex", flexDirection: "column", gap: 2 }}>
        <button onClick={p.onCerts} style={navSel(p.navMode === "certs")}>
          <span style={{ width: 18, textAlign: "center", fontSize: 13 }}>🛡</span>
          <span style={{ flex: 1, textAlign: "left" }}>Certificates</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: "#30a14e", background: "#e7f6ec", borderRadius: 5, padding: "2px 6px" }}>Trusted</span>
        </button>
        <button onClick={p.onSettings} style={navSel(p.navMode === "settings")}>
          <span style={{ width: 18, textAlign: "center", fontSize: 13 }}>⚙</span>
          <span style={{ flex: 1, textAlign: "left" }}>Settings</span>
        </button>
      </div>
    </div>
  );
}

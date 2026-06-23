// Left sidebar — search, All Sessions, Pages, Apps, Certificates, Settings.
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

type Props = {
  pages: Page[];
  apps: AppEntry[];
  navMode: string;
  activeId: string;
  totalCount: string;
  query: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onQuery: (v: string) => void;
  onSelectAll: () => void;
  onSelect: (id: string) => void;
  onDeletePage: (id: string) => void | Promise<void>;
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
          onClick={p.onSelectAll}
          title="All Sessions"
          style={{ ...collapseToggle, background: sessionsMode && p.activeId === "acme" ? ACCENT + "1f" : "none" }}
        >
          ≣
        </button>
        <button
          onClick={p.onOpenSessionRecords}
          title="会话记录"
          style={{ ...collapseToggle, background: p.sessionRecordsActive ? ACCENT + "1f" : "none" }}
        >
          💬
        </button>
        {p.pages.map((pg) => (
          <button
            key={pg.id}
            onClick={() => p.onSelect(pg.id)}
            title={pg.name}
            style={{ ...collapsedIconBtn(sessionsMode && p.activeId === pg.id), color: pg.color || "#5a5a5e" }}
          >
            {pg.letter}
          </button>
        ))}
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
        <button onClick={p.onSelectAll} style={navSel(sessionsMode && p.activeId === "acme")}>
          <span style={{ width: 18, textAlign: "center", fontSize: 13 }}>≣</span>
          <span style={{ flex: 1, textAlign: "left" }}>All Sessions</span>
          <span style={{ font: "11px ui-monospace,Menlo,monospace", color: "#a0a0a6" }}>{p.totalCount}</span>
        </button>
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
          const dot = pg.status === "capturing" ? "#30a14e" : "#c4c4c8";
          return (
            <div key={pg.id} style={{ ...rowSel(sel), padding: 0, overflow: "hidden" }}>
              <button onClick={() => p.onSelect(pg.id)} style={itemBtn}>
                <span style={iconStyle(pg.color)}>{pg.letter}</span>
                <span style={{ flex: 1, textAlign: "left", minWidth: 0, overflow: "hidden" }}>
                  <span style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#1d1d1f", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {pg.name}
                  </span>
                  <span style={{ display: "block", fontSize: 11, color: "#9a9aa0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pg.host}</span>
                </span>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    flex: "none",
                    background: dot,
                    animation: pg.status === "capturing" ? "ascPulse 1.6s infinite" : undefined,
                  }}
                />
              </button>
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

// Left sidebar — search, Chat, session records, Pages, Certificates, Settings.
import type { CSSProperties } from "react";
import type { Page } from "../types";
import {
  DEFAULT_PAGE_DISPLAY_NAME,
  isDefaultChatPage,
} from "../lib/ensureDefaultPage";
import { ACCENT, iconStyle } from "../lib/ui";

const listRowStyle = (overflow: "visible" | "hidden"): CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 9,
  width: "100%",
  border: "none",
  borderRadius: 8,
  padding: 0,
  marginBottom: 1,
  overflow,
});
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
  color: "var(--c-text)",
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
  color: "var(--c-text-4)",
  letterSpacing: ".06em",
  textTransform: "uppercase",
};
const addBtn: CSSProperties = {
  appearance: "none",
  border: "none",
  background: "none",
  cursor: "pointer",
  color: "var(--c-text-3)",
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
  color: "var(--c-text-4)",
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
  color: "var(--c-text-4)",
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
    background: sel ? "var(--c-accent-soft)" : "none",
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
    color: enabled ? ACCENT : "var(--c-text-3)",
    background: enabled ? "var(--c-accent-soft)" : "transparent",
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
  navMode: string;
  activeId: string;
  query: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onQuery: (v: string) => void;
  onSelect: (id: string) => void;
  onDeletePage: (id: string) => void | Promise<void>;
  onToggleInterceptReporting: (pageId: string, enabled: boolean) => void | Promise<void>;
  onAddPage: () => void;
  onCerts: () => void;
  onSettings: () => void;
};

function partitionPages(pages: Page[]) {
  const chatPage = pages.find((pg) => isDefaultChatPage(pg.host)) ?? null;
  const otherPages = pages.filter((pg) => !isDefaultChatPage(pg.host));
  return { chatPage, otherPages };
}

export default function Sidebar(p: Props) {
  const sessionsMode = p.navMode === "sessions";
  const { chatPage, otherPages } = partitionPages(p.pages);
  const navSel = (on: boolean): CSSProperties => (on ? { ...navBase, background: "var(--c-accent-soft)" } : navBase);
  const rowSelected = (id: string) => sessionsMode && p.activeId === id;
  const listRowClass = (selected: boolean) =>
    selected ? "asc-sidebar-row asc-sidebar-row--selected" : "asc-sidebar-row";

  if (p.collapsed) {
    return (
      <div
        className="asc-glass-chrome liquid-glass"
        data-asc-region="sidebar"
        data-depth="2"
        style={{
          width: 40,
          flex: "none",
          background: "var(--c-bg-3)",
          borderRight: "1px solid var(--c-border-2)",
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
        {chatPage && (
          <button
            onClick={() => p.onSelect(chatPage.id)}
            title={DEFAULT_PAGE_DISPLAY_NAME}
            style={{
              ...collapsedIconBtn(rowSelected(chatPage.id)),
              color: chatPage.color || "#5a5a5e",
              position: "relative",
            }}
          >
            C
            {chatPage.status === "capturing" && (
              <span className="asc-page-status asc-page-status--live" aria-hidden />
            )}
          </button>
        )}
        {otherPages.map((pg) => {
          const sel = rowSelected(pg.id);
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
    <div
      className="asc-glass-chrome liquid-glass"
      data-asc-region="sidebar"
      data-depth="2"
      style={{ width: 246, flex: "none", background: "var(--c-bg-3)", borderRight: "1px solid var(--c-border-2)", display: "flex", flexDirection: "column", minHeight: 0 }}
    >
      {/* search + collapse */}
      <div style={{ padding: "10px 11px 6px", display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, background: "var(--c-bg-4)", borderRadius: 7, padding: "5px 9px" }}>
          <span style={{ color: "var(--c-text-4)", fontSize: 12 }}>⌕</span>
          <input
            value={p.query}
            onChange={(e) => p.onQuery(e.target.value)}
            placeholder="搜索请求 / Host / Path"
            style={{ flex: 1, minWidth: 0, border: "none", background: "none", outline: "none", font: "12px -apple-system,system-ui", color: "var(--c-text)" }}
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
        {chatPage && (
          <div
            className={listRowClass(rowSelected(chatPage.id))}
            style={{ ...listRowStyle("visible"), marginBottom: 4 }}
          >
            <button onClick={() => p.onSelect(chatPage.id)} style={itemBtn}>
              <span style={{ position: "relative", flex: "none", display: "flex" }}>
                <span style={iconStyle(chatPage.color)}>{chatPage.letter}</span>
                {chatPage.status === "capturing" && (
                  <span className="asc-page-status asc-page-status--live" aria-hidden />
                )}
              </span>
              <span style={{ flex: 1, textAlign: "left", minWidth: 0, overflow: "hidden" }}>
                <span
                  style={{
                    display: "block",
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "var(--c-text)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {DEFAULT_PAGE_DISPLAY_NAME}
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: 11,
                    color: "var(--c-text-4)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {chatPage.host}
                </span>
              </span>
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                p.onDeletePage(chatPage.id);
              }}
              title="Delete Page"
              aria-label={`Delete ${DEFAULT_PAGE_DISPLAY_NAME}`}
              className="asc-sidebar-row__delete"
              style={deleteBtn}
            >
              ×
            </button>
          </div>
        )}

        <div style={sectionHeader}>
          <span style={sectionLabel}>Pages</span>
          <button onClick={p.onAddPage} title="Add Page" style={addBtn}>
            +
          </button>
        </div>
        {otherPages.map((pg) => {
          const sel = rowSelected(pg.id);
          const isCapturing = pg.status === "capturing";
          const reportingOn = pg.interceptReportingEnabled;
          return (
            <div
              key={pg.id}
              className={listRowClass(sel)}
              style={listRowStyle("visible")}
            >
              <button onClick={() => p.onSelect(pg.id)} style={itemBtn}>
                <span style={{ position: "relative", flex: "none", display: "flex" }}>
                  <span style={iconStyle(pg.color)}>{pg.letter}</span>
                  {isCapturing && (
                    <span className="asc-page-status asc-page-status--live" aria-hidden />
                  )}
                </span>
                <span style={{ flex: 1, textAlign: "left", minWidth: 0, overflow: "hidden" }}>
                  <span style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "var(--c-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {pg.name}
                  </span>
                  <span style={{ display: "block", fontSize: 11, color: "var(--c-text-4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pg.host}</span>
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
                className="asc-sidebar-row__delete"
                style={deleteBtn}
              >
                ×
              </button>
            </div>
          );
        })}

      </div>

      {/* footer nav */}
      <div style={{ borderTop: "1px solid var(--c-border-2)", padding: 8, display: "flex", flexDirection: "column", gap: 2 }}>
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

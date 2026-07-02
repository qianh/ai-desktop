// Left sidebar — search, App Chat, Records, Pages, Settings.
import { forwardRef, useState, type CSSProperties } from "react";
import { APP_SIDEBAR_ICON_RAIL_W } from "../lib/chromeLayout";
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
const pageRowStyle: CSSProperties = {
  ...listRowStyle("visible"),
  gap: 4,
};
const pageItemBtn: CSSProperties = {
  ...itemBtn,
  padding: "6px 0",
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
function collapsedPageBtn(sel: boolean): CSSProperties {
  return {
    appearance: "none",
    border: "none",
    background: sel ? "var(--c-accent-soft)" : "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    borderRadius: 7,
    padding: 0,
    position: "relative",
  };
}

function faviconSrc(host?: string): string | null {
  if (!host) return null;
  try {
    const { origin } = new URL(host);
    return `${origin}/favicon.ico`;
  } catch {
    return null;
  }
}

function PageIcon({
  letter,
  color,
  capturing,
  host,
}: {
  letter: string;
  color: string;
  capturing?: boolean;
  host?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const src = faviconSrc(host);

  return (
    <span style={{ position: "relative", flex: "none", width: 24, height: 24 }}>
      <span style={{ ...iconStyle(color), opacity: loaded ? 0 : 1 }}>{letter}</span>
      {src && (
        <img
          src={src}
          width={16}
          height={16}
          alt=""
          style={{ position: "absolute", top: 4, left: 4, borderRadius: 3, opacity: loaded ? 1 : 0 }}
          onLoad={() => setLoaded(true)}
        />
      )}
      {capturing && <span className="asc-page-status asc-page-status--live" aria-hidden />}
    </span>
  );
}

function reportingTip(enabled: boolean): string {
  return enabled ? "拦截与上报：已开启" : "拦截与上报：已关闭";
}

function SettingsIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

type ReportingToggleProps = {
  pageId: string;
  enabled: boolean;
  onToggle: (pageId: string, enabled: boolean) => void | Promise<void>;
};

function ReportingToggle({ pageId, enabled, onToggle }: ReportingToggleProps) {
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
    flex: "none",
    width: 22,
    height: 22,
    borderRadius: 6,
    fontSize: 13,
    position: "relative",
    zIndex: 2,
    transition: "background 0.12s ease, color 0.12s ease",
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
  sidebarWidthPx: number;
  onToggleCollapse: () => void;
  onQuery: (v: string) => void;
  onSelect: (id: string) => void;
  onDeletePage: (id: string) => void | Promise<void>;
  onToggleInterceptReporting: (pageId: string, enabled: boolean) => void | Promise<void>;
  onAddPage: () => void;
  onSettings: () => void;
  onOpenAppChat: () => void;
  onOpenRecords: () => void;
  appChatActive: boolean;
  recordsActive: boolean;
};

function sidebarPages(pages: Page[]): Page[] {
  const chatPage = pages.find((pg) => isDefaultChatPage(pg.host)) ?? null;
  const otherPages = pages.filter((pg) => !isDefaultChatPage(pg.host));
  return chatPage ? [chatPage, ...otherPages] : otherPages;
}

function pageDisplayName(pg: Page): string {
  return isDefaultChatPage(pg.host) ? DEFAULT_PAGE_DISPLAY_NAME : pg.name;
}

const Sidebar = forwardRef<HTMLDivElement, Props>(function Sidebar(p, ref) {
  const sessionsMode = p.navMode === "sessions";
  const pages = sidebarPages(p.pages);
  const navSel = (on: boolean): CSSProperties => (on ? { ...navBase, background: "var(--c-accent-soft)" } : navBase);
  const rowSelected = (id: string) => sessionsMode && p.activeId === id;
  const listRowClass = (selected: boolean) =>
    selected ? "asc-sidebar-row asc-sidebar-row--selected" : "asc-sidebar-row";

  if (p.collapsed) {
    return (
      <div
        ref={ref}
        className="asc-glass-chrome liquid-glass"
        data-asc-region="sidebar"
        data-depth="2"
        style={{
          width: APP_SIDEBAR_ICON_RAIL_W,
          flex: "none",
          alignSelf: "stretch",
          height: "100%",
          position: "relative",
          zIndex: 4,
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
        {pages.map((pg) => {
          const sel = rowSelected(pg.id);
          const isCapturing = pg.status === "capturing";
          return (
            <button
              key={pg.id}
              onClick={() => p.onSelect(pg.id)}
              title={pageDisplayName(pg)}
              style={collapsedPageBtn(sel)}
            >
              <PageIcon letter={pg.letter} color={pg.color} capturing={isCapturing} host={pg.host} />
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <button onClick={p.onSettings} title="Settings" style={{ ...collapseToggle, marginBottom: 8 }}>
          <SettingsIcon size={18} />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="asc-glass-chrome liquid-glass"
      data-asc-region="sidebar"
      data-depth="2"
      style={{ width: p.sidebarWidthPx, flex: "none", alignSelf: "stretch", position: "relative", zIndex: 4, background: "var(--c-bg-3)", borderRight: "1px solid var(--c-border-2)", display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}
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
        <button
          onClick={p.onOpenAppChat}
          style={navSel(p.appChatActive)}
          title="Built-in App Chat"
        >
          <span style={{ fontSize: 14 }}>💬</span>
          <span>App Chat</span>
        </button>

        <button
          onClick={p.onOpenRecords}
          style={navSel(p.recordsActive)}
          title="Session records"
        >
          <span style={{ fontSize: 14 }}>📋</span>
          <span>Records</span>
        </button>

        <div style={sectionHeader}>
          <span style={sectionLabel}>Pages</span>
          <button onClick={p.onAddPage} title="Add Page" style={addBtn}>
            +
          </button>
        </div>
        {pages.map((pg) => {
          const sel = rowSelected(pg.id);
          const isCapturing = pg.status === "capturing";
          const reportingOn = pg.interceptReportingEnabled || isDefaultChatPage(pg.host);
          const label = pageDisplayName(pg);
          return (
            <div
              key={pg.id}
              className={listRowClass(sel)}
              style={pageRowStyle}
            >
              <ReportingToggle
                pageId={pg.id}
                enabled={reportingOn}
                onToggle={p.onToggleInterceptReporting}
              />
              <button onClick={() => p.onSelect(pg.id)} style={pageItemBtn}>
                <PageIcon letter={pg.letter} color={pg.color} capturing={isCapturing} host={pg.host} />
                <span style={{ flex: 1, textAlign: "left", minWidth: 0, overflow: "hidden" }}>
                  <span style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "var(--c-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {label}
                  </span>
                  <span style={{ display: "block", fontSize: 11, color: "var(--c-text-4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pg.host}</span>
                </span>
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  p.onDeletePage(pg.id);
                }}
                title="Delete Page"
                aria-label={`Delete ${label}`}
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
        <button onClick={p.onSettings} style={navSel(p.navMode === "settings")}>
          <span style={{ width: 24, flex: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <SettingsIcon size={18} />
          </span>
          <span style={{ flex: 1, textAlign: "left" }}>Settings</span>
        </button>
      </div>
    </div>
  );
});

export default Sidebar;

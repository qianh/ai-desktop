import type { CSSProperties, ReactNode } from "react";
import type { SidePaneTab } from "../lib/shellLayout";
import { segStyle } from "../lib/ui";

const TABS: { id: SidePaneTab; label: string }[] = [
  { id: "flows", label: "Flows" },
  { id: "intercepts", label: "Intercepts" },
  { id: "devtools", label: "DevTools" },
];

type Props = {
  widthPx: number;
  tab: SidePaneTab;
  onTab: (tab: SidePaneTab) => void;
  flows: ReactNode;
  intercepts: ReactNode;
  devtools: ReactNode;
};

export default function SidePane({ widthPx, tab, onTab, flows, intercepts, devtools }: Props) {
  const body = tab === "flows" ? flows : tab === "intercepts" ? intercepts : devtools;

  return (
    <aside
      className="asc-side-pane asc-glass-chrome"
      data-asc-region="side-pane"
      style={{ ...paneStyle, width: widthPx }}
    >
      <div className="asc-segment-track" style={tabBarStyle}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              className={active ? "asc-segment-btn--on" : undefined}
              onClick={() => onTab(t.id)}
              style={segStyle(active)}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div style={bodyStyle}>{body}</div>
    </aside>
  );
}

const paneStyle: CSSProperties = {
  flex: "none",
  alignSelf: "stretch",
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  borderLeft: "1px solid var(--c-border-2)",
  background: "var(--c-bg-2)",
};

const tabBarStyle: CSSProperties = {
  display: "flex",
  gap: 4,
  padding: "8px 10px",
  borderBottom: "1px solid var(--c-border-2)",
  flex: "none",
};

const bodyStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: "auto",
  display: "flex",
  flexDirection: "column",
};
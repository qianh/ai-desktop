// macOS window title bar with traffic lights + A/B layout toggle.
import { APP_TITLE_BAR_H } from "../lib/chromeLayout";
import { segStyle } from "../lib/ui";

const iconSegStyle = (active: boolean) => ({
  ...segStyle(active),
  border: "0.5px solid var(--c-border-3)",
  display: "flex" as const,
  alignItems: "center" as const,
  gap: 4,
});

export default function TitleBar({
  titleSuffix,
  variant,
  onVariant,
  inspectorOpen,
  onToggleInspector,
  onOpenSessionRecords,
  sessionRecordsActive,
}: {
  titleSuffix: string;
  variant: "A" | "B";
  onVariant: (v: "A" | "B") => void;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  onOpenSessionRecords: () => void;
  sessionRecordsActive: boolean;
}) {
  return (
    <div
      className="asc-titlebar asc-glass-chrome liquid-glass"
      data-asc-region="titlebar"
      data-depth="1"
      style={{
        height: APP_TITLE_BAR_H,
        flex: "none",
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "0 14px",
        background: "var(--c-titlebar-bg)",
        borderBottom: "1px solid var(--c-titlebar-border)",
      }}
    >
      <div
        data-tauri-drag-region
        style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text)" }}>AppScope</span>
        <span style={{ fontSize: 12.5, color: "var(--c-text-4)" }}>— {titleSuffix}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={onOpenSessionRecords}
          title="会话记录"
          style={iconSegStyle(sessionRecordsActive)}
        >
          💬 会话记录
        </button>
        <span style={{ fontSize: 11, color: "var(--c-text-4)" }}>布局</span>
        <div className="asc-segment-track" style={{ display: "flex", background: "var(--c-border-2)", borderRadius: 7, padding: 2, gap: 2 }}>
          <button
            className={variant === "A" ? "asc-segment-btn--on" : undefined}
            onClick={() => onVariant("A")}
            style={segStyle(variant === "A")}
          >
            A · 检查器
          </button>
          <button
            className={variant === "B" ? "asc-segment-btn--on" : undefined}
            onClick={() => onVariant("B")}
            style={segStyle(variant === "B")}
          >
            B · DevTools
          </button>
        </div>
        <button
          onClick={onToggleInspector}
          title={inspectorOpen ? "收起右侧面板" : "展开右侧面板"}
          style={iconSegStyle(inspectorOpen)}
        >
          {inspectorOpen ? "▶" : "◀"}
        </button>
      </div>
    </div>
  );
}

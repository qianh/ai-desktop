// macOS window title bar with traffic lights + A/B layout toggle.
import { segStyle } from "../lib/ui";

export default function TitleBar({
  titleSuffix,
  variant,
  onVariant,
}: {
  titleSuffix: string;
  variant: "A" | "B";
  onVariant: (v: "A" | "B") => void;
}) {
  return (
    <div
      style={{
        height: 39,
        flex: "none",
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "0 14px",
        background: "linear-gradient(180deg,#ededef,#e3e3e7)",
        borderBottom: "1px solid #cccdd2",
      }}
    >
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#3a3a3e" }}>AppScope</span>
        <span style={{ fontSize: 12.5, color: "#9a9aa0" }}>— {titleSuffix}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, color: "#9a9aa0" }}>布局</span>
        <div style={{ display: "flex", background: "#d9d9de", borderRadius: 7, padding: 2, gap: 2 }}>
          <button onClick={() => onVariant("A")} style={segStyle(variant === "A")}>
            A · 检查器
          </button>
          <button onClick={() => onVariant("B")} style={segStyle(variant === "B")}>
            B · DevTools
          </button>
        </div>
      </div>
    </div>
  );
}

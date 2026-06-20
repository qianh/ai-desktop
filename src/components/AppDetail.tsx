// App detail view — shown when an Apps row is selected. Pick a launch mode.
import type { CSSProperties } from "react";
import type { AppEntry } from "../types";
import { ACCENT, MONO, primaryBtn } from "../lib/ui";

type Mode = { key: string; label: string; desc: string; soon: boolean };
const MODES: Mode[] = [
  { key: "normal", label: "Normal", desc: "仅作为启动器，不注入代理", soon: false },
  { key: "system", label: "System Proxy Capture", desc: "设置系统代理后启动，抓取遵循系统代理的应用", soon: false },
  { key: "transparent", label: "Transparent Capture", desc: "Network Extension 按 App 透明抓包", soon: true },
];

export default function AppDetail({
  app,
  launchMode,
  onLaunchMode,
  onLaunch,
}: {
  app: AppEntry;
  launchMode: string;
  onLaunchMode: (k: string) => void;
  onLaunch?: () => void | Promise<void>;
}) {
  return (
    <div style={{ flex: 1, overflow: "auto", minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 36 }}>
      <div style={{ maxWidth: 440, width: "100%", textAlign: "center" }}>
        <div
          style={{
            width: 78,
            height: 78,
            borderRadius: 18,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 34,
            fontWeight: 700,
            color: "#fff",
            background: app.color,
          }}
        >
          {app.letter}
        </div>
        <div style={{ fontSize: 19, fontWeight: 600, color: "#1d1d1f", marginTop: 16 }}>{app.name}</div>
        <div style={{ fontSize: 12.5, color: "#9a9aa0", marginTop: 3, fontFamily: MONO }}>{app.bundle}</div>
        <div style={{ fontSize: 11, color: "#a0a0a6", marginTop: 2 }}>{app.path}</div>
        <div style={{ margin: "26px 0 8px", fontSize: 11, fontWeight: 700, color: "#9a9aa0", letterSpacing: ".05em", textTransform: "uppercase" }}>
          启动模式
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, textAlign: "left" }}>
          {MODES.map((m) => {
            const sel = launchMode === m.key;
            const rowStyle: CSSProperties = {
              display: "flex",
              alignItems: "center",
              gap: 11,
              width: "100%",
              textAlign: "left",
              border: "1px solid " + (sel ? ACCENT : "#e6e6ea"),
              background: sel ? ACCENT + "10" : "#fff",
              borderRadius: 10,
              padding: "11px 13px",
              cursor: m.soon ? "default" : "pointer",
              opacity: m.soon ? 0.55 : 1,
            };
            return (
              <button key={m.key} onClick={m.soon ? undefined : () => onLaunchMode(m.key)} style={rowStyle}>
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    flex: "none",
                    border: sel ? "5px solid " + ACCENT : "2px solid #c4c4ca",
                  }}
                />
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#1d1d1f" }}>{m.label}</span>
                  <span style={{ display: "block", fontSize: 11.5, color: "#9a9aa0", marginTop: 1 }}>{m.desc}</span>
                </span>
                {m.soon && (
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#8a8a8e", background: "#eee", borderRadius: 5, padding: "2px 7px" }}>
                    Coming Soon
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => void onLaunch?.()}
          style={{ ...primaryBtn, width: "100%", marginTop: 18, padding: 11, fontSize: 14 }}
        >
          打开 {app.name}
        </button>
      </div>
    </div>
  );
}

// Settings view (§14 of the spec). Toggle state lives in App.
import { useState } from "react";
import { segStyle, type ThemeMode } from "../lib/ui";
import {
  loadSupabaseConfig,
  saveSupabaseConfig,
  type SupabaseConfig,
} from "../lib/supabase";

export type { ThemeMode };
export type Toggles = { mask: boolean; quic: boolean; login: boolean; autoclean: boolean };

export { loadSupabaseConfig, saveSupabaseConfig, type SupabaseConfig };

type Row =
  | { kind: "toggle"; label: string; desc?: string; key: keyof Toggles }
  | { kind: "value"; label: string; desc?: string; value: string }
  | { kind: "theme-segment"; label: string };

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "light",  label: "Light"  },
  { value: "dark",   label: "Dark"   },
  { value: "system", label: "System" },
];

const SECTIONS: { title: string; rows: Row[] }[] = [
  {
    title: "General",
    rows: [
      { kind: "theme-segment", label: "外观" },
      { kind: "toggle", label: "开机自启动", key: "login" },
    ],
  },
  {
    title: "Proxy",
    rows: [
      { kind: "value", label: "代理端口", desc: "本地 MITM 代理监听端口", value: "Per session" },
      { kind: "toggle", label: "禁用 QUIC", desc: "启动 Chrome 时附加 --disable-quic", key: "quic" },
    ],
  },
  {
    title: "Capture",
    rows: [
      { kind: "toggle", label: "脱敏敏感字段", desc: "Authorization / Cookie / token 默认隐藏", key: "mask" },
      { kind: "value", label: "Body 上限", desc: "超过则只保留元数据", value: "10 MB" },
    ],
  },
  {
    title: "Data",
    rows: [
      { kind: "value", label: "保留策略", value: "最近 7 天" },
      { kind: "toggle", label: "超过 10 GB 自动清理", key: "autoclean" },
    ],
  },
];

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 38,
        height: 22,
        borderRadius: 11,
        border: "none",
        cursor: "pointer",
        position: "relative",
        background: on ? "var(--c-accent)" : "var(--c-switch-off)",
        flex: "none",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: on ? 18 : 2,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,.25)",
        }}
      />
    </button>
  );
}

function ThemeSegment({ value, onChange }: { value: ThemeMode; onChange: (t: ThemeMode) => void }) {
  return (
    <div style={{ display: "flex", background: "var(--c-bg-3)", borderRadius: 8, padding: 3, gap: 2 }}>
      {THEME_OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              ...segStyle(active),
              border: active ? "1px solid var(--c-border)" : "1px solid transparent",
              transition: "all 0.12s ease",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default function Settings({
  toggles,
  onToggle,
  theme,
  onTheme,
}: {
  toggles: Toggles;
  onToggle: (k: keyof Toggles) => void;
  theme: ThemeMode;
  onTheme: (t: ThemeMode) => void;
}) {
  const [sbConfig, setSbConfig] = useState<SupabaseConfig>(loadSupabaseConfig);

  const updateSupabase = (field: keyof SupabaseConfig, value: string) => {
    const next = { ...sbConfig, [field]: value };
    setSbConfig(next);
    saveSupabaseConfig(next);
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    font: "12px ui-monospace,Menlo,monospace",
    color: "var(--c-text)",
    background: "var(--c-bg-2)",
    border: "1px solid var(--c-border)",
    borderRadius: 6,
    padding: "6px 9px",
    outline: "none",
  };

  const renderControl = (r: Row) => {
    if (r.kind === "theme-segment") return <ThemeSegment value={theme} onChange={onTheme} />;
    if (r.kind === "toggle") return <Switch on={toggles[r.key]} onClick={() => onToggle(r.key)} />;
    return (
      <span style={{ font: "12px ui-monospace,Menlo,monospace", color: "var(--c-text-2)", background: "var(--c-bg-3)", borderRadius: 6, padding: "4px 9px" }}>
        {r.value}
      </span>
    );
  };

  return (
    <div style={{ flex: 1, overflow: "auto", minHeight: 0, padding: "28px 36px", background: "var(--c-bg)" }}>
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <h1 style={{ fontSize: 21, fontWeight: 600, margin: "0 0 22px", color: "var(--c-text)" }}>Settings</h1>

        {SECTIONS.map((sec) => (
          <div key={sec.title} style={{ marginBottom: 26 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--c-text-4)", letterSpacing: ".05em", textTransform: "uppercase", marginBottom: 8 }}>
              {sec.title}
            </div>
            <div style={{ border: "1px solid var(--c-border)", borderRadius: 11, overflow: "hidden" }}>
              {sec.rows.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 15px", borderBottom: "1px solid var(--c-divider)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "var(--c-text)" }}>{r.label}</div>
                    {"desc" in r && r.desc && <div style={{ fontSize: 11.5, color: "var(--c-text-4)", marginTop: 1 }}>{r.desc}</div>}
                  </div>
                  {renderControl(r)}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div style={{ marginBottom: 26 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--c-text-4)", letterSpacing: ".05em", textTransform: "uppercase", marginBottom: 8 }}>
            Cloud Sync (Supabase)
          </div>
          <div style={{ border: "1px solid var(--c-border)", borderRadius: 11, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 15px", borderBottom: "1px solid var(--c-divider)" }}>
              <div style={{ minWidth: 80 }}>
                <div style={{ fontSize: 13, color: "var(--c-text)" }}>URL</div>
              </div>
              <input type="text" placeholder="https://xxx.supabase.co" value={sbConfig.url} onChange={(e) => updateSupabase("url", e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 15px", borderBottom: "1px solid var(--c-divider)" }}>
              <div style={{ minWidth: 80 }}>
                <div style={{ fontSize: 13, color: "var(--c-text)" }}>API Key</div>
              </div>
              <input type="password" placeholder="eyJ..." value={sbConfig.key} onChange={(e) => updateSupabase("key", e.target.value)} style={inputStyle} />
            </div>
            <div style={{ padding: "8px 15px", fontSize: 11, color: "var(--c-text-4)" }}>
              {sbConfig.url && sbConfig.key ? "✓ 已配置 — 拦截数据将自动上传" : "未配置 — 拦截数据仅本地展示"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

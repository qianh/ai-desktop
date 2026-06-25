// Settings view (§14 of the spec). Toggle state lives in App.
import { useState, type KeyboardEvent } from "react";
import type { GlassIntensity, StylePreset, StylePreviewPalette, ThemeMode } from "../lib/appearance";
import { STYLE_PRESETS } from "../lib/appearance";
import { segStyle } from "../lib/ui";
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
  | { kind: "theme-segment"; label: string; desc?: string }
  | { kind: "glass-segment"; label: string; desc?: string }
  | { kind: "style-picker"; label: string; desc?: string };

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

const GLASS_OPTIONS: { value: GlassIntensity; label: string }[] = [
  { value: "solid", label: "实色" },
  { value: "soft", label: "柔和" },
  { value: "liquid", label: "液态" },
];

const SECTIONS: { title: string; rows: Row[] }[] = [
  {
    title: "General",
    rows: [
      { kind: "style-picker", label: "风格", desc: "五套视觉方案，各有 Light / Dark 配色" },
      { kind: "theme-segment", label: "明暗", desc: "System 跟随 macOS，作用于当前风格" },
      { kind: "glass-segment", label: "玻璃强度", desc: "仅玻璃液态风格 · solid 强调可读性，liquid 更强折射感" },
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
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.25)",
        }}
      />
    </button>
  );
}

function GlassSegment({ value, onChange }: { value: GlassIntensity; onChange: (g: GlassIntensity) => void }) {
  return (
    <div className="asc-segment-track" style={{ display: "flex", background: "var(--c-bg-3)", borderRadius: 8, padding: 3, gap: 2 }}>
      {GLASS_OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            className={active ? "asc-segment-btn--on" : undefined}
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

function ThemeSegment({ value, onChange }: { value: ThemeMode; onChange: (t: ThemeMode) => void }) {
  return (
    <div className="asc-segment-track" style={{ display: "flex", background: "var(--c-bg-3)", borderRadius: 8, padding: 3, gap: 2 }}>
      {THEME_OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            className={active ? "asc-segment-btn--on" : undefined}
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

function StylePreviewHalf({ palette, label }: { palette: StylePreviewPalette; label: string }) {
  return (
    <div className="asc-style-card__half" style={{ background: palette.bg }} aria-hidden>
      <div className="asc-style-card__chrome">
        <span className="asc-style-card__dot" style={{ background: palette.line }} />
        <span className="asc-style-card__dot" style={{ background: palette.line }} />
        <span className="asc-style-card__dot" style={{ background: palette.line }} />
      </div>
      <div className="asc-style-card__layout">
        <div
          className="asc-style-card__sidebar"
          style={{ background: palette.surface, borderRight: `1px solid ${palette.border}` }}
        />
        <div className="asc-style-card__main">
          <div className="asc-style-card__accent" style={{ background: palette.accent }} />
          <div className="asc-style-card__line" style={{ background: palette.line, width: "78%" }} />
          <div className="asc-style-card__line" style={{ background: palette.line, width: "52%", opacity: 0.65 }} />
        </div>
      </div>
      <span className="asc-style-card__mode" style={{ alignSelf: "flex-start", background: palette.surface, color: palette.accent }}>
        {label}
      </span>
    </div>
  );
}

const STYLE_PICKER_COLS = 2;

function StylePresetPicker({
  value,
  onChange,
}: {
  value: StylePreset;
  onChange: (s: StylePreset) => void;
}) {
  const presetIds = STYLE_PRESETS.map((p) => p.id);

  const focusPresetAt = (index: number) => {
    const id = presetIds[index];
    if (!id) return;
    document.getElementById(`style-preset-${id}`)?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = presetIds.length - 1;
    let next = index;

    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        next = index < last ? index + 1 : 0;
        break;
      case "ArrowLeft":
        e.preventDefault();
        next = index > 0 ? index - 1 : last;
        break;
      case "ArrowDown":
        e.preventDefault();
        next = index + STYLE_PICKER_COLS <= last ? index + STYLE_PICKER_COLS : index;
        break;
      case "ArrowUp":
        e.preventDefault();
        next = index - STYLE_PICKER_COLS >= 0 ? index - STYLE_PICKER_COLS : index;
        break;
      case " ":
      case "Enter":
        e.preventDefault();
        onChange(presetIds[index]);
        return;
      default:
        return;
    }

    focusPresetAt(next);
  };

  return (
    <div className="asc-style-picker" role="radiogroup" aria-label="风格预设">
      {STYLE_PRESETS.map((preset, index) => {
        const active = value === preset.id;
        return (
          <button
            key={preset.id}
            id={`style-preset-${preset.id}`}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            className={`asc-style-card${active ? " asc-style-card--active" : ""}`}
            onClick={() => onChange(preset.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
          >
            <div className="asc-style-card__preview">
              <StylePreviewHalf palette={preset.light} label="Light" />
              <StylePreviewHalf palette={preset.dark} label="Dark" />
              <span className="asc-style-card__badge" aria-hidden>
                ✓
              </span>
            </div>
            <div className="asc-style-card__body">
              <div className="asc-style-card__label asc-display-font">{preset.label}</div>
              <div className="asc-style-card__desc">{preset.desc}</div>
            </div>
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
  stylePreset,
  onStylePreset,
  glassIntensity,
  onGlassIntensity,
}: {
  toggles: Toggles;
  onToggle: (k: keyof Toggles) => void;
  theme: ThemeMode;
  onTheme: (t: ThemeMode) => void;
  stylePreset: StylePreset;
  onStylePreset: (s: StylePreset) => void;
  glassIntensity: GlassIntensity;
  onGlassIntensity: (g: GlassIntensity) => void;
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
    if (r.kind === "style-picker") {
      return <StylePresetPicker value={stylePreset} onChange={onStylePreset} />;
    }
    if (r.kind === "theme-segment") return <ThemeSegment value={theme} onChange={onTheme} />;
    if (r.kind === "glass-segment") return <GlassSegment value={glassIntensity} onChange={onGlassIntensity} />;
    if (r.kind === "toggle") return <Switch on={toggles[r.key]} onClick={() => onToggle(r.key)} />;
    return (
      <span
        style={{
          font: "12px ui-monospace,Menlo,monospace",
          color: "var(--c-text-2)",
          background: "var(--c-bg-3)",
          borderRadius: 6,
          padding: "4px 9px",
        }}
      >
        {r.value}
      </span>
    );
  };

  const isWideRow = (r: Row) => r.kind === "style-picker";

  return (
    <div style={{ flex: 1, overflow: "auto", minHeight: 0, padding: "28px 36px", background: "var(--c-bg)" }}>
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <h1
          className="asc-display-font"
          style={{ fontSize: 21, fontWeight: 600, margin: "0 0 22px", color: "var(--c-text)" }}
        >
          Settings
        </h1>

        {SECTIONS.map((sec) => (
          <div key={sec.title} style={{ marginBottom: 26 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--c-text-4)",
                letterSpacing: ".05em",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              {sec.title}
            </div>
            <div
              className="asc-settings-section"
              style={{
                border: "1px solid var(--c-border)",
                borderRadius: "var(--c-radius-lg, 11px)",
                overflow: "hidden",
                boxShadow: "var(--c-elevate, none)",
              }}
            >
              {sec.rows
                .filter((r) => r.kind !== "glass-segment" || stylePreset === "glass")
                .map((r, i, rows) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexDirection: isWideRow(r) ? "column" : "row",
                    alignItems: isWideRow(r) ? "stretch" : "center",
                    gap: isWideRow(r) ? 10 : 12,
                    padding: isWideRow(r) ? "16px 16px 18px" : "12px 15px",
                    borderBottom: i < rows.length - 1 ? "1px solid var(--c-divider)" : undefined,
                  }}
                >
                  <div style={{ flex: isWideRow(r) ? undefined : 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "var(--c-text)" }}>{r.label}</div>
                    {"desc" in r && r.desc && (
                      <div style={{ fontSize: 11.5, color: "var(--c-text-4)", marginTop: 1 }}>{r.desc}</div>
                    )}
                  </div>
                  {renderControl(r)}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div style={{ marginBottom: 26 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--c-text-4)",
              letterSpacing: ".05em",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Cloud Sync (Supabase)
          </div>
          <div
            className="asc-settings-section"
            style={{
              border: "1px solid var(--c-border)",
              borderRadius: "var(--c-radius-lg, 11px)",
              overflow: "hidden",
              boxShadow: "var(--c-elevate, none)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 15px",
                borderBottom: "1px solid var(--c-divider)",
              }}
            >
              <div style={{ minWidth: 80 }}>
                <div style={{ fontSize: 13, color: "var(--c-text)" }}>URL</div>
              </div>
              <input
                type="text"
                placeholder="https://xxx.supabase.co"
                value={sbConfig.url}
                onChange={(e) => updateSupabase("url", e.target.value)}
                style={inputStyle}
              />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 15px",
                borderBottom: "1px solid var(--c-divider)",
              }}
            >
              <div style={{ minWidth: 80 }}>
                <div style={{ fontSize: 13, color: "var(--c-text)" }}>API Key</div>
              </div>
              <input
                type="password"
                placeholder="eyJ..."
                value={sbConfig.key}
                onChange={(e) => updateSupabase("key", e.target.value)}
                style={inputStyle}
              />
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
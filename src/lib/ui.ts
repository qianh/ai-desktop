// Shared style atoms, ported from the inline styles in AppScope.dc.html.
import type { CSSProperties } from "react";

export const ACCENT = "var(--c-accent)";

export const FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text',system-ui,sans-serif";
export const MONO = "ui-monospace,'SF Mono',Menlo,monospace";

export const primaryBtn: CSSProperties = {
  appearance: "none",
  border: "none",
  cursor: "pointer",
  font: "13px -apple-system,system-ui",
  fontWeight: 500,
  color: "#fff",
  background: ACCENT,
  borderRadius: "var(--c-radius, 8px)",
  padding: "8px 16px",
  boxShadow: "var(--c-elevate, none)",
};

export const secondaryBtn: CSSProperties = {
  appearance: "none",
  cursor: "pointer",
  font: "13px -apple-system,system-ui",
  fontWeight: 500,
  color: "var(--c-text)",
  background: "var(--c-bg)",
  border: "1px solid var(--c-border-2)",
  borderRadius: "var(--c-radius, 8px)",
  padding: "8px 15px",
  boxShadow: "var(--c-elevate, none)",
};

export const dangerBtn: CSSProperties = {
  appearance: "none",
  cursor: "pointer",
  font: "13px -apple-system,system-ui",
  fontWeight: 500,
  color: "#c0392b",
  background: "var(--c-bg)",
  border: "1px solid #ecc",
  borderRadius: 8,
  padding: "8px 15px",
};

/** Square gradient-free letter icon */
export function iconStyle(color: string): CSSProperties {
  return {
    width: 24,
    height: 24,
    borderRadius: 6,
    flex: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 700,
    color: "#fff",
    background: color,
  };
}

export type { StylePreset, ThemeMode } from "./appearance";
export { STYLE_PRESETS } from "./appearance";

/** macOS-style segmented control button */
export function segStyle(on: boolean): CSSProperties {
  return {
    appearance: "none",
    border: "none",
    cursor: "pointer",
    font: "11.5px -apple-system,system-ui",
    fontWeight: on ? 600 : 500,
    padding: "4px 11px",
    borderRadius: 5,
    color: on ? "var(--c-text)" : "var(--c-text-3)",
    background: on ? "var(--c-bg)" : "transparent",
    boxShadow: on ? "0 1px 2px rgba(0,0,0,.12)" : undefined,
  };
}

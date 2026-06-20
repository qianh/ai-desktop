// Shared style atoms, ported from the inline styles in AppScope.dc.html.
import type { CSSProperties } from "react";

export const ACCENT = "#007aff";

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
  borderRadius: 8,
  padding: "8px 16px",
};

export const secondaryBtn: CSSProperties = {
  appearance: "none",
  cursor: "pointer",
  font: "13px -apple-system,system-ui",
  fontWeight: 500,
  color: "#1d1d1f",
  background: "#fff",
  border: "1px solid #d8d8dc",
  borderRadius: 8,
  padding: "8px 15px",
};

export const dangerBtn: CSSProperties = {
  appearance: "none",
  cursor: "pointer",
  font: "13px -apple-system,system-ui",
  fontWeight: 500,
  color: "#c0392b",
  background: "#fff",
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
    color: on ? "#1d1d1f" : "#7a7a80",
    background: on ? "#fff" : "transparent",
    boxShadow: on ? "0 1px 2px rgba(0,0,0,.12)" : undefined,
  };
}

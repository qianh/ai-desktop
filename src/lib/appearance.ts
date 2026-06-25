export type StylePreset = "classic" | "minimal" | "editorial" | "obsidian" | "glass";
export type ThemeMode = "light" | "dark" | "system";
export type GlassIntensity = "solid" | "soft" | "liquid";

export const STYLE_STORAGE_KEY = "appscope-style";
export const THEME_STORAGE_KEY = "theme";
export const GLASS_STORAGE_KEY = "appscope-glass";

export type StylePreviewPalette = {
  bg: string;
  surface: string;
  accent: string;
  border: string;
  line: string;
};

export type StylePresetMeta = {
  id: StylePreset;
  label: string;
  desc: string;
  light: StylePreviewPalette;
  dark: StylePreviewPalette;
};

export const STYLE_PRESETS: StylePresetMeta[] = [
  {
    id: "classic",
    label: "经典",
    desc: "Apple 系统蓝，稳重均衡",
    light: { bg: "#ffffff", surface: "#f3f3f5", accent: "#007aff", border: "#e6e6ea", line: "#d8d8dc" },
    dark: { bg: "#1c1c1e", surface: "#3a3a3c", accent: "#0a84ff", border: "#3a3a3c", line: "#48484a" },
  },
  {
    id: "minimal",
    label: "极简",
    desc: "大留白、轻边框、克制色彩",
    light: { bg: "#ffffff", surface: "#f5f5f8", accent: "#0066cc", border: "#efeff2", line: "#e8e8ec" },
    dark: { bg: "#141416", surface: "#26262a", accent: "#5eb0ff", border: "#2a2a2e", line: "#36363c" },
  },
  {
    id: "editorial",
    label: "墨编",
    desc: "衬线标题、暖灰色调",
    light: { bg: "#faf8f5", surface: "#ebe6df", accent: "#8b5e3c", border: "#e6e0d8", line: "#dcd4ca" },
    dark: { bg: "#1a1714", surface: "#302a22", accent: "#c9a87c", border: "#342e28", line: "#443c34" },
  },
  {
    id: "obsidian",
    label: "曜石",
    desc: "低饱和、微光边框",
    light: { bg: "#f8f9fb", surface: "#e8ebf0", accent: "#5c6b7a", border: "#e2e6ec", line: "#d4dae4" },
    dark: { bg: "#0a0a0c", surface: "#1a1a20", accent: "#8fa3b8", border: "#2a2a32", line: "#36363c" },
  },
  {
    id: "glass",
    label: "玻璃液态",
    desc: "Liquid Glass · 模糊折射 · 动态高光",
    light: {
      bg: "rgba(246,247,250,0.72)",
      surface: "rgba(255,255,255,0.34)",
      accent: "#0071e3",
      border: "rgba(255,255,255,0.46)",
      line: "rgba(17,20,28,0.12)",
    },
    dark: {
      bg: "rgba(15,17,22,0.74)",
      surface: "rgba(24,26,34,0.46)",
      accent: "#0a84ff",
      border: "rgba(255,255,255,0.13)",
      line: "rgba(255,255,255,0.1)",
    },
  },
];

/** Single source of truth for valid preset ids — keep index.html boot script in sync. */
export const STYLE_PRESET_IDS: readonly StylePreset[] = STYLE_PRESETS.map((p) => p.id);

const THEME_MODES: readonly ThemeMode[] = ["light", "dark", "system"];
const GLASS_INTENSITIES: readonly GlassIntensity[] = ["solid", "soft", "liquid"];

export function loadStylePreset(): StylePreset {
  const raw = localStorage.getItem(STYLE_STORAGE_KEY);
  if (raw && (STYLE_PRESET_IDS as readonly string[]).includes(raw)) {
    return raw as StylePreset;
  }
  return "classic";
}

export function saveStylePreset(style: StylePreset): void {
  localStorage.setItem(STYLE_STORAGE_KEY, style);
}

export function loadThemeMode(): ThemeMode {
  const raw = localStorage.getItem(THEME_STORAGE_KEY);
  if (raw && (THEME_MODES as readonly string[]).includes(raw)) {
    return raw as ThemeMode;
  }
  return "system";
}

export function saveThemeMode(mode: ThemeMode): void {
  localStorage.setItem(THEME_STORAGE_KEY, mode);
}

export function resolveThemeMode(mode: ThemeMode): "light" | "dark" {
  if (mode === "light") return "light";
  if (mode === "dark") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function loadGlassIntensity(): GlassIntensity {
  const raw = localStorage.getItem(GLASS_STORAGE_KEY);
  if (raw && (GLASS_INTENSITIES as readonly string[]).includes(raw)) {
    return raw as GlassIntensity;
  }
  return "soft";
}

export function saveGlassIntensity(intensity: GlassIntensity): void {
  localStorage.setItem(GLASS_STORAGE_KEY, intensity);
}

export function detectPlatform(): "macos" | "windows" | "linux" | "unknown" {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac")) return "macos";
  if (ua.includes("win")) return "windows";
  if (ua.includes("linux")) return "linux";
  return "unknown";
}

export function autoDowngradeGlass(): GlassIntensity {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const lowMemory = typeof memory === "number" && memory <= 4;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const reducedTransparency = window.matchMedia("(prefers-reduced-transparency: reduce)").matches;

  if (lowMemory || reducedMotion || reducedTransparency) {
    return "solid";
  }
  return loadGlassIntensity();
}

export function applyGlassIntensity(intensity: GlassIntensity): void {
  document.documentElement.setAttribute("data-glass", intensity);
}

export function applyPlatformClass(): void {
  document.documentElement.setAttribute("data-platform", detectPlatform());
}

export function applyAppearance(
  style: StylePreset,
  themeMode: ThemeMode,
  glassIntensity?: GlassIntensity,
): "light" | "dark" {
  const resolved = resolveThemeMode(themeMode);
  const root = document.documentElement;
  root.setAttribute("data-style", style);
  root.setAttribute("data-theme", resolved);
  applyPlatformClass();
  if (style === "glass") {
    applyGlassIntensity(glassIntensity ?? autoDowngradeGlass());
  } else {
    root.removeAttribute("data-glass");
  }
  return resolved;
}
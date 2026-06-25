import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyAppearance,
  applyGlassIntensity,
  loadGlassIntensity,
  loadStylePreset,
  loadThemeMode,
  resolveThemeMode,
  saveGlassIntensity,
  saveStylePreset,
  saveThemeMode,
  STYLE_PRESET_IDS,
  STYLE_STORAGE_KEY,
  GLASS_STORAGE_KEY,
  THEME_STORAGE_KEY,
} from "./appearance";

function createStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    clear: () => store.clear(),
  };
}

function stubMatchMedia(dark: boolean) {
  vi.stubGlobal("window", {
    matchMedia: vi.fn(() => ({
      matches: dark,
      media: "",
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })),
  });
}

describe("appearance", () => {
  let storage: ReturnType<typeof createStorage>;
  let attrs: Record<string, string>;

  beforeEach(() => {
    storage = createStorage();
    attrs = {};
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("document", {
      documentElement: {
        setAttribute: (name: string, value: string) => {
          attrs[name] = value;
        },
        removeAttribute: (name: string) => {
          delete attrs[name];
        },
        getAttribute: (name: string) => attrs[name] ?? null,
      },
    });
    stubMatchMedia(true);
  });

  it("loadStylePreset defaults to classic", () => {
    expect(loadStylePreset()).toBe("classic");
  });

  it("loadStylePreset rejects invalid keys", () => {
    storage.setItem(STYLE_STORAGE_KEY, "neon");
    expect(loadStylePreset()).toBe("classic");
  });

  it("saveStylePreset persists choice", () => {
    saveStylePreset("editorial");
    expect(storage.getItem(STYLE_STORAGE_KEY)).toBe("editorial");
    expect(loadStylePreset()).toBe("editorial");
  });

  it("loadThemeMode defaults to system", () => {
    expect(loadThemeMode()).toBe("system");
  });

  it("loadThemeMode rejects invalid keys", () => {
    storage.setItem(THEME_STORAGE_KEY, "foo");
    expect(loadThemeMode()).toBe("system");
  });

  it("saveThemeMode persists choice", () => {
    saveThemeMode("dark");
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(loadThemeMode()).toBe("dark");
  });

  it("resolveThemeMode maps system via matchMedia (dark)", () => {
    stubMatchMedia(true);
    expect(resolveThemeMode("system")).toBe("dark");
    expect(resolveThemeMode("light")).toBe("light");
    expect(resolveThemeMode("dark")).toBe("dark");
  });

  it("resolveThemeMode maps system via matchMedia (light)", () => {
    stubMatchMedia(false);
    expect(resolveThemeMode("system")).toBe("light");
  });

  it("applyAppearance sets data-style and data-theme", () => {
    const resolved = applyAppearance("obsidian", "dark");
    expect(resolved).toBe("dark");
    expect(attrs["data-style"]).toBe("obsidian");
    expect(attrs["data-theme"]).toBe("dark");
  });

  it("applyAppearance sets data-glass for glass preset", () => {
    saveGlassIntensity("liquid");
    applyAppearance("glass", "light", "liquid");
    expect(attrs["data-style"]).toBe("glass");
    expect(attrs["data-glass"]).toBe("liquid");
  });

  it("loadGlassIntensity defaults to soft", () => {
    expect(loadGlassIntensity()).toBe("soft");
  });

  it("saveGlassIntensity persists choice", () => {
    saveGlassIntensity("solid");
    expect(storage.getItem(GLASS_STORAGE_KEY)).toBe("solid");
    expect(loadGlassIntensity()).toBe("solid");
  });

  it("applyGlassIntensity sets data-glass attribute", () => {
    applyGlassIntensity("liquid");
    expect(attrs["data-glass"]).toBe("liquid");
  });

  it("loadStylePreset accepts glass preset", () => {
    saveStylePreset("glass");
    expect(loadStylePreset()).toBe("glass");
  });

  it("index.html boot script lists all STYLE_PRESET_IDS", () => {
    const html = readFileSync(resolve(process.cwd(), "index.html"), "utf-8");
    for (const id of STYLE_PRESET_IDS) {
      expect(html).toContain(`'${id}'`);
    }
    expect(html).toContain("'light','dark','system'");
  });
});
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Settings from "./Settings";

const certHandlers = {
  state: "NotGenerated",
  onInstall: () => undefined,
  onOpenGuide: () => undefined,
  onGenerate: () => undefined,
  onRemove: () => undefined,
  onRefresh: () => undefined,
};

describe("Settings master-detail layout", () => {
  it("renders left nav sections and default General detail", () => {
    const html = renderToStaticMarkup(
      createElement(Settings, {
        toggles: { mask: true, quic: true, login: false, autoclean: true },
        onToggle: () => undefined,
        theme: "system",
        onTheme: () => undefined,
        stylePreset: "classic",
        onStylePreset: () => undefined,
        glassIntensity: "soft",
        onGlassIntensity: () => undefined,
        cert: certHandlers,
      }),
    );

    expect(html).toContain("General");
    expect(html).toContain("Proxy");
    expect(html).toContain("App Chat");
    expect(html).toContain("Cloud Sync");
    expect(html).toContain("风格");
  });
});
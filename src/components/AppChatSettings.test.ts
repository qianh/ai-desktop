import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../chatApi", () => ({
  listChatProviderProfiles: async () => [
    {
      id: "deepseek",
      display_name: "Deepseek",
      kind: "api",
      api_key: null,
      base_url: "https://api.deepseek.com",
      default_model: "deepseek-chat",
      codex_path: null,
      codex_extra_args_json: "[]",
      enabled: true,
      updated_at: "2026-01-01",
    },
  ],
  listChatMemoryEntries: async () => [],
  saveChatProviderProfile: async (p: unknown) => p,
  saveChatMemoryEntry: async () => ({
    id: "m1",
    content: "test",
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  }),
  deleteChatMemoryEntry: async () => undefined,
}));

import AppChatSettings from "./AppChatSettings";

describe("AppChatSettings", () => {
  it("renders provider and memory sections with theme-aware classes", () => {
    const html = renderToStaticMarkup(createElement(AppChatSettings));
    expect(html).toContain("Model Providers");
    expect(html).toContain("Global Memory");
    expect(html).toContain("asc-app-chat-settings");
    expect(html).toContain("asc-app-chat-settings__input");
    expect(html).toContain("asc-app-chat-settings__heading");
  });
});
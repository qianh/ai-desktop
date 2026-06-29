import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../chatApi", () => ({
  listChatProviderProfiles: async () => [],
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
  it("renders provider and memory sections", () => {
    const html = renderToStaticMarkup(createElement(AppChatSettings));
    expect(html).toContain("Model Providers");
    expect(html).toContain("Global Memory");
  });
});
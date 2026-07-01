import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../chatApi", () => ({
  listChatThreads: async () => [],
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
  listChatMessages: async () => [],
  createChatThread: async () => ({
    id: "t1",
    title: "New chat",
    provider_profile_id: "deepseek",
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  }),
  deleteChatThread: async () => undefined,
  sendChatMessage: async () => ({
    user_message: {
      id: "u1",
      thread_id: "t1",
      role: "user",
      content: "hi",
      status: "complete",
      provider_profile_id: "deepseek",
      error_message: null,
      metadata_json: "{}",
      created_at: "2026-01-01",
    },
    assistant_message: {
      id: "a1",
      thread_id: "t1",
      role: "assistant",
      content: "",
      status: "streaming",
      provider_profile_id: "deepseek",
      error_message: null,
      metadata_json: "{}",
      created_at: "2026-01-01",
    },
    codex_preview: null,
  }),
  confirmCodexTask: async () => ({}),
  cancelCodexTask: async () => ({}),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: async () => () => undefined,
}));

import AppChatWorkspace from "./AppChatWorkspace";

describe("AppChatWorkspace", () => {
  it("renders hcode-style chat shell with thread rail and composer", async () => {
    const el = createElement(AppChatWorkspace);
    const html = renderToStaticMarkup(el);
    expect(html).toContain("Loading App Chat");
    expect(html).toContain("asc-app-chat");
    expect(html).not.toContain("asc-app-chat-thread-rail");
    expect(html).toContain("asc-app-chat-main");
  });
});
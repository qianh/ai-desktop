import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PAGE_URL } from "../lib/ensureDefaultPage";

vi.mock("../chatApi", () => ({
  listChatThreads: async () => [
    {
      id: "t1",
      title: "AEKLF 股价",
      provider_profile_id: "deepseek",
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    },
  ],
  listChatProviderProfiles: async () => [],
  listChatMessages: async () => [],
  createChatThread: async () => ({}),
  deleteChatThread: async () => undefined,
  sendChatMessage: async () => ({}),
  confirmCodexTask: async () => ({}),
  cancelCodexTask: async () => ({}),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: async () => () => undefined,
}));

import { AppChatShell } from "./AppChatWorkspace";
import Sidebar from "./Sidebar";

describe("Sidebar app chat navigation", () => {
  it("keeps Pages section visible when App Chat is active", () => {
    const html = renderToStaticMarkup(
      createElement(AppChatShell, null, createElement(Sidebar, {
        pages: [
          {
            id: "chat",
            name: "Chat",
            host: DEFAULT_PAGE_URL,
            letter: "C",
            color: "#3366cc",
            flows: [],
            status: "idle",
            interceptReportingEnabled: true,
          },
          {
            id: "p1",
            name: "Example",
            host: "https://example.com",
            letter: "E",
            color: "#3366cc",
            flows: [],
            status: "idle",
            interceptReportingEnabled: false,
          },
        ],
        navMode: "app-chat",
        activeId: "",
        query: "",
        collapsed: false,
        sidebarWidthPx: 264,
        onToggleCollapse: () => undefined,
        onQuery: () => undefined,
        onSelect: () => undefined,
        onDeletePage: () => undefined,
        onToggleInterceptReporting: () => undefined,
        onAddPage: () => undefined,
        onSettings: () => undefined,
        onOpenAppChat: () => undefined,
        onOpenRecords: () => undefined,
        appChatActive: true,
        recordsActive: false,
      })),
    );

    expect(html).toContain("App Chat");
    expect(html).toContain("Records");
    expect(html).toContain("Pages");
    expect(html).toContain("Example");
    const pagesIdx = html.indexOf(">Pages<");
    const chatPageIdx = html.indexOf(DEFAULT_PAGE_URL);
    expect(pagesIdx).toBeGreaterThan(-1);
    expect(chatPageIdx).toBeGreaterThan(pagesIdx);
    expect(html).toContain("Threads");
    expect(html).toContain("asc-sidebar-chat-threads");
  });
});
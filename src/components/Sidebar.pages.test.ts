import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_URL } from "../lib/ensureDefaultPage";
import Sidebar from "./Sidebar";

describe("Sidebar pages grouping", () => {
  it("renders default Chat page inside Pages section, not above it", () => {
    const html = renderToStaticMarkup(
      createElement(Sidebar, {
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
            name: "ChatGPT",
            host: "https://chatgpt.com",
            letter: "G",
            color: "#10a37f",
            flows: [],
            status: "idle",
            interceptReportingEnabled: false,
          },
        ],
        navMode: "sessions",
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
        appChatActive: false,
        recordsActive: false,
      }),
    );

    const recordsIdx = html.indexOf("Records");
    const pagesIdx = html.indexOf(">Pages<");
    const chatHostIdx = html.indexOf(DEFAULT_PAGE_URL);

    expect(recordsIdx).toBeGreaterThan(-1);
    expect(pagesIdx).toBeGreaterThan(recordsIdx);
    expect(chatHostIdx).toBeGreaterThan(pagesIdx);
  });
});
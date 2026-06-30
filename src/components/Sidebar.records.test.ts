import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Sidebar from "./Sidebar";

describe("Sidebar records navigation", () => {
  it("renders Records nav item and omits TitleBar-style session records", () => {
    const html = renderToStaticMarkup(
      createElement(Sidebar, {
        pages: [],
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

    expect(html).toContain("Records");
    expect(html).toContain("Session records");
  });
});
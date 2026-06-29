import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Sidebar from "./Sidebar";
import { DEFAULT_PAGE_URL } from "../lib/ensureDefaultPage";
import type { Page } from "../types";

const baseProps = {
  navMode: "sessions",
  activeId: "",
  query: "",
  collapsed: false,
  onToggleCollapse: () => undefined,
  onQuery: () => undefined,
  onSelect: () => undefined,
  onDeletePage: () => undefined,
  onToggleInterceptReporting: () => undefined,
  onAddPage: () => undefined,
        onSettings: () => undefined,
        onOpenAppChat: () => undefined,
        appChatActive: false,
};

function makePage(overrides: Partial<Page> = {}): Page {
  return {
    id: "p1",
    name: "Test",
    host: "https://chat.openai.com/",
    status: "idle",
    letter: "T",
    color: "#1e66d0",
    flows: [],
    interceptReportingEnabled: false,
    ...overrides,
  };
}

describe("PageIcon favicon", () => {
  it("renders img with favicon.ico src derived from page host URL", () => {
    const html = renderToStaticMarkup(
      createElement(Sidebar, {
        ...baseProps,
        pages: [makePage({ host: "https://chat.openai.com/" })],
      }),
    );
    expect(html).toContain('src="https://chat.openai.com/favicon.ico"');
  });

  it("uses only the origin for the favicon URL even when host has a path", () => {
    const html = renderToStaticMarkup(
      createElement(Sidebar, {
        ...baseProps,
        pages: [makePage({ host: "https://github.com/some/deep/path" })],
      }),
    );
    expect(html).toContain('src="https://github.com/favicon.ico"');
    expect(html).not.toContain("/some/deep/path/favicon.ico");
  });

  it("default Chat page (chatPage slot) also renders favicon img in expanded sidebar", () => {
    const html = renderToStaticMarkup(
      createElement(Sidebar, {
        ...baseProps,
        pages: [makePage({ host: DEFAULT_PAGE_URL, name: "Chat" })],
      }),
    );
    // chatPage is rendered in a separate slot — must still get favicon img
    expect(html).toContain("favicon.ico");
  });

  it("favicon img is not initially hidden with display:none (WebKit onLoad compat)", () => {
    const html = renderToStaticMarkup(
      createElement(Sidebar, {
        ...baseProps,
        pages: [makePage({ host: "https://chat.openai.com/" })],
      }),
    );
    // display:none prevents WebKit from firing onLoad — must not appear on the img
    const imgMatch = html.match(/src="https:\/\/chat\.openai\.com\/favicon\.ico"[^>]*/);
    expect(imgMatch).toBeTruthy();
    expect(imgMatch![0]).not.toContain("display:none");
    expect(imgMatch![0]).not.toContain('display: none');
  });

  it("does not render favicon img when host is empty string", () => {
    const html = renderToStaticMarkup(
      createElement(Sidebar, {
        ...baseProps,
        pages: [makePage({ host: "" })],
      }),
    );
    expect(html).not.toContain("favicon.ico");
  });

  it("does not render favicon img when host is not a valid URL", () => {
    const html = renderToStaticMarkup(
      createElement(Sidebar, {
        ...baseProps,
        pages: [makePage({ host: "not-a-url" })],
      }),
    );
    expect(html).not.toContain("favicon.ico");
  });
});

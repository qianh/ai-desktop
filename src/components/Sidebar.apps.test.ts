import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Sidebar from "./Sidebar";

describe("Sidebar app feature removal", () => {
  it("does not render Apps navigation or app add controls", () => {
    const html = renderToStaticMarkup(
      createElement(Sidebar, {
        pages: [],
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
        onCerts: () => undefined,
        onSettings: () => undefined,
        onOpenSessionRecords: () => undefined,
        sessionRecordsActive: false,
      }),
    );

    expect(html).not.toContain("Apps");
    expect(html).not.toContain("Add App");
  });
});

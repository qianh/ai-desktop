import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CodexTaskConfirmationModal from "./CodexTaskConfirmationModal";

describe("CodexTaskConfirmationModal", () => {
  it("renders confirm and cancel actions", () => {
    const html = renderToStaticMarkup(
      createElement(CodexTaskConfirmationModal, {
        preview: {
          command_summary: "codex exec --model gpt-4o-mini hello",
          workdir: "/workspace",
          risk_summary: "May modify files",
          prompt: "hello",
        },
        onConfirm: () => undefined,
        onCancel: () => undefined,
      }),
    );
    expect(html).toContain("Confirm Codex task");
    expect(html).toContain("Run Codex");
    expect(html).toContain("Cancel");
  });
});
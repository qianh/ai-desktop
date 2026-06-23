import { describe, expect, it } from "vitest";
import {
  joinConversationTextChunks,
  normalizeConversationMarkdown,
} from "./normalizeConversationMarkdown";

describe("normalizeConversationMarkdown", () => {
  it("removes orphan backslashes and renders GFM tables", () => {
    const raw = [
      "---",
      "\\",
      "数据概览\\",
      "| 指标 | 数值 |",
      "|------|------|",
      "| 记录天数 | 14 天 |",
    ].join("\n");

    const normalized = normalizeConversationMarkdown(raw);
    expect(normalized).toContain("### 数据概览\n\n| 指标 | 数值 |");
    expect(normalized).not.toContain("数据概览\\");
    expect(normalized).not.toMatch(/^\s*\\\s*$/m);
  });
});

describe("joinConversationTextChunks", () => {
  it("joins table rows without blank lines between chunks", () => {
    const joined = joinConversationTextChunks([
      "| 指标 | 数值 |\n|------|------|\n",
      "| 记录天数 | 14 天 |",
    ]);
    expect(joined).toBe("| 指标 | 数值 |\n|------|------|\n| 记录天数 | 14 天 |");
  });
});
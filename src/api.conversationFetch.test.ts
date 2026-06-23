import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchFilteredConversationIntercepts } from "./api";
import { INTERCEPTS_LIST_SELECT } from "./lib/conversationRecordsQuery";

import type { SupabaseConfig } from "./lib/supabase";

const config: SupabaseConfig = {
  url: "https://example.supabase.co",
  key: "test-key",
};

function mockFetch(handler: (url: string) => Response | Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    return handler(url);
  }));
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe("fetchFilteredConversationIntercepts", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses lean list select and is_conversation filter (no bodies)", async () => {
    const calls: string[] = [];
    mockFetch((url) => {
      calls.push(decodeURIComponent(url));
      return jsonResponse([
        {
          id: "r1",
          timestamp: 100,
          url: "https://chatgpt.com/backend-api/conversation",
          method: "POST",
          page_id: "p1",
          preview_text: "SSD健康状态分析",
          is_conversation: true,
          conversation_id: null,
        },
        {
          id: "noise",
          timestamp: 200,
          url: "https://chatgpt.com/backend-api/conversation/6a39e2c9/textdocs",
          method: "GET",
          page_id: "p1",
          preview_text: null,
          is_conversation: false,
          conversation_id: "6a39e2c9-650c-83e8-b375-aa1b2c3d4e5f",
        },
      ]);
    });

    const result = await fetchFilteredConversationIntercepts(
      { pageId: "p1", timeFromMs: null, timeToMs: null },
      ["p1"],
      config,
    );

    expect(calls[0]).toContain(`select=${INTERCEPTS_LIST_SELECT}`);
    expect(calls[0]).toContain("is_conversation=eq.true");
    expect(calls[0]).not.toContain("or=(and(method.eq.POST");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].id).toBe("r1");
    expect(result.rows[0].preview_text).toBe("SSD健康状态分析");
    expect(result.rows[0].req_body).toBeNull();
    expect(result.rows[0].resp_body).toBeNull();
  });

  it("normalizes epoch-second timestamps and applies client-side time filter", async () => {
    mockFetch(() =>
      jsonResponse([
        {
          id: "sec",
          timestamp: 1_718_000_000,
          url: "https://chatgpt.com/backend-api/conversation",
          method: "POST",
          page_id: "p1",
          preview_text: "in range",
          is_conversation: true,
          conversation_id: null,
        },
      ]),
    );

    const from = 1_718_000_000_000 - 60_000;
    const to = 1_718_000_000_000 + 60_000;
    const result = await fetchFilteredConversationIntercepts(
      { pageId: "p1", timeFromMs: from, timeToMs: to },
      ["p1"],
      config,
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].timestamp).toBe(1_718_000_000_000);
  });

  it("includes GET conversation rows via preview_text without resp_body", async () => {
    mockFetch(() =>
      jsonResponse([
        {
          id: "get-1",
          timestamp: 200,
          url: "https://chatgpt.com/backend-api/conversation/6a39e2c9-650c-83e8-b375-aa1b2c3d4e5f",
          method: "GET",
          page_id: "p1",
          preview_text: "SSD健康状态分析",
          is_conversation: true,
          conversation_id: "6a39e2c9-650c-83e8-b375-aa1b2c3d4e5f",
        },
      ]),
    );

    const result = await fetchFilteredConversationIntercepts(
      { pageId: "p1", timeFromMs: null, timeToMs: null },
      ["p1"],
      config,
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].preview_text).toBe("SSD健康状态分析");
    expect(result.rows[0].resp_body).toBeNull();
  });

  it("falls back to legacy full-row fetch when lean columns are missing", async () => {
    const calls: string[] = [];
    let attempt = 0;
    mockFetch((url) => {
      calls.push(url);
      attempt += 1;
      if (attempt === 1) {
        return jsonResponse({ message: 'column "preview_text" does not exist' }, 400);
      }
      return jsonResponse([
        {
          id: "legacy",
          timestamp: 100,
          url: "https://chatgpt.com/backend-api/conversation/6a39e2c9-650c-83e8-b375-aa1b2c3d4e5f",
          method: "GET",
          page_id: "p1",
          req_body: null,
          resp_body: JSON.stringify({ title: "SSD健康状态分析", mapping: { a: {} } }),
        },
      ]);
    });

    const result = await fetchFilteredConversationIntercepts(
      { pageId: "p1", timeFromMs: null, timeToMs: null },
      ["p1"],
      config,
    );

    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].resp_body).toContain("SSD健康状态分析");
  });

  it("falls back to per-page eq queries when bulk query returns 400", async () => {
    const calls: string[] = [];
    mockFetch((url) => {
      calls.push(url);
      if (!url.includes("page_id=eq.")) {
        return jsonResponse({ message: "bad request" }, 400);
      }
      return jsonResponse([]);
    });

    await fetchFilteredConversationIntercepts(
      { pageId: null, timeFromMs: null, timeToMs: null },
      ["p1", "p2"],
      config,
    );

    expect(calls.filter((u) => u.includes("page_id=eq.")).length).toBeGreaterThanOrEqual(2);
  });
});
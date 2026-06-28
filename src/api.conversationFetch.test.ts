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

  it("uses lean list select and indexed conversation filter (no bodies)", async () => {
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
    expect(calls[0]).not.toContain("or=");
    expect(calls[0]).not.toContain("or=(and(method.eq.POST");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].id).toBe("r1");
    expect(result.rows[0].preview_text).toBe("SSD健康状态分析");
    expect(result.rows[0].req_body).toBeNull();
    expect(result.rows[0].resp_body).toBeNull();
  });

  it("hydrates legacy /_serverFn rows and classifies keyed Seroval chat loads", async () => {
    const calls: string[] = [];
    mockFetch((url) => {
      calls.push(decodeURIComponent(url));
      if (url.includes("id=in.")) {
        return jsonResponse([
          {
            id: "chat-get",
            timestamp: 300,
            url: "/_serverFn/be65b71ec49e2abd",
            method: "GET",
            page_id: "p1",
            req_body: null,
            resp_body:
              '{"k":["id","userId","title","agentId","createdAt","updatedAt"],"v":[{"t":1,"s":"b6277585-0bea-45a0-9edc-da244237c1fd"},{"t":1,"s":"1000000209"},{"t":1,"s":"AEKLF股价走势"}]}',
            preview_text: null,
            is_conversation: false,
            conversation_id: null,
          },
        ]);
      }
      return jsonResponse([
        {
          id: "chat-get",
          timestamp: 300,
          url: "/_serverFn/be65b71ec49e2abd",
          method: "GET",
          page_id: "p1",
          preview_text: null,
          is_conversation: false,
          conversation_id: null,
        },
      ]);
    });

    const result = await fetchFilteredConversationIntercepts(
      { pageId: "p1", timeFromMs: null, timeToMs: null },
      ["p1"],
      config,
    );

    expect(calls.some((u) => u.includes("id=in."))).toBe(true);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].preview_text).toBe("AEKLF股价走势");
    expect(result.rows[0].conversation_id).toBe("b6277585-0bea-45a0-9edc-da244237c1fd");
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

  it("retries without time filters when a ranged query is empty so epoch-second history survives", async () => {
    const calls: string[] = [];
    mockFetch((url) => {
      calls.push(decodeURIComponent(url));
      if (url.includes("timestamp=")) return jsonResponse([]);
      return jsonResponse([
        {
          id: "legacy-sec",
          timestamp: 1_718_000_000,
          url: "https://chatgpt.com/backend-api/conversation",
          method: "POST",
          page_id: "p1",
          preview_text: "legacy seconds",
          is_conversation: true,
          conversation_id: null,
        },
      ]);
    });

    const result = await fetchFilteredConversationIntercepts(
      { pageId: "p1", timeFromMs: 1_718_000_000_000, timeToMs: 1_718_086_400_000 },
      ["p1"],
      config,
    );

    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain("timestamp=gte.1718000000000");
    expect(calls[0]).toContain("timestamp=lte.1718086400000");
    expect(calls[1]).not.toContain("timestamp=");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].id).toBe("legacy-sec");
    expect(result.rows[0].timestamp).toBe(1_718_000_000_000);
  });

  it("does not retry without time filters when the ranged query returns rows", async () => {
    const calls: string[] = [];
    mockFetch((url) => {
      calls.push(decodeURIComponent(url));
      return jsonResponse([
        {
          id: "ms",
          timestamp: 1_718_000_000_000,
          url: "https://chatgpt.com/backend-api/conversation",
          method: "POST",
          page_id: "p1",
          preview_text: "already in range",
          is_conversation: true,
          conversation_id: null,
        },
      ]);
    });

    const result = await fetchFilteredConversationIntercepts(
      { pageId: "p1", timeFromMs: 1_718_000_000_000, timeToMs: 1_718_086_400_000 },
      ["p1"],
      config,
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("timestamp=gte.1718000000000");
    expect(calls[0]).toContain("timestamp=lte.1718086400000");
    expect(result.rows).toHaveLength(1);
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

  it("hydrates /_serverFn rows in batches to avoid oversized id=in URLs", async () => {
    const calls: string[] = [];
    const serverFnIds = Array.from({ length: 120 }, (_, i) => `srv-${i}`);
    mockFetch((url) => {
      calls.push(decodeURIComponent(url));
      if (url.includes("id=in.")) {
        const match = url.match(/id=in\.\((.*)\)/);
        const count = match ? match[1].split(",").length : 0;
        expect(count).toBeLessThanOrEqual(50);
        return jsonResponse(
          serverFnIds.slice(0, count).map((id, index) => ({
            id,
            timestamp: 100 + index,
            url: "/_serverFn/abc",
            method: "GET",
            page_id: "p1",
            req_body: null,
            resp_body:
              '{"k":["id","userId","title"],"v":[{"t":1,"s":"chat-1"},{"t":1,"s":"u1"},{"t":1,"s":"标题' +
              index +
              '"}]}',
            preview_text: null,
            is_conversation: false,
            conversation_id: null,
          })),
        );
      }
      return jsonResponse(
        serverFnIds.map((id, index) => ({
          id,
          timestamp: 100 + index,
          url: "/_serverFn/abc",
          method: "GET",
          page_id: "p1",
          preview_text: null,
          is_conversation: false,
          conversation_id: null,
        })),
      );
    });

    const result = await fetchFilteredConversationIntercepts(
      { pageId: "p1", timeFromMs: null, timeToMs: null },
      ["p1"],
      config,
    );

    expect(calls.filter((u) => u.includes("id=in.")).length).toBe(3);
    expect(result.rows.length).toBeGreaterThanOrEqual(0);
  });

  it("falls back to URL-only query when lean list returns generic Bad Request", async () => {
    const calls: string[] = [];
    let attempt = 0;
    mockFetch((url) => {
      calls.push(decodeURIComponent(url));
      attempt += 1;
      if (attempt === 1) {
        return jsonResponse("Bad Request", 400);
      }
      return jsonResponse([
        {
          id: "legacy-1",
          timestamp: 100,
          url: "https://chatgpt.com/backend-api/conversation",
          method: "POST",
          page_id: "p1",
          req_body: JSON.stringify({
            messages: [{ role: "user", content: { parts: ["hello"] } }],
          }),
          resp_body: 'data: {"message":{"content":{"parts":["hi"]}}}',
        },
      ]);
    });

    const result = await fetchFilteredConversationIntercepts(
      { pageId: "p1", timeFromMs: null, timeToMs: null },
      ["p1"],
      config,
    );

    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(calls[0]).toContain("is_conversation=eq.true");
    expect(calls[1]).not.toContain("is_conversation.eq.true");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].id).toBe("legacy-1");
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

  it("retries per-page fallback without time filters when ranged page queries are empty", async () => {
    const calls: string[] = [];
    mockFetch((url) => {
      const decoded = decodeURIComponent(url);
      calls.push(decoded);
      if (!decoded.includes("page_id=eq.")) {
        return jsonResponse({ message: "bulk too broad" }, 400);
      }
      if (decoded.includes("timestamp=")) return jsonResponse([]);
      if (decoded.includes("page_id=eq.p1")) {
        return jsonResponse([
          {
            id: "per-page-legacy-sec",
            timestamp: 1_718_000_000,
            url: "https://chatgpt.com/backend-api/conversation",
            method: "POST",
            page_id: "p1",
            preview_text: "legacy per page",
            is_conversation: true,
            conversation_id: null,
          },
        ]);
      }
      return jsonResponse([]);
    });

    const result = await fetchFilteredConversationIntercepts(
      { pageId: null, timeFromMs: 1_718_000_000_000, timeToMs: 1_718_086_400_000 },
      ["p1", "p2"],
      config,
    );

    expect(calls.some((u) => u.includes("page_id=eq.p1") && u.includes("timestamp="))).toBe(true);
    expect(calls.some((u) => u.includes("page_id=eq.p1") && !u.includes("timestamp="))).toBe(true);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].id).toBe("per-page-legacy-sec");
    expect(result.rows[0].timestamp).toBe(1_718_000_000_000);
  });
});

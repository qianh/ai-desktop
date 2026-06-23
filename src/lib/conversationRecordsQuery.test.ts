import { describe, expect, it } from "vitest";
import {
  buildInterceptByIdParams,
  buildInterceptsByIdsParams,
  buildInterceptsQueryParams,
  CONVERSATION_URL_OR_VALUE,
  datetimeLocalToMs,
  defaultPastWeekRange,
  draftToFilter,
  filterCacheKey,
  INTERCEPTS_LIST_SELECT,
  INTERCEPTS_METADATA_SELECT,
  conversationListQueryOptions,
  msToDatetimeLocal,
  NOISE_URL_NOT_OR_VALUE,
  quotePostgrestId,
  validateTimeRange,
} from "./conversationRecordsQuery";
import {
  classifyInterceptForStorage,
  dedupeConversationRows,
  extractConversationIdFromUrl,
  isConversationBodyProbeCandidate,
  isConversationGetLoadRow,
  isConversationPostRow,
  isConversationUrlCandidate,
  isListableConversationRow,
  conversationPreview,
} from "./conversationFilter";
import type { InterceptedFetch } from "../types";

describe("buildInterceptsQueryParams", () => {
  it("filters by single page; time range is applied client-side", () => {
    const params = buildInterceptsQueryParams(
      { pageId: "p1", timeFromMs: 1000, timeToMs: 2000 },
      ["p1", "p2"],
      200,
    );
    expect(params.get("page_id")).toBe("eq.p1");
    expect(params.getAll("timestamp")).toEqual([]);
    expect(params.get("limit")).toBe("200");
  });

  it("omits page_id filter when pageId is null (query all Supabase rows)", () => {
    const params = buildInterceptsQueryParams(
      { pageId: null, timeFromMs: null, timeToMs: null },
      ["a", "b"],
      50,
    );
    expect(params.get("page_id")).toBeNull();
  });

  it("escapes quotes inside page ids", () => {
    expect(quotePostgrestId('a"b')).toBe('"a\\"b"');
  });

  it("conversationListQueryOptions uses lean select and is_conversation filter", () => {
    const params = buildInterceptsQueryParams(
      { pageId: "p1", timeFromMs: null, timeToMs: null },
      ["p1"],
      conversationListQueryOptions(500),
    );
    expect(params.get("select")).toBe(INTERCEPTS_LIST_SELECT);
    expect(params.get("is_conversation")).toBe("eq.true");
    expect(params.get("limit")).toBe("500");
  });

  it("adds metadata select and conversation SQL filters when requested", () => {
    const params = buildInterceptsQueryParams(
      { pageId: "p1", timeFromMs: 1000, timeToMs: 2000 },
      ["p1"],
      { limit: 600, select: INTERCEPTS_METADATA_SELECT, conversationUrlFilter: true },
    );
    expect(params.get("select")).toBe(INTERCEPTS_METADATA_SELECT);
    expect(params.get("or")).toBe(CONVERSATION_URL_OR_VALUE);
    expect(params.get("not.or")).toBe(NOISE_URL_NOT_OR_VALUE);
  });
});

describe("buildInterceptByIdParams", () => {
  it("builds eq filter for a single intercept row", () => {
    const params = buildInterceptByIdParams("row-1");
    expect(params.get("id")).toBe("eq.row-1");
    expect(params.get("limit")).toBe("1");
  });
});

describe("buildInterceptsByIdsParams", () => {
  it("quotes ids for PostgREST in.(...) filter", () => {
    const params = buildInterceptsByIdsParams(["id-1", "id-2"]);
    expect(params.get("id")).toBe('in.("id-1","id-2")');
  });
});

describe("isConversationUrlCandidate", () => {
  it("matches POST send-message endpoints only", () => {
    expect(
      isConversationUrlCandidate({
        method: "POST",
        url: "https://chatgpt.com/backend-api/conversation",
      }),
    ).toBe(true);
    expect(
      isConversationUrlCandidate({
        method: "GET",
        url: "https://chatgpt.com/backend-api/conversation/6a39e2c9-650c-83e8-b375-aa1b2c3d4e5f",
      }),
    ).toBe(false);
  });

  it("rejects prepare, beacons, conversation list, and analytics", () => {
    expect(
      isConversationUrlCandidate({
        method: "POST",
        url: "https://chatgpt.com/backend-api/conversation/prepare",
      }),
    ).toBe(false);
    expect(
      isConversationUrlCandidate({
        method: "GET",
        url: "https://chatgpt.com/backend-api/beacons/home?conversation_id=6a39e2c9",
      }),
    ).toBe(false);
    expect(
      isConversationUrlCandidate({
        method: "GET",
        url: "https://chatgpt.com/backend-api/conversations?offset=0&limit=28",
      }),
    ).toBe(false);
    expect(
      isConversationUrlCandidate({
        method: "POST",
        url: "https://chatgpt.com/ces/v1/t",
      }),
    ).toBe(false);
  });
});

describe("isListableConversationRow", () => {
  it("includes POST sends and GET loads without requiring bodies", () => {
    expect(
      isListableConversationRow({
        method: "POST",
        url: "https://chatgpt.com/backend-api/conversation",
      }),
    ).toBe(true);
    expect(
      isListableConversationRow({
        method: "GET",
        url: "https://chatgpt.com/backend-api/conversation/6a39e2c9-650c-83e8-b375-aa1b2c3d4e5f",
      }),
    ).toBe(true);
    expect(
      isListableConversationRow({
        method: "POST",
        url: "https://chatgpt.com/ces/v1/t",
      }),
    ).toBe(false);
  });
});

describe("isConversationPostRow", () => {
  it("matches POST conversation sends", () => {
    expect(
      isConversationPostRow({
        method: "POST",
        url: "https://chatgpt.com/backend-api/conversation",
      }),
    ).toBe(true);
  });

  it("rejects GET conversation loads", () => {
    expect(
      isConversationPostRow({
        method: "GET",
        url: "https://chatgpt.com/backend-api/conversation/6a39e2c9-650c-83e8-b375-aa1b2c3d4e5f",
      }),
    ).toBe(false);
  });

  it("prefers main GET load over textdocs when deduping", () => {
    const id = "6a39e2c9-650c-83e8-b375-aa1b2c3d4e5f";
    const main: InterceptedFetch = {
      id: "main",
      timestamp: 100,
      method: "GET",
      url: `https://chatgpt.com/backend-api/conversation/${id}`,
      req_headers: {},
      req_body: null,
      status: 200,
      resp_headers: {},
      resp_body: JSON.stringify({ title: "SSD健康状态分析", mapping: { a: {} } }),
      duration_ms: 1,
    };
    const textdocs: InterceptedFetch = {
      ...main,
      id: "textdocs",
      timestamp: 200,
      url: `https://chatgpt.com/backend-api/conversation/${id}/textdocs`,
      resp_body: "[]",
    };
    const deduped = dedupeConversationRows([textdocs, main]);
    expect(deduped.map((r) => r.id)).toEqual(["main"]);
  });
});

describe("isConversationGetLoadRow", () => {
  it("matches GET single-conversation loads", () => {
    expect(
      isConversationGetLoadRow({
        method: "GET",
        url: "https://chatgpt.com/backend-api/conversation/6a39e2c9-650c-83e8-b375-aa1b2c3d4e5f",
      }),
    ).toBe(true);
  });

  it("rejects conversation list API", () => {
    expect(
      isConversationGetLoadRow({
        method: "GET",
        url: "https://chatgpt.com/backend-api/conversations?offset=0",
      }),
    ).toBe(false);
  });

  it("rejects textdocs and stream_status sub-resources", () => {
    const id = "6a39e2c9-650c-83e8-b375-aa1b2c3d4e5f";
    expect(
      isConversationGetLoadRow({
        method: "GET",
        url: `https://chatgpt.com/backend-api/conversation/${id}/textdocs`,
      }),
    ).toBe(false);
    expect(
      isConversationGetLoadRow({
        method: "GET",
        url: `https://chatgpt.com/backend-api/conversation/${id}/stream_status`,
      }),
    ).toBe(false);
  });
});

describe("isConversationBodyProbeCandidate", () => {
  it("includes POST rows that are not URL candidates", () => {
    expect(
      isConversationBodyProbeCandidate({
        method: "POST",
        url: "https://api.example.com/v1/chat/completions",
      }),
    ).toBe(true);
    expect(
      isConversationBodyProbeCandidate({
        method: "POST",
        url: "https://chatgpt.com/backend-api/conversation",
      }),
    ).toBe(false);
  });
});

describe("classifyInterceptForStorage", () => {
  it("marks prepare requests as non-conversation", () => {
    const meta = classifyInterceptForStorage({
      id: "1",
      timestamp: 1,
      url: "https://chatgpt.com/backend-api/conversation/prepare",
      method: "POST",
      req_headers: {},
      req_body: "{}",
      status: 200,
      resp_headers: {},
      resp_body: null,
      duration_ms: 1,
    });
    expect(meta.isConversation).toBe(false);
  });

  it("extracts preview for real chat POST", () => {
    const meta = classifyInterceptForStorage({
      id: "2",
      timestamp: 1,
      url: "https://chatgpt.com/backend-api/conversation",
      method: "POST",
      req_headers: {},
      req_body: JSON.stringify({ messages: [{ role: "user", content: { parts: ["你好"] } }] }),
      status: 200,
      resp_headers: {},
      resp_body: 'data: {"message":{"content":{"parts":["嗨"]}}}',
      duration_ms: 1,
    });
    expect(meta.isConversation).toBe(true);
    expect(meta.previewText).toBeTruthy();
  });

  it("marks GET conversation loads as conversation even without bodies", () => {
    const convId = "6a39e2c9-650c-83e8-b375-aa1b2c3d4e5f";
    const meta = classifyInterceptForStorage({
      id: "3",
      timestamp: 1,
      url: `https://chatgpt.com/backend-api/conversation/${convId}`,
      method: "GET",
      req_headers: {},
      req_body: null,
      status: 200,
      resp_headers: {},
      resp_body: null,
      duration_ms: 1,
    });
    expect(meta.isConversation).toBe(true);
    expect(meta.conversationId).toBe(convId);
    expect(meta.previewText).toBe("加载对话记录");
  });

  it("marks GET conversation loads with mapping as conversation", () => {
    const convId = "6a39e2c9-650c-83e8-b375-aa1b2c3d4e5f";
    const meta = classifyInterceptForStorage({
      id: "4",
      timestamp: 1,
      url: `https://chatgpt.com/backend-api/conversation/${convId}`,
      method: "GET",
      req_headers: {},
      req_body: null,
      status: 200,
      resp_headers: {},
      resp_body: JSON.stringify({ title: "SSD健康分析", mapping: { m1: {} } }),
      duration_ms: 1,
    });
    expect(meta.isConversation).toBe(true);
    expect(meta.conversationId).toBe(convId);
    expect(meta.previewText).toContain("SSD");
  });
});

describe("extractConversationIdFromUrl", () => {
  it("parses uuid from conversation path", () => {
    const id = "6a39e2c9-650c-83e8-b375-aa1b2c3d4e5f";
    expect(
      extractConversationIdFromUrl(`https://chatgpt.com/backend-api/conversation/${id}`),
    ).toBe(id);
  });
});

describe("dedupeConversationRows", () => {
  it("prefers POST over GET for the same conversation id", () => {
    const id = "6a39e2c9-650c-83e8-b375-aa1b2c3d4e5f";
    const getRow: InterceptedFetch = {
      id: "get",
      timestamp: 300,
      method: "GET",
      url: `https://chatgpt.com/backend-api/conversation/${id}`,
      req_headers: {},
      req_body: null,
      status: 200,
      resp_headers: {},
      resp_body: '{"title":"from GET"}',
      duration_ms: 1,
    };
    const postRow: InterceptedFetch = {
      id: "post",
      timestamp: 100,
      method: "POST",
      url: "https://chatgpt.com/backend-api/conversation",
      req_headers: {},
      req_body: JSON.stringify({
        conversation_id: id,
        messages: [{ role: "user", content: { parts: ["hi"] } }],
      }),
      status: 200,
      resp_headers: {},
      resp_body: "data: {}",
      duration_ms: 1,
    };
    const deduped = dedupeConversationRows([getRow, postRow]);
    expect(deduped.map((r) => r.id)).toEqual(["post"]);
  });

  it("keeps only the latest GET load per conversation id", () => {
    const id = "6a39e2c9-650c-83e8-b375-aa1b2c3d4e5f";
    const base = {
      method: "GET",
      url: `https://chatgpt.com/backend-api/conversation/${id}`,
      req_headers: {},
      req_body: null,
      status: 200,
      resp_headers: {},
      resp_body: '{"title":"A"}',
      duration_ms: 1,
    } satisfies Omit<InterceptedFetch, "id" | "timestamp">;
    const rows: InterceptedFetch[] = [
      { ...base, id: "2", timestamp: 200 },
      {
        ...base,
        id: "3",
        timestamp: 150,
        method: "POST",
        url: "https://chatgpt.com/backend-api/conversation",
      },
      { ...base, id: "1", timestamp: 100 },
    ];
    const deduped = dedupeConversationRows(rows);
    expect(deduped.map((r) => r.id)).toEqual(["2", "3"]);
  });
});

describe("conversationPreview", () => {
  it("prefers stored preview_text over bodies", () => {
    const item: InterceptedFetch = {
      id: "x",
      timestamp: 1,
      url: "https://chatgpt.com/backend-api/conversation/u",
      method: "GET",
      req_headers: {},
      req_body: null,
      status: 200,
      resp_headers: {},
      resp_body: JSON.stringify({ title: "from body" }),
      duration_ms: 1,
      preview_text: "SSD健康状态分析",
    };
    expect(conversationPreview(item)).toBe("SSD健康状态分析");
  });

  it("prefers conversation title from response body", () => {
    const item: InterceptedFetch = {
      id: "x",
      timestamp: 1,
      url: "https://chatgpt.com/backend-api/conversation/u",
      method: "GET",
      req_headers: {},
      req_body: null,
      status: 200,
      resp_headers: {},
      resp_body: JSON.stringify({ title: "SSD健康状态分析" }),
      duration_ms: 1,
    };
    expect(conversationPreview(item)).toBe("SSD健康状态分析");
  });
});

describe("NOISE_URL_NOT_OR_VALUE", () => {
  it("uses tight /init path patterns instead of broad */init*", () => {
    expect(NOISE_URL_NOT_OR_VALUE).not.toContain("*/init*");
    expect(NOISE_URL_NOT_OR_VALUE).toContain("*/init,");
    expect(NOISE_URL_NOT_OR_VALUE).toContain("*/init?*");
    expect(NOISE_URL_NOT_OR_VALUE).toContain("*/init/*");
  });
});

describe("validateTimeRange", () => {
  it("rejects inverted range", () => {
    expect(validateTimeRange("2026-06-23T12:00", "2026-06-22T12:00")).toBe("结束时间不能早于开始时间");
  });

  it("accepts valid or partial range", () => {
    expect(validateTimeRange("2026-06-22T12:00", "2026-06-23T12:00")).toBeNull();
    expect(validateTimeRange("", "2026-06-23T12:00")).toBeNull();
  });
});

describe("datetimeLocalToMs / msToDatetimeLocal", () => {
  it("round-trips through local datetime input", () => {
    const ms = datetimeLocalToMs("2026-06-23T15:30");
    expect(ms).not.toBeNull();
    expect(msToDatetimeLocal(ms!)).toBe("2026-06-23T15:30");
  });

  it("returns null for empty input", () => {
    expect(datetimeLocalToMs("")).toBeNull();
  });
});

describe("defaultPastWeekRange", () => {
  it("spans seven days ending at now", () => {
    const now = new Date("2026-06-23T12:30:00").getTime();
    const { from, to } = defaultPastWeekRange(now);
    expect(to).toBe("2026-06-23T12:30");
    expect(from).toBe("2026-06-16T12:30");
    expect(draftToFilter(null, from, to).timeFromMs).toBe(datetimeLocalToMs(from));
  });
});

describe("filterCacheKey", () => {
  it("differs when filter changes", () => {
    const a = filterCacheKey({ pageId: null, timeFromMs: null, timeToMs: null }, ["x"]);
    const b = filterCacheKey({ pageId: "x", timeFromMs: null, timeToMs: null }, ["x"]);
    expect(a).not.toBe(b);
  });
});
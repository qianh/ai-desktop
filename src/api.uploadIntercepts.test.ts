import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadInterceptsToSupabase } from "./api";
import type { SupabaseConfig } from "./lib/supabase";
import type { InterceptedFetch } from "./types";

const config: SupabaseConfig = {
  url: "https://example.supabase.co/",
  key: "test-key",
};

const sample: InterceptedFetch = {
  id: "intercept-1",
  timestamp: 1_700_000_000_000,
  url: "https://chatgpt.com/backend-api/conversation",
  method: "POST",
  req_headers: { "content-type": "application/json" },
  req_body: JSON.stringify({
    messages: [{ role: "user", content: { parts: ["hello"] } }],
  }),
  status: 200,
  resp_headers: {},
  resp_body: 'data: {"message":{"content":{"parts":["hi"]}}}',
  duration_ms: 12,
};

describe("uploadInterceptsToSupabase", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs rows with upsert prefer header to normalized base url", async () => {
    let postedUrl = "";
    let postedInit: RequestInit | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        postedUrl = typeof input === "string" ? input : input.toString();
        postedInit = init;
        return {
          ok: true,
          status: 201,
          text: async () => "",
        };
      }),
    );

    await uploadInterceptsToSupabase("page-1", [sample], config);

    expect(postedUrl).toBe("https://example.supabase.co/rest/v1/intercepts");
    expect(postedInit?.method).toBe("POST");
    expect(postedInit?.headers).toMatchObject({
      apikey: "test-key",
      Prefer: "resolution=merge-duplicates,return=minimal",
    });
    const body = JSON.parse(String(postedInit?.body)) as InterceptedFetch[];
    expect(body[0].page_id).toBe("page-1");
    expect(body[0].id).toBe("intercept-1");
    expect(body[0]).toHaveProperty("is_conversation");
    expect(body[0]).toHaveProperty("preview_text");
    expect(body[0]).toHaveProperty("conversation_id");
  });

  it("sets preview_text for built-in Chat /api/chat payloads", async () => {
    const chat: InterceptedFetch = {
      ...sample,
      url: "https://chat.worldwide-logistics.cn/api/chat",
      req_body: JSON.stringify({
        id: "chat-xyz",
        messages: [{ role: "user", content: "物流时效分析" }],
      }),
      resp_body: 'data: {"type":"text-delta","delta":"ok"}',
    };

    let postedBody = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        postedBody = String(init?.body);
        return { ok: true, status: 201, text: async () => "" };
      }),
    );

    await uploadInterceptsToSupabase("page-1", [chat], config);
    const row = JSON.parse(postedBody)[0] as InterceptedFetch;
    expect(row.is_conversation).toBe(true);
    expect(row.conversation_id).toBe("chat-xyz");
    expect(row.preview_text).toBe("物流时效分析");
  });

  it("sets preview_text and is_conversation for built-in Chat /_serverFn metadata GET", async () => {
    const chat: InterceptedFetch = {
      ...sample,
      url: "https://chat.worldwide-logistics.cn/_serverFn/be65b71ec49e2abd",
      method: "GET",
      req_body: null,
      resp_body:
        '{"k":["id","userId","title","agentId","createdAt","updatedAt"],"v":[{"t":1,"s":"b6277585-0bea-45a0-9edc-da244237c1fd"},{"t":1,"s":"1000000209"},{"t":1,"s":"AEKLF股价走势"}]}',
    };

    let postedBody = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        postedBody = String(init?.body);
        return { ok: true, status: 201, text: async () => "" };
      }),
    );

    await uploadInterceptsToSupabase("page-1", [chat], config);
    const row = JSON.parse(postedBody)[0] as InterceptedFetch;
    expect(row.is_conversation).toBe(true);
    expect(row.preview_text).toBe("AEKLF股价走势");
    expect(row.conversation_id).toBe("b6277585-0bea-45a0-9edc-da244237c1fd");
  });

  it("sets user message preview for built-in Chat message thread GET", async () => {
    const chat: InterceptedFetch = {
      ...sample,
      url: "https://chat.worldwide-logistics.cn/_serverFn/7c955775683c",
      method: "GET",
      req_body: null,
      resp_body:
        '{"k":["id","chatId","parentId","role","parts"],"v":[{"t":1,"s":"00bb8027-5836-4e8b-8673-016bfeaf0ba7"},{"t":1,"s":"02b99671-7f71-40c1-bc23-682d774acc5e"},{"t":2,"s":0},{"t":1,"s":"user"},{"t":9,"i":3,"a":[{"t":10,"i":4,"p":{"k":["text","type"],"v":[{"t":1,"s":"船舶拥堵"},{"t":1,"s":"text"}]},"o":0}],"o":0}]}',
    };

    let postedBody = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        postedBody = String(init?.body);
        return { ok: true, status: 201, text: async () => "" };
      }),
    );

    await uploadInterceptsToSupabase("page-1", [chat], config);
    const row = JSON.parse(postedBody)[0] as InterceptedFetch;
    expect(row.is_conversation).toBe(true);
    expect(row.preview_text).toBe("船舶拥堵");
    expect(row.conversation_id).toBe("02b99671-7f71-40c1-bc23-682d774acc5e");
  });

  it("omits built-in Chat utility /_serverFn GET from upload", async () => {
    const noise: InterceptedFetch = {
      ...sample,
      url: "https://chat.worldwide-logistics.cn/_serverFn/ae5be38d886e",
      method: "GET",
      req_body: null,
      resp_body:
        '{"t":10,"i":0,"p":{"k":["result","error","context"],"v":[{"t":1,"s":"inquire-quotation"},{"t":2,"s":1}]}}',
    };

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await uploadInterceptsToSupabase("page-1", [noise], config);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uploads only conversation rows from a mixed batch", async () => {
    const chat: InterceptedFetch = {
      ...sample,
      id: "chat-row",
      req_body: JSON.stringify({
        messages: [{ role: "user", content: { parts: ["保留这条会话"] } }],
      }),
    };
    const noise: InterceptedFetch = {
      ...sample,
      id: "noise-row",
      url: "https://chat.worldwide-logistics.cn/_serverFn/ae5be38d886e",
      method: "GET",
      req_body: null,
      resp_body:
        '{"t":10,"i":0,"p":{"k":["result","error","context"],"v":[{"t":1,"s":"inquire-quotation"},{"t":2,"s":1}]}}',
    };

    let postedBody = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        postedBody = String(init?.body);
        return { ok: true, status: 201, text: async () => "" };
      }),
    );

    await uploadInterceptsToSupabase("page-1", [chat, noise], config);
    const rows = JSON.parse(postedBody) as InterceptedFetch[];
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("chat-row");
    expect(rows[0].is_conversation).toBe(true);
    expect(rows[0].preview_text).toBe("保留这条会话");
  });

  it("sets preview_text for real chat POST payloads", async () => {
    const chat: InterceptedFetch = {
      ...sample,
      req_body: JSON.stringify({
        messages: [{ role: "user", content: { parts: ["SSD健康状态分析"] } }],
      }),
      resp_body: 'data: {"message":{"content":{"parts":["ok"]}}}',
    };

    let postedBody = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        postedBody = String(init?.body);
        return { ok: true, status: 201, text: async () => "" };
      }),
    );

    await uploadInterceptsToSupabase("page-1", [chat], config);
    const row = JSON.parse(postedBody)[0] as InterceptedFetch;
    expect(row.is_conversation).toBe(true);
    expect(row.preview_text).toBe("SSD健康状态分析");
  });

  it("keeps existing sanitization for uploaded conversation rows", async () => {
    let postedBody = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        postedBody = String(init?.body);
        return { ok: true, status: 201, text: async () => "" };
      }),
    );

    await uploadInterceptsToSupabase(
      "page-1",
      [{
        ...sample,
        req_headers: { "x-test": "a\u0000b" },
        resp_body: "ok\u0000",
      }],
      config,
    );

    const row = JSON.parse(postedBody)[0] as InterceptedFetch;
    expect(row.resp_body).toBe("ok");
    expect(row.req_headers["x-test"]).toBe("ab");
  });

  it("throws when Supabase returns an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 400,
        text: async () => "column \"method\" does not exist",
      })),
    );

    await expect(
      uploadInterceptsToSupabase("page-1", [sample], config),
    ).rejects.toThrow(/Supabase 400/);
  });
});

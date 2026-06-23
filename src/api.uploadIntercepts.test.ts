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
  req_body: "{\"messages\":[]}",
  status: 200,
  resp_headers: {},
  resp_body: "data: {}",
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
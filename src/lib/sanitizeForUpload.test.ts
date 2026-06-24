import { describe, expect, it } from "vitest";
import {
  BINARY_BODY_PLACEHOLDER,
  isLikelyBinaryText,
  sanitizeInterceptForUpload,
  sanitizePostgresText,
  stripNullBytes,
} from "./sanitizeForUpload";
import type { InterceptedFetch } from "../types";

const base: InterceptedFetch = {
  id: "i1",
  timestamp: 1,
  url: "https://example.com/api",
  method: "POST",
  req_headers: {},
  req_body: null,
  status: 200,
  resp_headers: {},
  resp_body: null,
  duration_ms: 1,
};

describe("sanitizeForUpload", () => {
  it("strips null bytes from text fields", () => {
    expect(stripNullBytes("a\u0000b")).toBe("ab");
    expect(sanitizePostgresText("ok\u0000")).toBe("ok");
  });

  it("replaces gzip/binary bodies with a placeholder", () => {
    const gzipLike = String.fromCharCode(0x1f, 0x8b, 0x08, 0x00, 0x00);
    expect(sanitizePostgresText(gzipLike)).toBe(BINARY_BODY_PLACEHOLDER);

    const noisyBinary = String.fromCharCode(0x1f, 0x8b, 0x08) + "x".repeat(20);
    expect(isLikelyBinaryText(noisyBinary)).toBe(true);
  });

  it("sanitizes intercept rows before upload", () => {
    const gzipLike = String.fromCharCode(0x1f, 0x8b, 0x08) + "payload";
    const row = sanitizeInterceptForUpload({
      ...base,
      req_body: gzipLike,
      resp_body: "ok\u0000",
      req_headers: { "x-test": "a\u0000b" },
    });
    expect(row.req_body).toBe(BINARY_BODY_PLACEHOLDER);
    expect(row.resp_body).toBe("ok");
    expect(row.req_headers["x-test"]).toBe("ab");
  });
});
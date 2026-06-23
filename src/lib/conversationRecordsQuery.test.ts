import { describe, expect, it } from "vitest";
import {
  buildInterceptsQueryParams,
  datetimeLocalToMs,
  defaultPastWeekRange,
  draftToFilter,
  filterCacheKey,
  msToDatetimeLocal,
  quotePostgrestId,
  validateTimeRange,
} from "./conversationRecordsQuery";

describe("buildInterceptsQueryParams", () => {
  it("filters by single page and time range", () => {
    const params = buildInterceptsQueryParams(
      { pageId: "p1", timeFromMs: 1000, timeToMs: 2000 },
      ["p1", "p2"],
      200,
    );
    expect(params.get("page_id")).toBe("eq.p1");
    expect(params.getAll("timestamp")).toEqual(["gte.1000", "lte.2000"]);
    expect(params.get("limit")).toBe("200");
  });

  it("uses quoted in.(...) when pageId is null", () => {
    const params = buildInterceptsQueryParams(
      { pageId: null, timeFromMs: null, timeToMs: null },
      ["a", "b"],
      50,
    );
    expect(params.get("page_id")).toBe('in.("a","b")');
  });

  it("escapes quotes inside page ids", () => {
    expect(quotePostgrestId('a"b')).toBe('"a\\"b"');
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
export type ConversationRecordsFilter = {
  pageId: string | null;
  timeFromMs: number | null;
  timeToMs: number | null;
};

export function filterCacheKey(filter: ConversationRecordsFilter, allPageIds: string[]): string {
  const ids = [...allPageIds].sort().join(",");
  return `${filter.pageId ?? "*"}|${filter.timeFromMs ?? ""}|${filter.timeToMs ?? ""}|${ids}`;
}

/** Parse `<input type="datetime-local">` value to epoch ms, or null if empty/invalid. */
export function datetimeLocalToMs(value: string): number | null {
  if (!value.trim()) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** Format epoch ms for datetime-local input (local timezone). */
export function msToDatetimeLocal(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Default session-records time window: from 7 days ago to now (local). */
export function defaultPastWeekRange(nowMs = Date.now()): { from: string; to: string } {
  return {
    from: msToDatetimeLocal(nowMs - WEEK_MS),
    to: msToDatetimeLocal(nowMs),
  };
}

export function draftToFilter(
  pageId: string | null,
  timeFromInput: string,
  timeToInput: string,
): ConversationRecordsFilter {
  return {
    pageId,
    timeFromMs: datetimeLocalToMs(timeFromInput),
    timeToMs: datetimeLocalToMs(timeToInput),
  };
}

/** Returns a user-facing error when the range is invalid, else null. */
export function validateTimeRange(timeFromInput: string, timeToInput: string): string | null {
  const from = datetimeLocalToMs(timeFromInput);
  const to = datetimeLocalToMs(timeToInput);
  if (from != null && to != null && from > to) {
    return "结束时间不能早于开始时间";
  }
  return null;
}

export function quotePostgrestId(id: string): string {
  return `"${id.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function buildInterceptsQueryParams(
  filter: ConversationRecordsFilter,
  allPageIds: string[],
  limit: number,
): URLSearchParams {
  const params = new URLSearchParams({
    order: "timestamp.desc",
    limit: String(limit),
  });

  if (filter.pageId) {
    params.append("page_id", `eq.${filter.pageId}`);
  } else if (allPageIds.length > 0) {
    const quoted = allPageIds.map((id) => quotePostgrestId(id)).join(",");
    params.append("page_id", `in.(${quoted})`);
  }

  if (filter.timeFromMs != null) {
    params.append("timestamp", `gte.${filter.timeFromMs}`);
  }
  if (filter.timeToMs != null) {
    params.append("timestamp", `lte.${filter.timeToMs}`);
  }

  return params;
}
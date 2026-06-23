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

/** PostgREST or=(...) value — likely conversation endpoints (pushed to DB). */
export const CONVERSATION_URL_OR_VALUE =
  "(and(method.eq.POST,url.ilike.*/backend-api/conversation),and(method.eq.GET,url.ilike.*/backend-api/conversation/*),url.ilike.*/backend-api/conversation/*,url.ilike.*/backend-anon/conversation/*,url.ilike.*/api/conversation/*,url.ilike.*chatgpt.com*conversation*,url.ilike.*chat.openai.com*conversation*)";

/** POST sends + GET single-conversation loads (historical data is often GET-only). */
export const STRICT_CONVERSATION_URL_OR_VALUE =
  "(and(method.eq.POST,url.ilike.*/backend-api/conversation),and(method.eq.GET,url.ilike.*/backend-api/conversation/*),and(method.eq.POST,url.ilike.*/backend-anon/conversation),and(method.eq.POST,url.ilike.*/api/conversation))";

/** PostgREST not.or=(...) value — exclude known analytics/noise URLs at query time. */
export const NOISE_URL_NOT_OR_VALUE =
  "(url.ilike.*analytics*,url.ilike.*/ces/*,url.ilike.*/rgstr/*,url.ilike.*/v1/metrics*,url.ilike.*sentry*,url.ilike.*/ab.test*,url.ilike.*/ab.register*,url.ilike.*/stream_status*,url.ilike.*/init,url.ilike.*/init?*,url.ilike.*/init/*,url.ilike.*/experimental/*)";

export const INTERCEPTS_METADATA_SELECT = "id,timestamp,url,method,page_id";

/** Lean list query — no req_body/resp_body; preview_text set at upload. */
export const INTERCEPTS_LIST_SELECT =
  "id,timestamp,url,method,page_id,preview_text,is_conversation,conversation_id";

/** @deprecated Full-body list select; use INTERCEPTS_LIST_SELECT + fetchInterceptById for detail. */
export const INTERCEPTS_LIST_PREVIEW_SELECT =
  "id,timestamp,url,method,page_id,req_body,resp_body,preview_text,is_conversation,conversation_id";

export const INTERCEPTS_BODY_SELECT =
  "id,timestamp,url,method,page_id,req_body,resp_body,preview_text,is_conversation,conversation_id";

export type InterceptsQueryOptions = {
  limit: number;
  select?: string;
  /** When true, filter is_conversation=eq.true (requires migration). */
  conversationOnly?: boolean;
  /** When true, append conversation URL + noise filters for smaller result sets. */
  conversationUrlFilter?: boolean;
  /** When true, append strict conversation URL or=(...) for legacy/historical rows. */
  strictConversationUrlFilter?: boolean;
  /** Restrict to GET/POST to skip static assets in legacy fallback scans. */
  httpMethodsOnly?: boolean;
};

function appendPageAndTimeFilters(
  params: URLSearchParams,
  filter: ConversationRecordsFilter,
  _allPageIds: string[],
): void {
  if (filter.pageId) {
    params.append("page_id", `eq.${filter.pageId}`);
  }
  // pageId=null → no page_id filter: include all rows in Supabase (e.g. after page recreate).

  // Time range is applied client-side after timestamp normalization (seconds vs ms).
}

export function appendConversationSqlFilters(params: URLSearchParams): void {
  params.append("or", CONVERSATION_URL_OR_VALUE);
  params.append("not.or", NOISE_URL_NOT_OR_VALUE);
}

export function appendStrictConversationUrlFilter(params: URLSearchParams): void {
  params.append("or", STRICT_CONVERSATION_URL_OR_VALUE);
}

export function buildInterceptsQueryParams(
  filter: ConversationRecordsFilter,
  allPageIds: string[],
  options: InterceptsQueryOptions | number,
): URLSearchParams {
  const resolved: InterceptsQueryOptions =
    typeof options === "number" ? { limit: options } : options;

  const params = new URLSearchParams({
    order: "timestamp.desc",
    limit: String(resolved.limit),
  });

  if (resolved.select) {
    params.set("select", resolved.select);
  }

  appendPageAndTimeFilters(params, filter, allPageIds);

  if (resolved.httpMethodsOnly) {
    params.append("method", "in.(GET,POST)");
  }

  if (resolved.strictConversationUrlFilter) {
    appendStrictConversationUrlFilter(params);
  }

  if (resolved.conversationUrlFilter) {
    appendConversationSqlFilters(params);
  }

  if (resolved.conversationOnly) {
    params.append("is_conversation", "eq.true");
  }

  return params;
}

/** Default options for session-records list (lean metadata, no bodies). */
export function conversationListQueryOptions(limit: number): InterceptsQueryOptions {
  return {
    limit,
    select: INTERCEPTS_LIST_SELECT,
    conversationOnly: true,
  };
}

export function buildInterceptByIdParams(id: string): URLSearchParams {
  return new URLSearchParams({
    id: `eq.${id}`,
    limit: "1",
    select: INTERCEPTS_BODY_SELECT,
  });
}

export function buildInterceptsByIdsParams(ids: string[]): URLSearchParams {
  const quoted = ids.map((id) => quotePostgrestId(id)).join(",");
  return new URLSearchParams({
    id: `in.(${quoted})`,
    order: "timestamp.desc",
    select: INTERCEPTS_BODY_SELECT,
  });
}
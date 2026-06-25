import { invoke } from "@tauri-apps/api/core";
import {
  aggregateConversationMessages,
  classifyInterceptForStorage,
  conversationIdForRow,
  conversationTitleFromBodies,
  dedupeConversationRows,
  isConversationGetLoadRow,
  isConversationIntercept,
  isListableConversationRow,
  isServerFnListRow,
  parseConversationBodies,
  previewFromServerFnSeroval,
} from "./lib/conversationFilter";
import {
  buildInterceptByIdParams,
  buildInterceptsByConversationIdParams,
  buildInterceptsByIdsParams,
  buildInterceptsQueryParams,
  CONVERSATION_THREAD_MAX_ROWS,
  CONVERSATION_THREAD_PAGE_SIZE,
  conversationListQueryOptions,
  type ConversationRecordsFilter,
  type InterceptsQueryOptions,
} from "./lib/conversationRecordsQuery";
import type {
  Flow,
  FlowType,
  Header,
  InterceptedFetch,
  Page,
  SessionStatus,
} from "./types";
import { fmtSize } from "./lib/format";
import type { SupabaseConfig } from "./lib/supabase";
import {
  sanitizeInterceptForUpload,
  sanitizePostgresText,
  stripNullBytes,
} from "./lib/sanitizeForUpload";

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function backendUnavailable(): never {
  throw new Error("Tauri backend unavailable");
}

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauriRuntime()) {
    backendUnavailable();
  }
  return invoke<T>(command, args);
}

export interface ApiPage {
  id: string;
  name: string;
  url: string;
  status: string;
  intercept_reporting_enabled: boolean;
}

export interface ApiSession {
  id: string;
  status: string;
  proxy_port: number;
  page_url: string;
}

export interface ApiFlowListItem {
  id: string;
  method: string;
  url: string;
  scheme: string;
  host: string;
  path: string;
  status_code: number | null;
  mime?: string | null;
  resp_size?: number | null;
  duration_ms?: number | null;
  started_at: string;
}

export interface ApiCertificateStatus {
  state: string;
}

const PAGE_COLORS = ["#1e66d0", "#30a14e", "#7a5af0", "#c97b20", "#5b6470"];

function pageColor(id: string): string {
  let hash = 0;
  for (const ch of id) hash = (hash + ch.charCodeAt(0)) % PAGE_COLORS.length;
  return PAGE_COLORS[hash];
}

function pageLetter(name: string): string {
  return (name.trim()[0] || "?").toUpperCase();
}

function inferFlowType(mime?: string | null, path?: string): FlowType {
  const m = (mime || "").toLowerCase();
  const p = (path || "").toLowerCase();
  if (m.includes("javascript") || p.endsWith(".js")) return "script";
  if (m.includes("css") || p.endsWith(".css")) return "stylesheet";
  if (m.includes("image")) return "image";
  if (m.includes("font")) return "font";
  if (m.includes("html") || p.endsWith(".html")) return "document";
  if (m.includes("json") || p.includes("/api")) return "fetch";
  return "xhr";
}

function emptyBody(): Flow["reqBody"] {
  return { kind: "none" };
}

function emptyTiming(): Flow["timing"] {
  return { blocked: 0, dns: 0, connect: 0, tls: 0, send: 0, wait: 0, receive: 0 };
}

export function mapFlowListItem(item: ApiFlowListItem): Flow {
  const type = inferFlowType(item.mime, item.path);
  const size = item.resp_size ?? null;
  return {
    id: item.id,
    method: item.method,
    url: item.url,
    scheme: item.scheme,
    host: item.host,
    path: item.path,
    status: item.status_code,
    type,
    typeLabel: type,
    mime: item.mime || "",
    size,
    sizeLabel: size == null ? "—" : fmtSize(size),
    reqSizeLabel: "—",
    time: item.duration_ms ?? null,
    started: item.started_at,
    remote: item.host,
    protocol: item.scheme === "https" ? "h2" : "http/1.1",
    reqHeaders: [],
    respHeaders: [],
    reqBody: emptyBody(),
    respBody: item.mime ? { kind: "json", ctype: item.mime } : emptyBody(),
    timing: emptyTiming(),
  };
}

export function mapApiPage(page: ApiPage): Page {
  const status: SessionStatus = page.status === "capturing" ? "capturing" : "idle";
  return {
    id: page.id,
    name: page.name,
    host: page.url,
    status,
    letter: pageLetter(page.name),
    color: pageColor(page.id),
    flows: [],
    interceptReportingEnabled: page.intercept_reporting_enabled,
  };
}

export async function savePage(name: string | undefined, url: string): Promise<ApiPage> {
  return call<ApiPage>("save_page", { name: name ?? null, url });
}

export async function listPages(): Promise<ApiPage[]> {
  return call<ApiPage[]>("list_pages");
}

export async function setPageInterceptReporting(
  pageId: string,
  enabled: boolean,
): Promise<ApiPage> {
  return call<ApiPage>("set_page_intercept_reporting", { pageId, enabled });
}

export async function removePage(pageId: string): Promise<void> {
  await call<void>("remove_page", { pageId });
}

export async function openPageWithCapture(pageId: string): Promise<ApiSession> {
  return call<ApiSession>("open_page_with_capture", { pageId });
}

export function formatInvokeError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    // Tauri Webview local event: webview.once("tauri://error", handler)
    if (record.event === "tauri://error" && "payload" in record) {
      return formatInvokeError(record.payload);
    }
    if ("payload" in record && record.payload !== undefined) {
      const payload = formatInvokeError(record.payload);
      if (payload !== "[object Object]") return payload;
    }
    if (typeof record.message === "string") return record.message;
    if (typeof record.error === "string") return record.error;
    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== "{}") return serialized;
    } catch {
      // fall through
    }
  }
  return String(error);
}

export async function mountPageWebview(
  pageId: string,
  url: string,
  proxyPort: number,
  interceptReportingEnabled: boolean,
  sidebarRight: number,
  panelRight: number,
): Promise<void> {
  await call<void>("mount_page_webview", {
    pageId,
    url,
    proxyPort,
    interceptReportingEnabled,
    sidebarRight,
    panelRight,
  });
}

export async function getPageWebviewUrl(pageId: string): Promise<string | null> {
  return call<string | null>("get_page_webview_url", { pageId });
}

export async function setPageWebviewVisible(pageId: string, visible: boolean): Promise<void> {
  await call<void>("set_page_webview_visible", { pageId, visible });
}

export async function closePageWebview(pageId: string): Promise<void> {
  await call<void>("close_page_webview", { pageId });
}

export async function syncPageWebviewBounds(
  pageId: string,
  sidebarRight: number,
  panelRight: number,
): Promise<void> {
  await call<void>("sync_page_webview_bounds", { pageId, sidebarRight, panelRight });
}

export async function stopSession(sessionId: string): Promise<void> {
  await call<void>("stop_session", { sessionId });
}

export async function listFlows(sessionId: string): Promise<ApiFlowListItem[]> {
  return call<ApiFlowListItem[]>("list_flows", { sessionId });
}

export async function getFlowDetail(flowId: string): Promise<Flow> {
  const detail = await call<{
    id: string;
    method: string;
    url: string;
    scheme: string;
    host: string;
    path: string;
    status_code: number | null;
    req_headers: Header[];
    resp_headers: Header[];
    req_body_preview?: string | null;
    resp_body_preview?: string | null;
    mime?: string | null;
    duration_ms?: number | null;
    req_size?: number | null;
    resp_size?: number | null;
    started_at: string;
  }>("get_flow_detail", { flowId });

  const type = inferFlowType(detail.mime, detail.path);
  const size = detail.resp_size ?? null;
  const reqSize = detail.req_size ?? null;
  return {
    id: detail.id,
    method: detail.method,
    url: detail.url,
    scheme: detail.scheme,
    host: detail.host,
    path: detail.path,
    status: detail.status_code,
    type,
    typeLabel: type,
    mime: detail.mime || "",
    size,
    sizeLabel: size == null ? "—" : fmtSize(size),
    reqSize: reqSize ?? undefined,
    reqSizeLabel: reqSize == null ? "—" : fmtSize(reqSize),
    time: detail.duration_ms ?? null,
    started: detail.started_at,
    remote: detail.host,
    protocol: detail.scheme === "https" ? "h2" : "http/1.1",
    reqHeaders: detail.req_headers,
    respHeaders: detail.resp_headers,
    reqBody: detail.req_body_preview
      ? { kind: "json", text: detail.req_body_preview }
      : emptyBody(),
    respBody: detail.resp_body_preview
      ? { kind: "json", text: detail.resp_body_preview, ctype: detail.mime || undefined }
      : emptyBody(),
    timing: emptyTiming(),
  };
}

export async function getCertificateStatus(): Promise<ApiCertificateStatus> {
  return call<ApiCertificateStatus>("get_certificate_status");
}

export async function generateCertificate(): Promise<void> {
  await call<void>("generate_certificate");
}

export async function installCertificate(): Promise<void> {
  await call<void>("install_certificate");
}

export async function openCertificateGuide(): Promise<void> {
  await call<void>("open_certificate_guide");
}

export async function removeCertificate(): Promise<void> {
  await call<void>("remove_certificate");
}

export async function exportSession(sessionId: string, format: "json" | "har"): Promise<string> {
  return call<string>("export_session", { sessionId, format });
}

export const REPORTED_INTERCEPTS_LIMIT = 200;

export async function uploadInterceptsToSupabase(
  pageId: string,
  items: InterceptedFetch[],
  config: SupabaseConfig,
): Promise<void> {
  if (!config.url || !config.key || items.length === 0) return;

  const base = config.url.replace(/\/$/, "");
  const rows = items.map((item) => {
    const meta = classifyInterceptForStorage(item);
    const sanitized = sanitizeInterceptForUpload(item);
    return {
      ...sanitized,
      page_id: pageId,
      preview_text: sanitizePostgresText(meta.previewText),
      is_conversation: meta.isConversation,
      conversation_id:
        meta.conversationId != null ? stripNullBytes(meta.conversationId) : meta.conversationId,
    };
  });
  const resp = await fetch(`${base}/rest/v1/intercepts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Supabase ${resp.status}${text ? `: ${text}` : ""}`);
  }
}

export type ConversationTruncationReason = "scan_limit" | "display_cap" | "candidate_cap";

export type FilteredConversationResult = {
  rows: InterceptedFetch[];
  truncated: boolean;
  truncationReason: ConversationTruncationReason | null;
};

const RAW_INTERCEPTS_FETCH_LIMIT = 1000;

type ListFetchMode = "lean" | "legacy";

function listRowToIntercept(row: InterceptedFetch): InterceptedFetch {
  return {
    ...row,
    req_headers: row.req_headers ?? {},
    resp_headers: row.resp_headers ?? {},
    req_body: row.req_body ?? null,
    resp_body: row.resp_body ?? null,
    status: row.status ?? 0,
    duration_ms: row.duration_ms ?? 0,
  };
}

/** Epoch seconds (e.g. 1.7e9) → ms; already-ms values pass through. */
export function normalizeInterceptTimestamp(ts: number): number {
  if (!Number.isFinite(ts)) return ts;
  if (ts > 0 && ts < 1e12) return ts * 1000;
  return ts;
}

function normalizeInterceptRows(rows: InterceptedFetch[]): InterceptedFetch[] {
  return rows.map((row) => ({
    ...row,
    timestamp: normalizeInterceptTimestamp(row.timestamp),
  }));
}

function applyClientTimeFilter(
  rows: InterceptedFetch[],
  filter: ConversationRecordsFilter,
): InterceptedFetch[] {
  return rows.filter((row) => {
    if (filter.timeFromMs != null && row.timestamp < filter.timeFromMs) return false;
    if (filter.timeToMs != null && row.timestamp > filter.timeToMs) return false;
    return true;
  });
}

function capConversationRows(rawRows: InterceptedFetch[]): FilteredConversationResult {
  const filtered = dedupeConversationRows(filterConversationRows(rawRows));
  let truncationReason: ConversationTruncationReason | null = null;
  if (rawRows.length >= RAW_INTERCEPTS_FETCH_LIMIT) {
    truncationReason = "scan_limit";
  } else if (filtered.length > REPORTED_INTERCEPTS_LIMIT) {
    truncationReason = "display_cap";
  }
  return {
    rows: filtered.slice(0, REPORTED_INTERCEPTS_LIMIT),
    truncated: truncationReason !== null,
    truncationReason,
  };
}

function isInFilterFallbackError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /\bSupabase 400\b/.test(error.message);
}

async function fetchInterceptsFromSupabase(
  params: URLSearchParams,
  config: SupabaseConfig,
  signal?: AbortSignal,
): Promise<InterceptedFetch[]> {
  const base = config.url.replace(/\/$/, "");
  const resp = await fetch(`${base}/rest/v1/intercepts?${params}`, {
    signal,
    headers: {
      Accept: "application/json",
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
    },
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Supabase ${resp.status}${text ? `: ${text}` : ""}`);
  }
  return (await resp.json()) as InterceptedFetch[];
}

function filterConversationRows(rows: InterceptedFetch[]): InterceptedFetch[] {
  return rows.filter((r) => {
    if (r.is_conversation === true) return true;
    if (isListableConversationRow(r)) {
      if (isConversationGetLoadRow(r)) return true;
      if (isConversationIntercept(r)) return true;
    }
    if (isServerFnListRow(r)) {
      const preview =
        r.preview_text?.trim() ||
        previewFromServerFnSeroval(r.resp_body) ||
        previewFromServerFnSeroval(r.req_body);
      if (preview) return true;
      if (r.conversation_id) return true;
    }
    if (r.is_conversation === false) return false;
    if (!isConversationIntercept(r)) return false;
    if (conversationTitleFromBodies(r)) return true;
    const { user, assistant, rawReq, rawResp } = parseConversationBodies(r);
    return Boolean(user || assistant || rawReq || rawResp);
  });
}

async function hydrateServerFnRowBodies(
  rows: InterceptedFetch[],
  config: SupabaseConfig,
  signal?: AbortSignal,
): Promise<InterceptedFetch[]> {
  const needsBody = rows.filter(
    (r) =>
      isServerFnListRow(r) &&
      r.is_conversation !== true &&
      !r.resp_body &&
      !r.req_body,
  );
  if (needsBody.length === 0) return rows;

  const ids = needsBody.map((r) => r.id);
  const withBodies = await fetchInterceptsFromSupabase(
    buildInterceptsByIdsParams(ids),
    config,
    signal,
  );
  const byId = new Map(withBodies.map((r) => [r.id, listRowToIntercept(r)]));
  return rows.map((r) => {
    const full = byId.get(r.id);
    const merged = full
      ? {
          ...r,
          req_body: full.req_body,
          resp_body: full.resp_body,
          preview_text: r.preview_text ?? full.preview_text,
          conversation_id: r.conversation_id ?? full.conversation_id,
        }
      : r;
    if (!isServerFnListRow(merged)) return merged;
    const meta = classifyInterceptForStorage(merged);
    return {
      ...merged,
      preview_text: merged.preview_text ?? meta.previewText,
      conversation_id: merged.conversation_id ?? meta.conversationId,
      is_conversation: merged.is_conversation === true ? true : meta.isConversation,
    };
  });
}

function isLeanListSchemaError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    /\bSupabase 400\b/.test(error.message) &&
    /preview_text|is_conversation|conversation_id|column/i.test(error.message)
  );
}

function hasTimeFilter(filter: ConversationRecordsFilter): boolean {
  return filter.timeFromMs != null || filter.timeToMs != null;
}

async function loadInterceptRows(
  filter: ConversationRecordsFilter,
  allPageIds: string[],
  config: SupabaseConfig,
  signal?: AbortSignal,
  mode: ListFetchMode = "lean",
): Promise<InterceptedFetch[]> {
  const options: InterceptsQueryOptions | number =
    mode === "lean"
      ? conversationListQueryOptions(RAW_INTERCEPTS_FETCH_LIMIT)
      : RAW_INTERCEPTS_FETCH_LIMIT;
  const params = buildInterceptsQueryParams(filter, allPageIds, options);
  const rows = await fetchInterceptsFromSupabase(params, config, signal);
  return rows.map(listRowToIntercept);
}

async function loadConversationListRows(
  filter: ConversationRecordsFilter,
  allPageIds: string[],
  config: SupabaseConfig,
  signal?: AbortSignal,
): Promise<{ rows: InterceptedFetch[]; mode: ListFetchMode }> {
  try {
    const rows = await loadInterceptRows(filter, allPageIds, config, signal, "lean");
    if (rows.length > 0) return { rows, mode: "lean" };
    if (!hasTimeFilter(filter)) {
      const legacy = await loadInterceptRows(filter, allPageIds, config, signal, "legacy");
      if (legacy.length > 0) return { rows: legacy, mode: "legacy" };
    }
    return { rows, mode: "lean" };
  } catch (error) {
    if (isLeanListSchemaError(error)) {
      const legacy = await loadInterceptRows(filter, allPageIds, config, signal, "legacy");
      return { rows: legacy, mode: "legacy" };
    }
    throw error;
  }
}

async function fetchAndFilterConversationRows(
  filter: ConversationRecordsFilter,
  allPageIds: string[],
  config: SupabaseConfig,
  signal?: AbortSignal,
): Promise<FilteredConversationResult> {
  try {
    let { rows: rawRows } = await loadConversationListRows(filter, allPageIds, config, signal);
    rawRows = await hydrateServerFnRowBodies(rawRows, config, signal);
    let normalized = normalizeInterceptRows(rawRows);
    let timeFiltered = applyClientTimeFilter(normalized, filter);

    if (timeFiltered.length === 0 && hasTimeFilter(filter)) {
      ({ rows: rawRows } = await loadConversationListRows(
        { ...filter, timeFromMs: null, timeToMs: null },
        allPageIds,
        config,
        signal,
      ));
      rawRows = await hydrateServerFnRowBodies(rawRows, config, signal);
      normalized = normalizeInterceptRows(rawRows);
      timeFiltered = applyClientTimeFilter(normalized, filter);
    }

    return capConversationRows(timeFiltered);
  } catch (error) {
    if (filter.pageId || !isInFilterFallbackError(error)) throw error;
    return fetchPerPageMerged(filter, allPageIds, config, signal);
  }
}

export async function fetchReportedIntercepts(
  pageId: string,
  config: SupabaseConfig,
  signal?: AbortSignal,
): Promise<InterceptedFetch[]> {
  const params = new URLSearchParams({
    page_id: `eq.${pageId}`,
    order: "timestamp.desc",
    limit: String(REPORTED_INTERCEPTS_LIMIT),
  });
  return fetchInterceptsFromSupabase(params, config, signal);
}

export async function fetchConversationIntercepts(
  pageId: string,
  config: SupabaseConfig,
  signal?: AbortSignal,
): Promise<InterceptedFetch[]> {
  const rows = await fetchReportedIntercepts(pageId, config, signal);
  return filterConversationRows(rows);
}

async function fetchPerPageMerged(
  filter: ConversationRecordsFilter,
  allPageIds: string[],
  config: SupabaseConfig,
  signal?: AbortSignal,
): Promise<FilteredConversationResult> {
  async function loadRows(timeFilter: ConversationRecordsFilter): Promise<InterceptedFetch[]> {
    const perPage = await Promise.all(
      allPageIds.map(async (pageId) => {
        const { rows } = await loadConversationListRows(
          { ...timeFilter, pageId },
          allPageIds,
          config,
          signal,
        );
        return rows;
      }),
    );
    return perPage.flat().sort((a, b) => b.timestamp - a.timestamp);
  }

  let rawRows = await loadRows(filter);
  rawRows = await hydrateServerFnRowBodies(rawRows, config, signal);
  let normalized = normalizeInterceptRows(rawRows);
  let timeFiltered = applyClientTimeFilter(normalized, filter);

  if (timeFiltered.length === 0 && hasTimeFilter(filter)) {
    const noTime = { ...filter, timeFromMs: null, timeToMs: null };
    rawRows = await loadRows(noTime);
    rawRows = await hydrateServerFnRowBodies(rawRows, config, signal);
    normalized = normalizeInterceptRows(rawRows);
    timeFiltered = applyClientTimeFilter(normalized, filter);
  }

  return capConversationRows(timeFiltered);
}

export async function fetchInterceptById(
  id: string,
  config: SupabaseConfig,
  signal?: AbortSignal,
): Promise<InterceptedFetch | null> {
  const rows = await fetchInterceptsFromSupabase(buildInterceptByIdParams(id), config, signal);
  const row = rows[0];
  return row ? listRowToIntercept(row) : null;
}

export async function fetchInterceptsByConversationId(
  conversationId: string,
  config: SupabaseConfig,
  options?: { pageId?: string | null; signal?: AbortSignal; limit?: number },
): Promise<{ rows: InterceptedFetch[]; truncated: boolean }> {
  const pageSize = options?.limit ?? CONVERSATION_THREAD_PAGE_SIZE;
  const rows: InterceptedFetch[] = [];
  let offset = 0;
  let truncated = false;

  while (rows.length < CONVERSATION_THREAD_MAX_ROWS) {
    const params = buildInterceptsByConversationIdParams(
      conversationId,
      options?.pageId,
      pageSize,
      offset,
    );
    const batch = (await fetchInterceptsFromSupabase(params, config, options?.signal)).map(
      listRowToIntercept,
    );
    rows.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
    if (rows.length >= CONVERSATION_THREAD_MAX_ROWS) {
      truncated = true;
      break;
    }
  }

  return { rows, truncated };
}

export type ResolvedConversationMessages = {
  messages: ReturnType<typeof aggregateConversationMessages>;
  partial: boolean;
  loadError?: string;
};

export async function resolveConversationMessages(
  record: InterceptedFetch,
  config: SupabaseConfig,
  signal?: AbortSignal,
): Promise<ResolvedConversationMessages> {
  const conversationId = conversationIdForRow(record);
  if (!conversationId || !config.url || !config.key) {
    return { messages: aggregateConversationMessages([record]), partial: false };
  }

  try {
    const { rows: related, truncated } = await fetchInterceptsByConversationId(
      conversationId,
      config,
      { pageId: record.page_id, signal },
    );
    const byId = new Map<string, InterceptedFetch>();
    byId.set(record.id, record);
    for (const row of related) {
      byId.set(row.id, row);
    }
    return {
      messages: aggregateConversationMessages([...byId.values()]),
      partial: truncated,
    };
  } catch (error) {
    return {
      messages: aggregateConversationMessages([record]),
      partial: true,
      loadError: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function fetchFilteredConversationIntercepts(
  filter: ConversationRecordsFilter,
  allPageIds: string[],
  config: SupabaseConfig,
  signal?: AbortSignal,
): Promise<FilteredConversationResult> {
  return fetchAndFilterConversationRows(filter, allPageIds, config, signal);
}

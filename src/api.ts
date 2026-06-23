import { invoke } from "@tauri-apps/api/core";
import { isConversationIntercept, parseConversationBodies } from "./lib/conversationFilter";
import {
  buildInterceptsQueryParams,
  type ConversationRecordsFilter,
} from "./lib/conversationRecordsQuery";
import type {
  AppEntry,
  Flow,
  FlowType,
  Header,
  InterceptedFetch,
  Page,
  SessionStatus,
} from "./types";
import { fmtSize } from "./lib/format";
import type { SupabaseConfig } from "./lib/supabase";

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
}

export interface ApiApp {
  id?: string | null;
  name: string;
  bundle_id: string;
  app_path: string;
  icon_path?: string | null;
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
  };
}

export function mapApiApp(app: ApiApp, id: string): AppEntry {
  return {
    id,
    name: app.name,
    bundle: app.bundle_id,
    path: app.app_path,
    mode: "normal",
    letter: pageLetter(app.name),
    color: pageColor(app.bundle_id),
  };
}

export async function scanInstalledApps(): Promise<ApiApp[]> {
  return call<ApiApp[]>("scan_installed_apps");
}

export async function savePage(name: string | undefined, url: string): Promise<ApiPage> {
  return call<ApiPage>("save_page", { name: name ?? null, url });
}

export async function listPages(): Promise<ApiPage[]> {
  return call<ApiPage[]>("list_pages");
}

export async function removePage(pageId: string): Promise<void> {
  await call<void>("remove_page", { pageId });
}

export async function saveApp(app: ApiApp): Promise<ApiApp> {
  return call<ApiApp>("save_app", {
    name: app.name,
    bundleId: app.bundle_id,
    appPath: app.app_path,
  });
}

export async function listApps(): Promise<ApiApp[]> {
  return call<ApiApp[]>("list_apps");
}

export async function launchApp(appId: string): Promise<void> {
  await call<void>("launch_app_command", { appId });
}

export async function removeApp(appId: string): Promise<void> {
  await call<void>("remove_app", { appId });
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
  x: number,
  y: number,
  width: number,
  height: number
): Promise<void> {
  await call<void>("mount_page_webview", { pageId, url, proxyPort, x, y, width, height });
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
  x: number,
  y: number,
  width: number,
  height: number
): Promise<void> {
  await call<void>("sync_page_webview_bounds", { pageId, x, y, width, height });
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

/** Fetch more raw rows before client-side conversation filtering. */
const RAW_INTERCEPTS_FETCH_LIMIT = 1000;

export type FilteredConversationResult = {
  rows: InterceptedFetch[];
  truncated: boolean;
};

function capConversationRows(rawRows: InterceptedFetch[]): FilteredConversationResult {
  const filtered = filterConversationRows(rawRows);
  const truncated =
    filtered.length > REPORTED_INTERCEPTS_LIMIT || rawRows.length >= RAW_INTERCEPTS_FETCH_LIMIT;
  return {
    rows: filtered.slice(0, REPORTED_INTERCEPTS_LIMIT),
    truncated,
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
    if (!isConversationIntercept(r)) return false;
    const { user, assistant, rawReq, rawResp } = parseConversationBodies(r);
    return Boolean(user || assistant || rawReq || rawResp);
  });
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
  const perPage = await Promise.all(
    allPageIds.map(async (pageId) => {
      const single = { ...filter, pageId };
      const params = buildInterceptsQueryParams(single, allPageIds, RAW_INTERCEPTS_FETCH_LIMIT);
      return fetchInterceptsFromSupabase(params, config, signal);
    }),
  );
  const merged = perPage.flat().sort((a, b) => b.timestamp - a.timestamp);
  return capConversationRows(merged);
}

export async function fetchFilteredConversationIntercepts(
  filter: ConversationRecordsFilter,
  allPageIds: string[],
  config: SupabaseConfig,
  signal?: AbortSignal,
): Promise<FilteredConversationResult> {
  if (!filter.pageId && allPageIds.length === 0) {
    return { rows: [], truncated: false };
  }

  if (filter.pageId) {
    const params = buildInterceptsQueryParams(filter, allPageIds, RAW_INTERCEPTS_FETCH_LIMIT);
    const rows = await fetchInterceptsFromSupabase(params, config, signal);
    return capConversationRows(rows);
  }

  try {
    const params = buildInterceptsQueryParams(filter, allPageIds, RAW_INTERCEPTS_FETCH_LIMIT);
    const rows = await fetchInterceptsFromSupabase(params, config, signal);
    return capConversationRows(rows);
  } catch (error) {
    if (!isInFilterFallbackError(error)) throw error;
    return fetchPerPageMerged(filter, allPageIds, config, signal);
  }
}


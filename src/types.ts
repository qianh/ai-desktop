// Domain types for AppScope, mirroring the data model in the spec doc (§12) and
// the shape produced by AppScope.dc.html / FlowDetail.dc.html.

export interface Header {
  name: string;
  value: string;
  sensitive?: boolean;
}

export interface Cookie {
  name: string;
  value: string;
  sensitive?: boolean;
  domain?: string;
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  meta?: string;
}

export type BodyKind =
  | "none"
  | "json"
  | "html"
  | "css"
  | "js"
  | "text"
  | "image"
  | "font"
  | "media"
  | "binary";

export interface Body {
  kind: BodyKind;
  ctype?: string;
  text?: string;
  note?: string;
}

export interface Timing {
  blocked: number;
  dns: number;
  connect: number;
  tls: number;
  send: number;
  wait: number;
  receive: number;
}

export type FlowType =
  | "document"
  | "stylesheet"
  | "script"
  | "image"
  | "font"
  | "websocket"
  | "xhr"
  | "fetch";

export interface Flow {
  id: string;
  method: string;
  url: string;
  scheme: string;
  host: string;
  path: string;
  status: number | null;
  statusText?: string;
  type: FlowType;
  typeLabel: string;
  mime: string;
  size: number | null;
  sizeLabel: string;
  reqSize?: number;
  reqSizeLabel: string;
  time: number | null;
  started: string;
  initiator?: string;
  remote: string;
  protocol: string;
  reqHeaders: Header[];
  respHeaders: Header[];
  reqBody: Body;
  respBody: Body;
  reqCookies?: Cookie[];
  respCookies?: Cookie[];
  timing: Timing;
  error?: string;
}

export type SessionStatus = "capturing" | "idle";

export interface Page {
  id: string;
  name: string;
  host: string;
  status: SessionStatus;
  letter: string;
  color: string;
  flows: Flow[];
  interceptReportingEnabled: boolean;
}

export interface AppEntry {
  id: string;
  name: string;
  bundle: string;
  path: string;
  mode: string;
  letter: string;
  color: string;
}

export interface InterceptedFetch {
  id: string;
  page_id?: string;
  timestamp: number;
  url: string;
  method: string;
  req_headers: Record<string, string>;
  req_body: string | null;
  status: number;
  resp_headers: Record<string, string>;
  resp_body: string | null;
  duration_ms: number;
  error?: string;
  /** List preview extracted at upload time (title, user snippet, etc.). */
  preview_text?: string | null;
  /** Set at upload via classifyInterceptForStorage. */
  is_conversation?: boolean | null;
  /** ChatGPT conversation uuid when detectable. */
  conversation_id?: string | null;
}

export interface AppData {
  defaultSel: string;
  pages: Page[];
  apps: AppEntry[];
}



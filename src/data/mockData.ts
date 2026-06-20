// Mock capture data — a typed port of buildData() from AppScope.dc.html.
// Until the Rust proxy sidecar is wired up, the UI runs on this sample data set.

import type { AppData, Body, Cookie, Flow, FlowType, Header, Timing } from "../types";
import { fmtSize } from "../lib/format";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
// Split the script tags so they don't terminate this module when bundled.
const STAG = "<scr" + "ipt";
const ETAG = "</scr" + "ipt>";

interface ReqHOpts {
  host: string;
  path: string;
  method?: string;
  accept?: string;
  referer?: string;
  origin?: boolean;
  auth?: boolean;
  ctype?: string;
  cookie?: boolean;
}

interface RespHOpts {
  status: number | null;
  ctype: string;
  len?: number;
  server?: string;
  cache?: string;
  enc?: boolean;
  cors?: boolean;
  setcookie?: boolean;
  ratelimit?: boolean;
  reqid?: string;
}

interface TgOpts {
  b?: number;
  conn?: boolean;
  wait?: number;
  recv?: number;
}

interface MkInput {
  method: string;
  status: number | null;
  statusText?: string;
  host: string;
  path: string;
  type: FlowType;
  mime: string;
  size: number | null;
  time: number | null;
  started: string;
  initiator?: string;
  accept?: string;
  reqSize?: number;
  protocol?: string;
  error?: string;
  rh?: ReqHOpts;
  sh?: RespHOpts;
  reqBody?: Body;
  respBody?: Body;
  reqCookies?: Cookie[];
  respCookies?: Cookie[];
  timing: Timing;
}

function reqH(o: ReqHOpts): Header[] {
  const a: Header[] = [
    { name: ":authority", value: o.host },
    { name: ":method", value: o.method || "GET" },
    { name: ":path", value: o.path },
    { name: ":scheme", value: "https" },
    { name: "user-agent", value: UA },
    { name: "accept", value: o.accept || "*/*" },
    { name: "accept-encoding", value: "gzip, deflate, br" },
    { name: "accept-language", value: "en-US,en;q=0.9" },
  ];
  if (o.referer) a.push({ name: "referer", value: o.referer });
  if (o.origin) a.push({ name: "origin", value: "https://app.acme.so" });
  if (o.auth)
    a.push({
      name: "authorization",
      value: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c3JfOTAyMSJ9.kQ3v2xR8",
      sensitive: true,
    });
  if (o.ctype) a.push({ name: "content-type", value: o.ctype });
  if (o.cookie) a.push({ name: "cookie", value: "acme_session=s%3Aa1b2c3d4e5; theme=light", sensitive: true });
  return a;
}

function respH(o: RespHOpts): Header[] {
  const a: Header[] = [
    { name: ":status", value: String(o.status == null ? "(pending)" : o.status) },
    { name: "content-type", value: o.ctype },
    { name: "content-length", value: String(o.len || 0) },
    { name: "date", value: "Thu, 18 Jun 2026 10:02:14 GMT" },
    { name: "server", value: o.server || "cloudflare" },
    { name: "cache-control", value: o.cache || "private, no-cache" },
  ];
  if (o.enc !== false) a.push({ name: "content-encoding", value: "br" });
  if (o.cors) a.push({ name: "access-control-allow-origin", value: "https://app.acme.so" });
  if (o.setcookie)
    a.push({
      name: "set-cookie",
      value: "acme_session=s%3Af9e8d7; Path=/; HttpOnly; Secure; SameSite=Lax",
      sensitive: true,
    });
  if (o.ratelimit) a.push({ name: "x-ratelimit-remaining", value: "4982" });
  if (o.reqid) a.push({ name: "x-request-id", value: o.reqid });
  return a;
}

function tg(o: TgOpts): Timing {
  return {
    blocked: o.b || 0.8,
    dns: o.conn ? 5.2 : 0,
    connect: o.conn ? 9.4 : 0,
    tls: o.conn ? 23.1 : 0,
    send: 0.4,
    wait: o.wait || 0,
    receive: o.recv || 0,
  };
}

export function buildAppData(): AppData {
  let i = 0;
  const id = () => "f" + i++;

  const mk = (o: MkInput): Flow => {
    const url = "https://" + o.host + o.path;
    const remote = (o.host.includes("localhost") ? "127.0.0.1" : "104.18.6.21") + ":443";
    return {
      ...o,
      id: id(),
      url,
      scheme: "https",
      typeLabel: o.type,
      sizeLabel: o.status == null ? "(pending)" : fmtSize(o.size),
      reqSizeLabel: fmtSize(o.reqSize || 0),
      remote,
      protocol: o.protocol || "h2",
      reqHeaders: reqH(o.rh || { host: o.host, path: o.path, method: o.method, accept: o.accept }),
      respHeaders:
        o.status == null ? [] : respH(o.sh || { status: o.status, ctype: o.mime, len: o.size ?? 0 }),
      reqBody: o.reqBody || { kind: "none" },
      respBody: o.respBody || { kind: "none" },
    };
  };

  const ME =
    '{\n  "id": "usr_9021",\n  "name": "J. Rivera",\n  "email": "j.rivera@acme.so",\n  "role": "admin",\n  "workspace": { "id": "ws_12", "name": "Acme Inc", "plan": "business" },\n  "feature_flags": ["new_inbox", "ai_summaries"]\n}';
  const PROJECTS =
    '{\n  "data": [\n    { "id": "proj_88", "name": "Q3 Onboarding Revamp", "status": "active", "tasks": 42 },\n    { "id": "proj_71", "name": "Billing Migration", "status": "active", "tasks": 17 },\n    { "id": "proj_64", "name": "Mobile Beta", "status": "archived", "tasks": 8 }\n  ],\n  "page": { "limit": 20, "next_cursor": null, "total": 3 }\n}';
  const TASKS =
    '{\n  "data": [\n    { "id": "tsk_5012", "title": "Audit signup funnel", "done": false, "assignee": "usr_9021" },\n    { "id": "tsk_5013", "title": "Write welcome email", "done": true, "assignee": "usr_7740" }\n  ]\n}';
  const HTML =
    '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <title>Acme Console</title>\n    <link rel="stylesheet" href="/assets/index-4f2a.css" />\n    ' +
    STAG +
    ' type="module" src="/assets/index-9c1b.js">' +
    ETAG +
    "\n  </head>\n  <body><div id=\"root\"></div></body>\n</html>";
  const CSS =
    ":root{--bg:#0b0b0f;--fg:#f5f5f7}\n.app-shell{display:grid;grid-template-columns:240px 1fr}\n.btn{border-radius:8px;padding:8px 14px;font:500 13px ui-sans-serif}";
  const JS =
    'import{r as e,j as t}from"./vendor-2e8d.js";\nconst o=e.createContext(null);\nexport function App(){return t.jsx("div",{className:"app-shell"})}';
  const ERR403 =
    '{\n  "error": {\n    "code": "forbidden",\n    "message": "You do not have access to members of this project.",\n    "request_id": "req_3f9a2c"\n  }\n}';
  const ERR500 =
    '{\n  "error": {\n    "code": "internal_error",\n    "message": "Unexpected error while aggregating usage.",\n    "request_id": "req_7b1e44"\n  }\n}';

  const acme: Flow[] = [
    mk({ method: "GET", status: 200, statusText: "OK", host: "app.acme.so", path: "/projects/proj_88", type: "document", mime: "text/html; charset=utf-8", size: 14620, time: 284, started: "10:02:14.213", initiator: "Other", rh: { host: "app.acme.so", path: "/projects/proj_88", method: "GET", accept: "text/html", cookie: true }, sh: { status: 200, ctype: "text/html; charset=utf-8", len: 14620, reqid: "req_aa01" }, reqBody: { kind: "none" }, respBody: { kind: "html", ctype: "text/html · 14.3 KB", text: HTML }, reqCookies: [{ name: "acme_session", value: "s%3Aa1b2c3d4e5", sensitive: true }, { name: "theme", value: "light" }], timing: tg({ conn: true, wait: 248, recv: 31 }) }),
    mk({ method: "GET", status: 200, statusText: "OK", host: "cdn.acme.so", path: "/assets/index-4f2a.css", type: "stylesheet", mime: "text/css", size: 90112, time: 96, started: "10:02:14.498", initiator: "(index):8", respBody: { kind: "css", ctype: "text/css · 88 KB", text: CSS }, timing: tg({ conn: true, wait: 54, recv: 18 }) }),
    mk({ method: "GET", status: 200, statusText: "OK", host: "cdn.acme.so", path: "/assets/index-9c1b.js", type: "script", mime: "application/javascript", size: 421888, time: 142, started: "10:02:14.502", initiator: "(index):9", respBody: { kind: "js", ctype: "application/javascript · 412 KB", text: JS }, timing: tg({ wait: 61, recv: 79 }) }),
    mk({ method: "GET", status: 200, statusText: "OK", host: "cdn.acme.so", path: "/assets/vendor-2e8d.js", type: "script", mime: "application/javascript", size: 1153434, time: 268, started: "10:02:14.512", initiator: "index-9c1b.js:1", respBody: { kind: "js", ctype: "application/javascript · 1.10 MB", text: "/* minified vendor bundle — react, react-dom, tanstack-query */" }, timing: tg({ wait: 71, recv: 195 }) }),
    mk({ method: "GET", status: 200, statusText: "OK", host: "cdn.acme.so", path: "/fonts/Inter-roman.var.woff2", type: "font", mime: "font/woff2", size: 49152, time: 48, started: "10:02:14.690", initiator: "index-4f2a.css:1", respBody: { kind: "font", ctype: "font/woff2 · 48 KB", note: "woff2 font · 48 KB" }, timing: tg({ wait: 22, recv: 24 }) }),
    mk({ method: "GET", status: 200, statusText: "OK", host: "api.acme.so", path: "/v1/me", type: "xhr", mime: "application/json", size: 412, time: 118, started: "10:02:14.901", initiator: "index-9c1b.js:1402", rh: { host: "api.acme.so", path: "/v1/me", method: "GET", accept: "application/json", auth: true, origin: true, cookie: true }, sh: { status: 200, ctype: "application/json", len: 412, cors: true, ratelimit: true, reqid: "req_b220" }, respBody: { kind: "json", ctype: "application/json · 412 B", text: ME }, reqCookies: [{ name: "acme_session", value: "s%3Aa1b2c3d4e5", sensitive: true }], timing: tg({ conn: true, wait: 74, recv: 9 }) }),
    mk({ method: "POST", status: 200, statusText: "OK", host: "api.acme.so", path: "/v1/auth/refresh", type: "fetch", mime: "application/json", size: 286, reqSize: 96, time: 134, started: "10:02:14.902", initiator: "index-9c1b.js:980", rh: { host: "api.acme.so", path: "/v1/auth/refresh", method: "POST", accept: "application/json", auth: true, origin: true, ctype: "application/json", cookie: true }, sh: { status: 200, ctype: "application/json", len: 286, cors: true, setcookie: true, reqid: "req_b221" }, reqBody: { kind: "json", ctype: "application/json · 96 B", text: '{ "refresh_token": "rt_8f2c…redacted" }' }, respBody: { kind: "json", ctype: "application/json · 286 B", text: '{\n  "access_token": "eyJ…",\n  "token_type": "Bearer",\n  "expires_in": 3600\n}' }, respCookies: [{ name: "acme_session", value: "s%3Af9e8d7", sensitive: true, domain: ".acme.so", path: "/", httpOnly: true, secure: true }], timing: tg({ wait: 118, recv: 8 }) }),
    mk({ method: "GET", status: 200, statusText: "OK", host: "api.acme.so", path: "/v1/projects?limit=20", type: "xhr", mime: "application/json", size: 684, time: 92, started: "10:02:15.040", initiator: "index-9c1b.js:1455", rh: { host: "api.acme.so", path: "/v1/projects?limit=20", method: "GET", accept: "application/json", auth: true, origin: true }, sh: { status: 200, ctype: "application/json", len: 684, cors: true, reqid: "req_b230" }, respBody: { kind: "json", ctype: "application/json · 684 B", text: PROJECTS }, timing: tg({ wait: 80, recv: 6 }) }),
    mk({ method: "GET", status: 200, statusText: "OK", host: "api.acme.so", path: "/v1/projects/proj_88/tasks", type: "xhr", mime: "application/json", size: 540, time: 104, started: "10:02:15.044", initiator: "index-9c1b.js:1460", rh: { host: "api.acme.so", path: "/v1/projects/proj_88/tasks", method: "GET", accept: "application/json", auth: true, origin: true }, sh: { status: 200, ctype: "application/json", len: 540, cors: true, reqid: "req_b231" }, respBody: { kind: "json", ctype: "application/json · 540 B", text: TASKS }, timing: tg({ wait: 92, recv: 7 }) }),
    mk({ method: "GET", status: 200, statusText: "OK", host: "cdn.acme.so", path: "/avatars/usr_9021.webp", type: "image", mime: "image/webp", size: 12480, time: 54, started: "10:02:15.210", initiator: "react-dom:441", respBody: { kind: "image", ctype: "image/webp · 12.2 KB", note: "image/webp · 96×96" }, timing: tg({ wait: 30, recv: 14 }) }),
    mk({ method: "GET", status: 304, statusText: "Not Modified", host: "cdn.acme.so", path: "/og/banner.png", type: "image", mime: "image/png", size: 0, time: 38, started: "10:02:15.215", initiator: "react-dom:512", respBody: { kind: "none" }, timing: tg({ wait: 36, recv: 0 }) }),
    mk({ method: "GET", status: 200, statusText: "OK", host: "cdn.acme.so", path: "/assets/logo.svg", type: "image", mime: "image/svg+xml", size: 2048, time: 32, started: "10:02:15.260", initiator: "index-9c1b.js:88", respBody: { kind: "text", ctype: "image/svg+xml · 2 KB", text: '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">\n  <rect width="32" height="32" rx="7" fill="#1d1d1f"/>\n  <path d="M9 22 16 9l7 13" stroke="#fff" stroke-width="2" fill="none"/>\n</svg>' }, timing: tg({ wait: 24, recv: 5 }) }),
    mk({ method: "GET", status: 200, statusText: "OK", host: "api.acme.so", path: "/v1/notifications?unread=1", type: "fetch", mime: "application/json", size: 128, time: 88, started: "10:02:15.420", initiator: "index-9c1b.js:1502", rh: { host: "api.acme.so", path: "/v1/notifications?unread=1", method: "GET", accept: "application/json", auth: true, origin: true }, sh: { status: 200, ctype: "application/json", len: 128, cors: true, reqid: "req_b240" }, respBody: { kind: "json", ctype: "application/json · 128 B", text: '{ "data": [], "unread_count": 0 }' }, timing: tg({ wait: 80, recv: 5 }) }),
    mk({ method: "GET", status: 101, statusText: "Switching Protocols", host: "api.acme.so", path: "/v1/realtime", type: "websocket", mime: "", size: 0, time: 0, started: "10:02:15.500", initiator: "index-9c1b.js:1610", rh: { host: "api.acme.so", path: "/v1/realtime", method: "GET", accept: "*/*", origin: true, cookie: true }, sh: { status: 101, ctype: "—", len: 0, enc: false, reqid: "req_b250" }, respBody: { kind: "none" }, timing: tg({ conn: true, wait: 0, recv: 0 }), protocol: "websocket" }),
    mk({ method: "POST", status: 204, statusText: "No Content", host: "api.acme.so", path: "/v1/events", type: "fetch", mime: "application/json", size: 0, reqSize: 240, time: 64, started: "10:02:15.700", initiator: "analytics.js:12", rh: { host: "api.acme.so", path: "/v1/events", method: "POST", accept: "*/*", origin: true, ctype: "application/json" }, sh: { status: 204, ctype: "—", len: 0, enc: false, cors: true, reqid: "req_b260" }, reqBody: { kind: "json", ctype: "application/json · 240 B", text: '{ "event": "page_view", "path": "/projects/proj_88", "ts": 1781 }' }, respBody: { kind: "none" }, timing: tg({ wait: 60, recv: 0 }) }),
    mk({ method: "POST", status: 201, statusText: "Created", host: "api.acme.so", path: "/v1/tasks", type: "fetch", mime: "application/json", size: 208, reqSize: 118, time: 156, started: "10:02:16.010", initiator: "index-9c1b.js:1721", rh: { host: "api.acme.so", path: "/v1/tasks", method: "POST", accept: "application/json", auth: true, origin: true, ctype: "application/json" }, sh: { status: 201, ctype: "application/json", len: 208, cors: true, reqid: "req_b270" }, reqBody: { kind: "json", ctype: "application/json · 118 B", text: '{\n  "project_id": "proj_88",\n  "title": "Review onboarding copy"\n}' }, respBody: { kind: "json", ctype: "application/json · 208 B", text: '{\n  "id": "tsk_5099",\n  "title": "Review onboarding copy",\n  "done": false\n}' }, timing: tg({ wait: 148, recv: 6 }) }),
    mk({ method: "GET", status: 403, statusText: "Forbidden", host: "api.acme.so", path: "/v1/projects/proj_88/members", type: "xhr", mime: "application/json", size: 172, time: 78, started: "10:02:16.220", initiator: "index-9c1b.js:1780", rh: { host: "api.acme.so", path: "/v1/projects/proj_88/members", method: "GET", accept: "application/json", auth: true, origin: true }, sh: { status: 403, ctype: "application/json", len: 172, cors: true, reqid: "req_3f9a2c" }, respBody: { kind: "json", ctype: "application/json · 172 B", text: ERR403 }, timing: tg({ wait: 72, recv: 4 }), error: "403 Forbidden" }),
    mk({ method: "GET", status: 500, statusText: "Internal Server Error", host: "api.acme.so", path: "/v1/billing/usage", type: "xhr", mime: "application/json", size: 158, time: 642, started: "10:02:16.400", initiator: "index-9c1b.js:1822", rh: { host: "api.acme.so", path: "/v1/billing/usage", method: "GET", accept: "application/json", auth: true, origin: true }, sh: { status: 500, ctype: "application/json", len: 158, cors: true, reqid: "req_7b1e44" }, respBody: { kind: "json", ctype: "application/json · 158 B", text: ERR500 }, timing: tg({ wait: 636, recv: 4 }), error: "500 Internal Server Error" }),
    mk({ method: "GET", status: null, host: "api.acme.so", path: "/v1/search?q=onboarding", type: "fetch", mime: "application/json", size: null, time: null, started: "10:02:16.900", initiator: "index-9c1b.js:1901", rh: { host: "api.acme.so", path: "/v1/search?q=onboarding", method: "GET", accept: "application/json", auth: true, origin: true }, reqBody: { kind: "none" }, respBody: { kind: "none" }, timing: tg({ wait: 0, recv: 0 }) }),
  ];

  const local: Flow[] = [
    mk({ method: "GET", status: 200, statusText: "OK", host: "localhost:3000", path: "/", type: "document", mime: "text/html", size: 512, time: 6, started: "11:14:02.001", initiator: "Other", protocol: "http/1.1", respBody: { kind: "html", ctype: "text/html · 512 B", text: '<!doctype html><html><body><div id="root"></div>' + STAG + ' type="module" src="/src/main.tsx">' + ETAG + "</body></html>" }, timing: tg({ conn: true, wait: 3, recv: 1 }) }),
    mk({ method: "GET", status: 200, statusText: "OK", host: "localhost:3000", path: "/@vite/client", type: "script", mime: "application/javascript", size: 18432, time: 8, started: "11:14:02.020", initiator: "(index)", protocol: "http/1.1", respBody: { kind: "js", ctype: "application/javascript · 18 KB", text: "// vite client — HMR runtime" }, timing: tg({ wait: 5, recv: 2 }) }),
    mk({ method: "GET", status: 200, statusText: "OK", host: "localhost:3000", path: "/src/main.tsx", type: "script", mime: "application/javascript", size: 2240, time: 11, started: "11:14:02.030", initiator: "(index)", protocol: "http/1.1", respBody: { kind: "js", ctype: "application/javascript · 2.2 KB", text: 'import { createRoot } from "react-dom/client"\nimport App from "./App"\ncreateRoot(document.getElementById("root")).render(<App/>)' }, timing: tg({ wait: 7, recv: 2 }) }),
    mk({ method: "GET", status: 101, statusText: "Switching Protocols", host: "localhost:3000", path: "/", type: "websocket", mime: "", size: 0, time: 0, started: "11:14:02.044", initiator: "@vite/client", protocol: "websocket", respBody: { kind: "none" }, timing: tg({ conn: true }) }),
    mk({ method: "GET", status: 200, statusText: "OK", host: "localhost:3000", path: "/api/health", type: "fetch", mime: "application/json", size: 34, time: 5, started: "11:14:02.210", initiator: "main.tsx:14", protocol: "http/1.1", respBody: { kind: "json", ctype: "application/json · 34 B", text: '{ "status": "ok" }' }, timing: tg({ wait: 3, recv: 1 }) }),
    mk({ method: "GET", status: 404, statusText: "Not Found", host: "localhost:3000", path: "/api/v2/flags", type: "fetch", mime: "application/json", size: 52, time: 4, started: "11:14:02.260", initiator: "main.tsx:22", protocol: "http/1.1", respBody: { kind: "json", ctype: "application/json · 52 B", text: '{ "error": "not_found" }' }, timing: tg({ wait: 3, recv: 1 }), error: "404 Not Found" }),
  ];

  return {
    defaultSel: acme[5].id,
    pages: [
      { id: "acme", name: "Acme Console", host: "app.acme.so", status: "capturing", letter: "A", color: "#1e66d0", flows: acme },
      { id: "admin", name: "Admin Dashboard", host: "admin.acme.so", status: "idle", letter: "A", color: "#b26b00", flows: [] },
      { id: "local", name: "localhost:3000", host: "Vite dev server", status: "capturing", letter: "L", color: "#30a14e", flows: local },
    ],
    apps: [
      { id: "chrome", name: "Google Chrome", bundle: "com.google.Chrome", path: "/Applications/Google Chrome.app", mode: "Normal launch", letter: "C", color: "#5b6470" },
      { id: "slack", name: "Slack", bundle: "com.tinyspeck.slackmacgap", path: "/Applications/Slack.app", mode: "System Proxy", letter: "S", color: "#7a5af0" },
      { id: "code", name: "Visual Studio Code", bundle: "com.microsoft.VSCode", path: "/Applications/Visual Studio Code.app", mode: "Normal launch", letter: "V", color: "#1e66d0" },
    ],
  };
}

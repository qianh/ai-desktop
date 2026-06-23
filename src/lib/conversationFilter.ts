import type { InterceptedFetch } from "../types";
import { joinConversationTextChunks } from "./normalizeConversationMarkdown";

const CONVERSATION_URL_PATTERNS = [
  /\/backend-api\/conversation/i,
  /\/backend-anon\/conversation/i,
  /\/api\/conversation/i,
  /\/api\/chat\/?$/i,
  /\/_serverFn\//i,
  /chat\.openai\.com.*conversation/i,
  /chatgpt\.com.*conversation/i,
  /chat\.worldwide-logistics\.cn\/api\/chat/i,
];

const NOISE_URL_PATTERNS = [
  /analytics/i,
  /\/ces\//i,
  /\/rgstr\//i,
  /\/v1\/metrics/i,
  /sentry/i,
  /\/ab\.(test|register)/i,
  /\/stream_status/i,
  /\/init\b/i,
  /\/experimental\//i,
  /\/conversation\/prepare/i,
  /\/beacons\//i,
];

export function urlPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url.split("?")[0];
  }
}

const CONVERSATION_ID_IN_PATH =
  /\/conversation\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

export function extractConversationIdFromUrl(url: string): string | null {
  const match = urlPath(url).match(CONVERSATION_ID_IN_PATH);
  return match?.[1] ?? null;
}

function conversationTitleFromJson(text: string | null): string | null {
  if (!text || !text.startsWith("{")) return null;
  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    if (typeof data.title === "string" && data.title.trim()) return data.title.trim();
  } catch {
    // not JSON
  }
  return null;
}

export function conversationTitleFromBodies(item: InterceptedFetch): string | null {
  return conversationTitleFromJson(item.resp_body) ?? conversationTitleFromJson(item.req_body);
}

/** GET /conversations (plural, list) — not a single chat round. */
function isConversationListPath(path: string): boolean {
  return /\/conversations\/?$/i.test(path);
}

/** POST send-message for built-in worldwide-logistics Chat (AI SDK /api/chat). */
function isApiChatPostPath(path: string): boolean {
  return /\/api\/chat\/?$/i.test(path);
}

/** TanStack Start server functions used by built-in Chat (actual path: /_serverFn/...). */
function isServerFnPath(path: string): boolean {
  return /\/_serverFn\//i.test(path);
}

function isServerFnAnalyticsBody(text: string): boolean {
  return /"eventId"/.test(text) && /"access"/.test(text) && !/"title"/.test(text);
}

/** Chat sidebar list — not a single conversation round. */
function isServerFnChatListBody(text: string): boolean {
  return /"k":\["items","nextCursor"\]/.test(text);
}

/** Config/auth/utility server-fn responses — not user chat. */
function isServerFnUtilityBody(text: string): boolean {
  if (/"k":\["authorized"\]/.test(text)) return true;
  if (/"k":\["allowThinkMode"/.test(text)) return true;
  if (/"t":1,"s":"inquire-quotation"/.test(text)) return true;
  if (/"k":\["result","error","context"\][^]*?"v":\[\{"t":2,"s":1\},\{"t":2,"s":1\}/.test(text)) {
    return true;
  }
  return false;
}

function isServerFnCursorOnlyBody(text: string): boolean {
  return /"k":\["cursor"\]/.test(text);
}

/** Single chat metadata: k=["id","userId","title",...], v=[uuid, userId, title, ...]. */
function isServerFnChatMetaBody(text: string): boolean {
  return /"k":\["id","userId","title"/.test(text) && !isServerFnChatListBody(text);
}

/** Message thread load: k=["id","chatId","parentId","role","parts",...]. */
function isServerFnMessageThreadBody(text: string): boolean {
  return /"k":\["id","chatId","parentId","role","parts"/.test(text);
}

function chatIdFromKeyedSeroval(text: string): string | null {
  const id = text.match(
    /"k":\["id","userId","title"[^]*?"v":\[\{"t":1,"s":"([0-9a-f-]{36})"/i,
  );
  return id?.[1] ?? null;
}

function previewFromKeyedSeroval(text: string): string | null {
  if (!isServerFnChatMetaBody(text)) return null;
  const title = text.match(
    /"k":\["id","userId","title"[^]*?"v":\[[^]*?\{"t":1,"s":"[0-9a-f-]{36}"\},\{"t":1,"s":"[^"]*"\},\{"t":1,"s":"([^"]{2,120})"/i,
  );
  return title?.[1] ?? null;
}

function chatIdFromMessageThreadSeroval(text: string): string | null {
  const chatId = text.match(
    /"k":\["id","chatId","parentId","role","parts"[^]*?"v":\[\{"t":1,"s":"[0-9a-f-]{36}"\},\{"t":1,"s":"([0-9a-f-]{36})"/i,
  );
  return chatId?.[1] ?? null;
}

function previewFromMessageThreadSeroval(text: string): string | null {
  if (!isServerFnMessageThreadBody(text)) return null;
  const users = userTextsFromMessageThreadSeroval(text);
  if (users.length) return users[users.length - 1];
  const assistant = assistantTextFromMessageThreadSeroval(text);
  return assistant ? assistant.slice(0, 200) : null;
}

function unescapeSerovalString(value: string): string {
  return value.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

function userTextsFromMessageThreadSeroval(text: string): string[] {
  if (!isServerFnMessageThreadBody(text)) return [];
  const users: string[] = [];
  const re =
    /"k":\["id","chatId","parentId","role","parts"[^]*?"v":\[[^]*?\{"t":1,"s":"user"\}[^]*?"k":\["text","type"\],"v":\[\{"t":1,"s":"([^"]+)"/gi;
  for (const match of text.matchAll(re)) {
    users.push(unescapeSerovalString(match[1]));
  }
  return users;
}

function assistantTextFromMessageThreadSeroval(text: string): string | null {
  if (!isServerFnMessageThreadBody(text)) return null;
  const chunks: string[] = [];
  const re =
    /"k":\["type","text","state"\],"v":\[\{"t":1,"s":"text"\},\{"t":1,"s":"((?:\\.|[^"\\])*)"\},\{"t":1,"s":"(?:done|streaming)"\}/g;
  for (const match of text.matchAll(re)) {
    const part = unescapeSerovalString(match[1]).trim();
    if (part) chunks.push(part);
  }
  const joined = joinConversationTextChunks(chunks).trim();
  return joined || null;
}

function parseServerFnConversationBodies(
  item: InterceptedFetch,
): { user: string | null; assistant: string | null } | null {
  const path = urlPath(item.url).toLowerCase();
  if (!isServerFnPath(path)) return null;

  const text = item.resp_body ?? item.req_body;
  if (!text) return null;

  if (isServerFnMessageThreadBody(text)) {
    const users = userTextsFromMessageThreadSeroval(text);
    return {
      user: users.length ? users.join("\n") : null,
      assistant: assistantTextFromMessageThreadSeroval(text),
    };
  }

  const title = previewFromKeyedSeroval(text);
  if (title) {
    return {
      user: null,
      assistant: `会话标题：${title}`,
    };
  }

  return null;
}

function hasServerFnChatSeroval(...bodies: Array<string | null | undefined>): boolean {
  for (const body of bodies) {
    if (!body || isServerFnAnalyticsBody(body) || isServerFnUtilityBody(body)) continue;
    if (isServerFnCursorOnlyBody(body) && !isServerFnChatMetaBody(body)) continue;
    if (isServerFnChatListBody(body)) continue;
    if (previewFromKeyedSeroval(body)) return true;
    if (isServerFnMessageThreadBody(body)) return true;
    if (isServerFnChatMetaBody(body) && chatIdFromKeyedSeroval(body)) return true;
  }
  return false;
}

export function previewFromServerFnSeroval(text: string | null | undefined): string | null {
  if (!text) return null;
  const keyed = previewFromKeyedSeroval(text);
  if (keyed) return keyed;
  const userMsg = previewFromMessageThreadSeroval(text);
  if (userMsg) return userMsg;
  return null;
}

function chatIdFromServerFnSeroval(text: string | null | undefined): string | null {
  if (!text) return null;
  const fromThread = chatIdFromMessageThreadSeroval(text);
  if (fromThread) return fromThread;
  const keyed = chatIdFromKeyedSeroval(text);
  if (keyed) return keyed;
  const chatId = text.match(/"chatId"[^}]*?"s":"([0-9a-f-]{36})"/i);
  if (chatId?.[1]) return chatId[1];
  return null;
}

/** Lean list rows may lack bodies; still show built-in Chat server-fn loads. */
export function isServerFnListRow(item: { url: string; method: string }): boolean {
  if (!isServerFnPath(urlPath(item.url).toLowerCase())) return false;
  if (item.method !== "GET" && item.method !== "POST") return false;
  return true;
}

type ConversationRowProbe = {
  url: string;
  method: string;
  req_body?: string | null;
  resp_body?: string | null;
};

function isServerFnChatRow(item: ConversationRowProbe): boolean {
  if (!isServerFnPath(urlPath(item.url).toLowerCase())) return false;
  return hasServerFnChatSeroval(item.req_body, item.resp_body);
}

/** ChatGPT internal protocol blobs — not user chat text */
const NOISE_BODY_PATTERNS = [
  /conversation_detail_metadata/i,
  /requested_default_model/i,
  /banner_info/i,
  /model_limits/i,
  /timezone_offset_min/i,
  /feature_name=/i,
];

function isNoiseBody(text: string | null | undefined): boolean {
  if (!text) return false;
  return NOISE_BODY_PATTERNS.some((p) => p.test(text));
}

function hasChatMessagesInJson(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.messages) && obj.messages.length > 0) return true;
  if (obj.mapping && typeof obj.mapping === "object") return true;
  return false;
}

/** Strict URL/method gate — only endpoints that may carry real chat content. */
export function isConversationUrlCandidate(item: { url: string; method: string }): boolean {
  const url = item.url.toLowerCase();
  if (NOISE_URL_PATTERNS.some((p) => p.test(url))) return false;

  const path = urlPath(item.url).toLowerCase();
  if (isConversationListPath(path)) return false;

  // POST send message — exact /conversation, not /conversation/prepare etc.
  if (item.method === "POST" && /\/backend-api\/conversation\/?$/i.test(path)) {
    return true;
  }

  if (item.method === "POST" && /\/backend-anon\/conversation\/?$/i.test(path)) {
    return true;
  }

  if (item.method === "POST" && /\/api\/conversation\/?$/i.test(path)) {
    return true;
  }

  if (item.method === "POST" && isApiChatPostPath(path)) {
    return true;
  }

  return false;
}

/** GET load of a single conversation by uuid — exact path only, not /textdocs or /stream_status. */
export function isConversationGetLoadRow(item: { url: string; method: string }): boolean {
  if (item.method !== "GET") return false;
  const url = item.url.toLowerCase();
  if (NOISE_URL_PATTERNS.some((p) => p.test(url))) return false;
  const path = urlPath(item.url).toLowerCase();
  if (isConversationListPath(path)) return false;
  return /\/backend-api\/conversation\/[0-9a-f-]{36}\/?$/i.test(path);
}

/** True for POST send-message endpoints (real chat round), not GET page loads. */
export function isConversationPostRow(item: { url: string; method: string }): boolean {
  if (item.method !== "POST") return false;
  const path = urlPath(item.url).toLowerCase();
  if (NOISE_URL_PATTERNS.some((p) => p.test(item.url.toLowerCase()))) return false;
  if (isConversationListPath(path)) return false;
  return (
    /\/backend-api\/conversation\/?$/i.test(path) ||
    /\/backend-anon\/conversation\/?$/i.test(path) ||
    /\/api\/conversation\/?$/i.test(path) ||
    isApiChatPostPath(path)
  );
}

/** List row: URL/method match is enough; bodies may be loaded on demand in the detail modal. */
export function isListableConversationRow(item: ConversationRowProbe): boolean {
  if (isServerFnChatRow(item)) return true;
  return isConversationPostRow(item) || isConversationGetLoadRow(item);
}

/** POST rows worth probing in phase 2 for body-heuristic conversation detection. */
export function isConversationBodyProbeCandidate(item: { url: string; method: string }): boolean {
  if (item.method !== "POST") return false;
  const url = item.url.toLowerCase();
  if (NOISE_URL_PATTERNS.some((p) => p.test(url))) return false;
  return !isConversationUrlCandidate(item);
}

export function isConversationIntercept(item: InterceptedFetch): boolean {
  const url = item.url.toLowerCase();
  if (NOISE_URL_PATTERNS.some((p) => p.test(url))) return false;
  if (isNoiseBody(item.req_body) || isNoiseBody(item.resp_body)) return false;

  const req = item.req_body || "";
  const resp = item.resp_body || "";

  const path = urlPath(item.url).toLowerCase();

  if (isServerFnPath(path) && hasServerFnChatSeroval(req, resp)) {
    return true;
  }

  if (item.method === "POST" && isApiChatPostPath(path)) {
    if (req.startsWith("{")) {
      try {
        if (hasChatMessagesInJson(JSON.parse(req))) return true;
      } catch {
        // not JSON chat payload
      }
    }
    if (req.includes('"messages"') && (req.includes('"role"') || req.includes('"content"'))) {
      return true;
    }
    if (resp.includes("data:") && resp.includes("{")) return true;
  }

  // Real chat round: POST send message (JSON) + SSE reply, or GET conversation with mapping
  if (item.method === "POST" && /\/backend-api\/conversation\/?$/i.test(url.split("?")[0])) {
    if (req.startsWith("{") && req.includes('"messages"')) {
      try {
        return hasChatMessagesInJson(JSON.parse(req));
      } catch {
        return false;
      }
    }
    if (resp.includes("data:") && resp.includes("{")) return true;
  }

  if (
    item.method === "GET" &&
    /\/backend-api\/conversations?\/[0-9a-f-]{8,}/i.test(url.split("?")[0])
  ) {
    if (resp.startsWith("{") && resp.includes('"mapping"')) return true;
  }

  if (CONVERSATION_URL_PATTERNS.some((p) => p.test(url))) {
    if (req.startsWith("{")) {
      try {
        if (hasChatMessagesInJson(JSON.parse(req))) return true;
      } catch {
        // not JSON chat payload
      }
    }
    if (resp.includes("data:") && resp.includes("{")) return true;
    if (resp.startsWith("{") && resp.includes('"mapping"')) return true;
  }

  if (item.method !== "POST") return false;
  if (!req.includes('"messages"')) return false;
  return req.includes('"role"') || req.includes("content_type") || req.includes('"author"');
}

export function isParsedChatText(item: InterceptedFetch): boolean {
  const { user, assistant } = parseConversationBodies(item);
  return Boolean(user || assistant);
}

function messageRole(msg: Record<string, unknown>): string | null {
  if (typeof msg.role === "string") return msg.role;
  const author = msg.author;
  if (author && typeof author === "object" && typeof (author as Record<string, unknown>).role === "string") {
    return (author as Record<string, unknown>).role as string;
  }
  return null;
}

function extractTextFromPart(part: unknown): string {
  if (typeof part === "string") return part;
  if (!part || typeof part !== "object") return "";
  const obj = part as Record<string, unknown>;
  if (typeof obj.text === "string") return obj.text;
  if (typeof obj.value === "string") return obj.value;
  return "";
}

function extractTextFromContent(content: unknown): string | null {
  if (content == null) return null;
  if (typeof content === "string") return content.trim() || null;
  if (typeof content !== "object") return null;

  const obj = content as Record<string, unknown>;
  if (typeof obj.text === "string") return obj.text.trim() || null;
  if (Array.isArray(obj.parts)) {
    const text = obj.parts.map(extractTextFromPart).join("\n").trim();
    return text || null;
  }
  return null;
}

function extractTextFromMessage(message: unknown): string | null {
  if (!message || typeof message !== "object") return null;
  const record = message as Record<string, unknown>;
  const fromContent = extractTextFromContent(record.content);
  if (fromContent) return fromContent;
  if (typeof record.text === "string" && record.text.trim()) return record.text.trim();
  return null;
}

function lastMessageFromArray(messages: unknown[], role: string): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (!msg || typeof msg !== "object") continue;
    const record = msg as Record<string, unknown>;
    if (messageRole(record) !== role) continue;
    const text = extractTextFromMessage(msg);
    if (text) return text;
  }
  return null;
}

function pairFromCurrentNode(data: Record<string, unknown>): {
  user: string | null;
  assistant: string | null;
} {
  const mapping = data.mapping;
  const currentNode = data.current_node;
  if (!mapping || typeof mapping !== "object" || typeof currentNode !== "string") {
    return { user: null, assistant: null };
  }

  const map = mapping as Record<string, Record<string, unknown>>;
  let user: string | null = null;
  let assistant: string | null = null;
  let nodeId: string | null = currentNode;

  while (nodeId) {
    const node: Record<string, unknown> | undefined = map[nodeId];
    if (!node) break;
    const message = node.message;
    if (message && typeof message === "object") {
      const record = message as Record<string, unknown>;
      const role = messageRole(record);
      const text = extractTextFromMessage(message);
      if (text) {
        if (role === "assistant" && !assistant) assistant = text;
        if (role === "user" && !user) user = text;
      }
    }
    if (user && assistant) break;
    nodeId = typeof node.parent === "string" ? node.parent : null;
  }

  return { user, assistant };
}

function messagesFromMapping(data: Record<string, unknown>): {
  user: string | null;
  assistant: string | null;
} {
  const fromCurrent = pairFromCurrentNode(data);
  if (fromCurrent.user || fromCurrent.assistant) return fromCurrent;

  const mapping = data.mapping;
  if (!mapping || typeof mapping !== "object") return { user: null, assistant: null };

  const entries: Array<{ role: string; text: string; time: number }> = [];
  for (const node of Object.values(mapping as Record<string, unknown>)) {
    if (!node || typeof node !== "object") continue;
    const message = (node as Record<string, unknown>).message;
    if (!message || typeof message !== "object") continue;
    const record = message as Record<string, unknown>;
    const role = messageRole(record);
    const text = extractTextFromMessage(message);
    const time = typeof record.create_time === "number" ? record.create_time : 0;
    if (role && text) entries.push({ role, text, time });
  }
  entries.sort((a, b) => a.time - b.time);
  const users = entries.filter((e) => e.role === "user");
  const assistants = entries.filter((e) => e.role === "assistant");
  return {
    user: users.length ? users[users.length - 1].text : null,
    assistant: assistants.length ? assistants[assistants.length - 1].text : null,
  };
}

function pairFromJson(data: unknown): { user: string | null; assistant: string | null } {
  if (!data || typeof data !== "object") return { user: null, assistant: null };
  const obj = data as Record<string, unknown>;

  if (obj.mapping && typeof obj.mapping === "object") {
    return messagesFromMapping(obj);
  }

  const messages = obj.messages;
  if (Array.isArray(messages)) {
    return {
      user: lastMessageFromArray(messages, "user"),
      assistant: lastMessageFromArray(messages, "assistant"),
    };
  }

  return { user: null, assistant: null };
}

function lastUserMessageFromJson(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  const messages = obj.messages;
  if (Array.isArray(messages)) return lastMessageFromArray(messages, "user");
  const fromMapping = messagesFromMapping(obj);
  return fromMapping.user;
}

function collectSseAppend(value: unknown, chunks: string[]): void {
  if (typeof value === "string") {
    chunks.push(value);
    return;
  }
  if (!value || typeof value !== "object") return;
  const obj = value as Record<string, unknown>;
  if (obj.o === "append" && typeof obj.v === "string") {
    chunks.push(obj.v);
    return;
  }
  if (Array.isArray(obj.v)) {
    for (const item of obj.v) collectSseAppend(item, chunks);
    return;
  }
  const vText = extractTextFromContent(obj.v);
  if (vText) chunks.push(vText);
  const nested = extractTextFromContent((obj.v as Record<string, unknown> | undefined)?.message);
  if (nested) chunks.push(nested);
}

function assistantFromSse(text: string): string | null {
  const chunks: string[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const data = JSON.parse(payload) as Record<string, unknown>;
      if (data.o === "append" || data.o === "patch") {
        collectSseAppend(data, chunks);
        continue;
      }
      const message = data.message as Record<string, unknown> | undefined;
      if (message) {
        const role = messageRole(message);
        if (role && role !== "assistant") continue;
        const part = extractTextFromContent(message.content);
        if (part) chunks.push(part);
      }
      const delta = data.delta as Record<string, unknown> | undefined;
      const deltaText = extractTextFromContent(delta?.content);
      if (deltaText) chunks.push(deltaText);
      const v = data.v;
      if (typeof v === "string") chunks.push(v);
      else if (v && typeof v === "object") {
        const vText = extractTextFromContent((v as Record<string, unknown>).message);
        if (vText) chunks.push(vText);
      }
    } catch {
      // ignore malformed SSE lines
    }
  }
  const joined = chunks.join("").trim();
  return joined || null;
}

function assistantFromJson(data: unknown): string | null {
  const pair = pairFromJson(data);
  if (pair.assistant) return pair.assistant;

  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;

  const direct = extractTextFromContent(obj.content);
  if (direct) return direct;

  const message = obj.message as Record<string, unknown> | undefined;
  const fromMessage = extractTextFromMessage(message);
  if (fromMessage) return fromMessage;

  const choices = obj.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const choice = choices[choices.length - 1] as Record<string, unknown>;
    const delta = choice.delta as Record<string, unknown> | undefined;
    const deltaText = extractTextFromContent(delta?.content);
    if (deltaText) return deltaText;
    const msg = choice.message as Record<string, unknown> | undefined;
    const msgText = extractTextFromMessage(msg);
    if (msgText) return msgText;
  }
  return null;
}

export function parseConversationBodies(item: InterceptedFetch): {
  user: string | null;
  assistant: string | null;
  rawReq: string | null;
  rawResp: string | null;
} {
  let user: string | null = null;
  let assistant: string | null = null;
  let rawReq: string | null = null;
  let rawResp: string | null = null;

  if (item.req_body) {
    try {
      const parsed = JSON.parse(item.req_body);
      user = lastUserMessageFromJson(parsed);
      if (!user) {
        const pair = pairFromJson(parsed);
        user = pair.user;
      }
    } catch {
      if (!isNoiseBody(item.req_body)) {
        rawReq = item.req_body.length <= 2000 ? item.req_body : item.req_body.slice(0, 2000) + "…";
      }
    }
  }

  if (item.resp_body) {
    const body = item.resp_body;
    if (body.includes("data:") && body.includes("{")) {
      assistant = assistantFromSse(body);
    }
    if (!assistant || !user) {
      try {
        const parsed = JSON.parse(body);
        const pair = pairFromJson(parsed);
        if (!user && pair.user) user = pair.user;
        if (!assistant && pair.assistant) assistant = pair.assistant;
        if (!assistant) assistant = assistantFromJson(parsed);
      } catch {
        const seroval = parseServerFnConversationBodies(item);
        if (seroval) {
          if (!user && seroval.user) user = seroval.user;
          if (!assistant && seroval.assistant) assistant = seroval.assistant;
        } else if (!assistant && !isNoiseBody(body)) {
          rawResp = body.length <= 4000 ? body : body.slice(0, 4000) + "…";
        }
      }
    }
  }

  if (!user && !assistant && !rawReq && !rawResp) {
    const seroval = parseServerFnConversationBodies(item);
    if (seroval) {
      user = seroval.user;
      assistant = seroval.assistant;
    }
  }

  return { user, assistant, rawReq, rawResp };
}

/** Fast list preview from URL/method only — no req/resp bodies required. */
export function conversationMetadataPreview(item: { url: string; method: string }): string {
  const url = item.url;
  if (item.method === "POST" && /\/backend-api\/conversation\/?$/i.test(url.split("?")[0])) {
    return "发送对话消息";
  }
  if (item.method === "POST" && isApiChatPostPath(urlPath(url).toLowerCase())) {
    return "发送对话消息";
  }
  if (isServerFnPath(urlPath(url).toLowerCase())) {
    return "内置 Chat 对话";
  }
  if (item.method === "GET" && /\/backend-api\/conversations?\/[0-9a-f-]{8,}/i.test(url.split("?")[0])) {
    return "加载对话记录";
  }
  if (/\/backend-api\/conversation/i.test(url)) return "对话 API 请求";
  if (/chatgpt\.com|chat\.openai\.com/i.test(url) && /conversation/i.test(url)) {
    return "ChatGPT 对话请求";
  }
  try {
    const path = new URL(url).pathname;
    const segment = path.split("/").filter(Boolean).pop();
    if (segment) return `${item.method} · ${segment}`;
  } catch {
    // ignore invalid URL
  }
  return `${item.method} 请求`;
}

export type InterceptStorageMeta = {
  isConversation: boolean;
  previewText: string | null;
  conversationId: string | null;
};

function conversationIdFromIntercept(item: InterceptedFetch): string | null {
  const fromUrl = extractConversationIdFromUrl(item.url);
  if (fromUrl) return fromUrl;
  const fromSeroval =
    chatIdFromServerFnSeroval(item.resp_body) ?? chatIdFromServerFnSeroval(item.req_body);
  if (fromSeroval) return fromSeroval;
  if (!item.req_body?.startsWith("{")) return null;
  try {
    const data = JSON.parse(item.req_body) as Record<string, unknown>;
    if (typeof data.conversation_id === "string" && data.conversation_id) {
      return data.conversation_id;
    }
    if (typeof data.chatId === "string" && data.chatId) {
      return data.chatId;
    }
    if (typeof data.id === "string" && data.id) {
      return data.id;
    }
  } catch {
    // ignore invalid JSON
  }
  return null;
}

/** Classify an intercept at upload time for indexed Supabase list queries. */
export function classifyInterceptForStorage(item: InterceptedFetch): InterceptStorageMeta {
  const conversationId = conversationIdFromIntercept(item);

  if (!isListableConversationRow(item)) {
    return { isConversation: false, previewText: null, conversationId };
  }

  const isGetLoad = isConversationGetLoadRow(item);

  if (!isGetLoad && !isConversationIntercept(item)) {
    return { isConversation: false, previewText: null, conversationId };
  }

  if (isGetLoad && (item.req_body || item.resp_body) && !isConversationIntercept(item)) {
    return { isConversation: false, previewText: null, conversationId };
  }

  const serovalPreview =
    previewFromServerFnSeroval(item.resp_body) ?? previewFromServerFnSeroval(item.req_body);
  const resolvedConversationId = conversationId ?? conversationIdFromIntercept(item);

  const { user, assistant, rawReq, rawResp } = parseConversationBodies(item);
  if (!user && !assistant && !rawReq && !rawResp) {
    if (isGetLoad || serovalPreview) {
      const preview =
        serovalPreview ??
        conversationTitleFromBodies(item) ??
        conversationMetadataPreview(item);
      const previewText = preview.length > 120 ? `${preview.slice(0, 120)}…` : preview;
      return { isConversation: true, previewText, conversationId: resolvedConversationId };
    }
    return { isConversation: false, previewText: null, conversationId: resolvedConversationId };
  }

  const title = conversationTitleFromBodies(item);
  const preview =
    serovalPreview ?? title ?? user ?? assistant ?? conversationMetadataPreview(item);
  const previewText = preview.length > 120 ? `${preview.slice(0, 120)}…` : preview;

  return { isConversation: true, previewText, conversationId: resolvedConversationId };
}

export function conversationPreview(item: InterceptedFetch): string {
  const stored = item.preview_text?.trim();
  if (stored) return stored.length > 80 ? stored.slice(0, 80) + "…" : stored;

  if (item.req_body || item.resp_body) {
    const title = conversationTitleFromBodies(item);
    if (title) return title.length > 80 ? title.slice(0, 80) + "…" : title;

    const { user, assistant } = parseConversationBodies(item);
    const text = user || assistant;
    if (text) return text.length > 80 ? text.slice(0, 80) + "…" : text;
    if (!item.req_body && !item.resp_body) return "（无请求/响应 body）";
    return "（body 已上报，解析中…）";
  }
  return conversationMetadataPreview(item);
}

export function conversationIdForRow(row: InterceptedFetch): string | null {
  if (row.conversation_id) return row.conversation_id;
  return conversationIdFromIntercept(row);
}

function isServerFnChatMetaRow(row: InterceptedFetch): boolean {
  const text = row.resp_body ?? row.req_body;
  return Boolean(text && isServerFnChatMetaBody(text) && previewFromKeyedSeroval(text));
}

export function isServerFnMessageThreadRow(row: InterceptedFetch): boolean {
  const text = row.resp_body ?? row.req_body;
  return Boolean(text && isServerFnMessageThreadBody(text));
}

export type ConversationMessage = { role: "user" | "assistant"; text: string };

export function messagesFromIntercept(item: InterceptedFetch): ConversationMessage[] {
  const text = item.resp_body ?? item.req_body ?? "";
  if (isServerFnMessageThreadBody(text)) {
    const users = userTextsFromMessageThreadSeroval(text);
    const assistant = assistantTextFromMessageThreadSeroval(text);
    const out: ConversationMessage[] = users.map((u) => ({ role: "user", text: u }));
    if (assistant) out.push({ role: "assistant", text: assistant });
    return out;
  }

  const { user, assistant } = parseConversationBodies(item);
  const out: ConversationMessage[] = [];
  if (user) out.push({ role: "user", text: user });
  if (assistant && !assistant.startsWith("会话标题：")) {
    out.push({ role: "assistant", text: assistant });
  }
  return out;
}

export function aggregateConversationMessages(rows: InterceptedFetch[]): ConversationMessage[] {
  const sorted = [...rows].sort((a, b) => a.timestamp - b.timestamp);
  const messages: ConversationMessage[] = [];
  const seen = new Set<string>();

  for (const row of sorted) {
    const rowMessages = messagesFromIntercept(row);
    for (let index = 0; index < rowMessages.length; index++) {
      const msg = rowMessages[index];
      const key = `${row.id}:${index}`;
      if (seen.has(key)) continue;
      seen.add(key);
      messages.push(msg);
    }
  }
  return messages;
}

export function isTitleOnlyConversation(item: InterceptedFetch): boolean {
  const { user, assistant } = parseConversationBodies(item);
  return !user && Boolean(assistant?.startsWith("会话标题："));
}

function conversationRowRank(row: InterceptedFetch): number {
  if (isConversationPostRow(row)) return 4;
  if (isServerFnMessageThreadRow(row)) return 3;
  if (isConversationGetLoadRow(row)) return 2;
  if (isServerFnChatMetaRow(row)) return 1;
  return 1;
}

function preferConversationRow(existing: InterceptedFetch, incoming: InterceptedFetch): InterceptedFetch {
  const existingRank = conversationRowRank(existing);
  const incomingRank = conversationRowRank(incoming);
  if (existingRank !== incomingRank) return existingRank > incomingRank ? existing : incoming;
  return existing.timestamp >= incoming.timestamp ? existing : incoming;
}

/** Keep the latest intercept per conversation id; prefer POST over GET for the same chat. */
export function dedupeConversationRows(rows: InterceptedFetch[]): InterceptedFetch[] {
  const keyed = new Map<string, InterceptedFetch>();
  const rest: InterceptedFetch[] = [];

  for (const row of rows) {
    const conversationId = conversationIdForRow(row);
    if (!conversationId) {
      rest.push(row);
      continue;
    }
    const prev = keyed.get(conversationId);
    keyed.set(conversationId, prev ? preferConversationRow(prev, row) : row);
  }

  return [...keyed.values(), ...rest].sort((a, b) => b.timestamp - a.timestamp);
}
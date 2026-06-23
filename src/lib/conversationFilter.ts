import type { InterceptedFetch } from "../types";

const CONVERSATION_URL_PATTERNS = [
  /\/backend-api\/conversation/i,
  /\/backend-anon\/conversation/i,
  /\/api\/conversation/i,
  /chat\.openai\.com.*conversation/i,
  /chatgpt\.com.*conversation/i,
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
];

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

export function isConversationIntercept(item: InterceptedFetch): boolean {
  const url = item.url.toLowerCase();
  if (NOISE_URL_PATTERNS.some((p) => p.test(url))) return false;
  if (isNoiseBody(item.req_body) || isNoiseBody(item.resp_body)) return false;

  const req = item.req_body || "";
  const resp = item.resp_body || "";

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
        if (!assistant && !isNoiseBody(body)) {
          rawResp = body.length <= 4000 ? body : body.slice(0, 4000) + "…";
        }
      }
    }
  }

  return { user, assistant, rawReq, rawResp };
}

export function conversationPreview(item: InterceptedFetch): string {
  const { user, assistant } = parseConversationBodies(item);
  const text = user || assistant;
  if (text) return text.length > 80 ? text.slice(0, 80) + "…" : text;
  if (!item.req_body && !item.resp_body) return "（无请求/响应 body）";
  return "（body 已上报，解析中…）";
}
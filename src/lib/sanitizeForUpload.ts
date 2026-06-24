import type { InterceptedFetch } from "../types";

export const BINARY_BODY_PLACEHOLDER = "[binary body omitted]";

export function stripNullBytes(value: string): string {
  return value.includes("\0") ? value.replace(/\0/g, "") : value;
}

export function isLikelyBinaryText(value: string): boolean {
  if (!value) return false;
  if (value.charCodeAt(0) === 0x1f && value.charCodeAt(1) === 0x8b) return true;
  if (value.length < 8) return false;

  const sample = value.slice(0, 512);
  let nonPrintable = 0;
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
      nonPrintable++;
    }
  }
  return nonPrintable > sample.length * 0.1;
}

export function sanitizePostgresText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const stripped = stripNullBytes(value);
  if (isLikelyBinaryText(stripped)) return BINARY_BODY_PLACEHOLDER;
  return stripped;
}

export function sanitizeHeadersForUpload(
  headers: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    out[stripNullBytes(key)] = stripNullBytes(value);
  }
  return out;
}

export function sanitizeInterceptForUpload(item: InterceptedFetch): InterceptedFetch {
  return {
    ...item,
    url: stripNullBytes(item.url),
    method: stripNullBytes(item.method),
    req_body: sanitizePostgresText(item.req_body),
    resp_body: sanitizePostgresText(item.resp_body),
    req_headers: sanitizeHeadersForUpload(item.req_headers ?? {}),
    resp_headers: sanitizeHeadersForUpload(item.resp_headers ?? {}),
    error: sanitizePostgresText(item.error) ?? undefined,
    preview_text: sanitizePostgresText(item.preview_text),
    conversation_id: sanitizePostgresText(item.conversation_id),
  };
}
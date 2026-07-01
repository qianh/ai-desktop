import type {
  ChatMessage,
  ChatMessageUpdated,
  ChatStreamChunk,
  ChatThread,
} from "../types/chat";

export function applyStreamChunk(
  messages: ChatMessage[],
  chunk: ChatStreamChunk,
): ChatMessage[] {
  return messages.map((m) =>
    m.id === chunk.message_id
      ? { ...m, content: m.content + chunk.delta, status: "streaming" }
      : m,
  );
}

export function applyMessageUpdated(
  messages: ChatMessage[],
  update: ChatMessageUpdated,
): ChatMessage[] {
  return messages.map((m) =>
    m.id === update.message_id
      ? {
          ...m,
          status: update.status,
          content: update.content || m.content,
          error_message: update.error_message,
        }
      : m,
  );
}

export function mergeSendResponse(
  messages: ChatMessage[],
  response: { user_message: ChatMessage; assistant_message: ChatMessage },
): ChatMessage[] {
  return [...messages, response.user_message, response.assistant_message];
}

export function applyThreadUpdated(
  threads: ChatThread[],
  updated: ChatThread,
): ChatThread[] {
  const idx = threads.findIndex((t) => t.id === updated.id);
  if (idx < 0) return [updated, ...threads];
  const next = [...threads];
  next[idx] = updated;
  return next.sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

export function resolveActiveThreadAfterDelete(
  activeThreadId: string,
  deletedThreadId: string,
  threads: ChatThread[],
): { nextActiveId: string; remaining: ChatThread[] } {
  const remaining = threads.filter((t) => t.id !== deletedThreadId);
  if (activeThreadId !== deletedThreadId) {
    return { nextActiveId: activeThreadId, remaining };
  }
  return { nextActiveId: remaining[0]?.id ?? "", remaining };
}
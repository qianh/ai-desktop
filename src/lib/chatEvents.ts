import type { ChatMessage, ChatMessageUpdated, ChatStreamChunk } from "../types/chat";

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
import { invoke } from "@tauri-apps/api/core";
import type {
  ChatMemoryEntry,
  ChatMessage,
  ChatProviderProfile,
  ChatThread,
  CodexTaskPreview,
  SendChatMessageResponse,
} from "./types/chat";

function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  return invoke<T>(command, args);
}

export function listChatProviderProfiles(): Promise<ChatProviderProfile[]> {
  return call("list_chat_provider_profiles");
}

export function saveChatProviderProfile(
  profile: ChatProviderProfile,
): Promise<ChatProviderProfile> {
  return call("save_chat_provider_profile", { profile });
}

export function listChatThreads(): Promise<ChatThread[]> {
  return call("list_chat_threads");
}

export function createChatThread(
  title?: string,
  providerProfileId?: string,
): Promise<ChatThread> {
  return call("create_chat_thread", {
    title: title ?? null,
    providerProfileId: providerProfileId ?? null,
  });
}

export function renameChatThread(threadId: string, title: string): Promise<ChatThread> {
  return call("rename_chat_thread", { threadId, title });
}

export function deleteChatThread(threadId: string): Promise<void> {
  return call("delete_chat_thread", { threadId });
}

export function listChatMessages(threadId: string): Promise<ChatMessage[]> {
  return call("list_chat_messages", { threadId });
}

export function sendChatMessage(
  threadId: string,
  content: string,
  providerProfileId?: string,
): Promise<SendChatMessageResponse> {
  return call("send_chat_message", {
    threadId,
    content,
    providerProfileId: providerProfileId ?? null,
  });
}

export function confirmCodexTask(messageId: string): Promise<ChatMessage> {
  return call("confirm_codex_task", { messageId });
}

export function cancelCodexTask(messageId: string): Promise<ChatMessage> {
  return call("cancel_codex_task", { messageId });
}

export function listChatMemoryEntries(): Promise<ChatMemoryEntry[]> {
  return call("list_chat_memory_entries");
}

export function saveChatMemoryEntry(
  content: string,
  id?: string,
): Promise<ChatMemoryEntry> {
  return call("save_chat_memory_entry", { content, id: id ?? null });
}

export function deleteChatMemoryEntry(entryId: string): Promise<void> {
  return call("delete_chat_memory_entry", { entryId });
}

export function previewCodexTask(
  threadId: string,
  content: string,
): Promise<CodexTaskPreview> {
  return call("preview_codex_task_command", { threadId, content });
}
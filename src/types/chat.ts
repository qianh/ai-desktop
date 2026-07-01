export interface ChatProviderProfile {
  id: string;
  display_name: string;
  kind: "api" | "codex_cli" | string;
  api_key: string | null;
  base_url: string | null;
  default_model: string | null;
  codex_path: string | null;
  codex_extra_args_json: string;
  enabled: boolean;
  updated_at: string;
}

export interface ChatThread {
  id: string;
  title: string;
  provider_profile_id: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  thread_id: string;
  role: "user" | "assistant" | "system" | string;
  content: string;
  status: "complete" | "streaming" | "loading" | "error" | "awaiting_confirmation" | string;
  provider_profile_id: string | null;
  error_message: string | null;
  metadata_json: string;
  created_at: string;
}

export interface ChatMemoryEntry {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface CodexTaskPreview {
  command_summary: string;
  workdir: string;
  risk_summary: string;
  prompt: string;
}

export interface SendChatMessageResponse {
  user_message: ChatMessage;
  assistant_message: ChatMessage;
  codex_preview: CodexTaskPreview | null;
}

export interface ChatStreamChunk {
  message_id: string;
  delta: string;
}

export interface ChatMessageUpdated {
  message_id: string;
  status: string;
  content: string;
  error_message: string | null;
}

export type ChatThreadUpdated = ChatThread;
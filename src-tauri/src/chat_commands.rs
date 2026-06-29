//! App Chat Tauri commands.

use crate::chat_providers::api::{stream_api_completion, ChatMessageUpdated};
use crate::chat_providers::codex::{
    preview_codex_task, run_codex_task, CodexRunResult, CodexTaskPreview, ProcessCodexRunner,
};
use crate::commands::with_state;
use crate::models::{
    ChatMemoryEntry, ChatMessage, ChatProviderProfile, ChatTaskAudit, ChatThread,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatProviderProfileDto {
    pub id: String,
    pub display_name: String,
    pub kind: String,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub default_model: Option<String>,
    pub codex_path: Option<String>,
    pub codex_extra_args_json: String,
    pub enabled: bool,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ChatThreadDto {
    pub id: String,
    pub title: String,
    pub provider_profile_id: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ChatMessageDto {
    pub id: String,
    pub thread_id: String,
    pub role: String,
    pub content: String,
    pub status: String,
    pub provider_profile_id: Option<String>,
    pub error_message: Option<String>,
    pub metadata_json: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ChatMemoryEntryDto {
    pub id: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SendChatMessageResponse {
    pub user_message: ChatMessageDto,
    pub assistant_message: ChatMessageDto,
    pub codex_preview: Option<CodexTaskPreview>,
}

#[derive(Debug, Clone)]
struct PendingCodexTask {
    thread_id: String,
    prompt: String,
    provider_profile_id: String,
}

static PENDING_CODEX: OnceLock<Mutex<HashMap<String, PendingCodexTask>>> = OnceLock::new();

fn pending_codex() -> &'static Mutex<HashMap<String, PendingCodexTask>> {
    PENDING_CODEX.get_or_init(|| Mutex::new(HashMap::new()))
}

fn to_provider_dto(p: ChatProviderProfile) -> ChatProviderProfileDto {
    ChatProviderProfileDto {
        id: p.id,
        display_name: p.display_name,
        kind: p.kind,
        api_key: p.api_key,
        base_url: p.base_url,
        default_model: p.default_model,
        codex_path: p.codex_path,
        codex_extra_args_json: p.codex_extra_args_json,
        enabled: p.enabled,
        updated_at: p.updated_at.to_rfc3339(),
    }
}

fn to_thread_dto(t: ChatThread) -> ChatThreadDto {
    ChatThreadDto {
        id: t.id,
        title: t.title,
        provider_profile_id: t.provider_profile_id,
        created_at: t.created_at.to_rfc3339(),
        updated_at: t.updated_at.to_rfc3339(),
    }
}

fn to_message_dto(m: ChatMessage) -> ChatMessageDto {
    ChatMessageDto {
        id: m.id,
        thread_id: m.thread_id,
        role: m.role,
        content: m.content,
        status: m.status,
        provider_profile_id: m.provider_profile_id,
        error_message: m.error_message,
        metadata_json: m.metadata_json,
        created_at: m.created_at.to_rfc3339(),
    }
}

fn to_memory_dto(m: ChatMemoryEntry) -> ChatMemoryEntryDto {
    ChatMemoryEntryDto {
        id: m.id,
        content: m.content,
        created_at: m.created_at.to_rfc3339(),
        updated_at: m.updated_at.to_rfc3339(),
    }
}

fn emit_message_updated(app: &AppHandle, message: &ChatMessage) {
    let _ = app.emit(
        "chat-message-updated",
        ChatMessageUpdated {
            message_id: message.id.clone(),
            status: message.status.clone(),
            content: message.content.clone(),
            error_message: message.error_message.clone(),
        },
    );
}

#[tauri::command]
pub fn list_chat_provider_profiles() -> Result<Vec<ChatProviderProfileDto>, String> {
    with_state(|state| {
        Ok(state
            .store
            .list_chat_provider_profiles()?
            .into_iter()
            .map(to_provider_dto)
            .collect())
    })
}

#[tauri::command]
pub fn save_chat_provider_profile(profile: ChatProviderProfileDto) -> Result<ChatProviderProfileDto, String> {
    with_state(|state| {
        let model = ChatProviderProfile {
            id: profile.id,
            display_name: profile.display_name,
            kind: profile.kind,
            api_key: profile.api_key,
            base_url: profile.base_url,
            default_model: profile.default_model,
            codex_path: profile.codex_path,
            codex_extra_args_json: profile.codex_extra_args_json,
            enabled: profile.enabled,
            updated_at: Utc::now(),
        };
        state.store.save_chat_provider_profile(&model)?;
        Ok(to_provider_dto(model))
    })
}

#[tauri::command]
pub fn list_chat_threads() -> Result<Vec<ChatThreadDto>, String> {
    with_state(|state| {
        Ok(state
            .store
            .list_chat_threads()?
            .into_iter()
            .map(to_thread_dto)
            .collect())
    })
}

#[tauri::command]
pub fn create_chat_thread(
    title: Option<String>,
    provider_profile_id: Option<String>,
) -> Result<ChatThreadDto, String> {
    with_state(|state| {
        let provider_id = provider_profile_id.unwrap_or_else(|| "deepseek".into());
        state
            .store
            .get_chat_provider_profile(&provider_id)?
            .ok_or_else(|| "provider profile not found".to_string())?;
        let now = Utc::now();
        let thread = ChatThread {
            id: Uuid::new_v4().to_string(),
            title: title.unwrap_or_else(|| "New chat".into()),
            provider_profile_id: provider_id,
            created_at: now,
            updated_at: now,
        };
        state.store.create_chat_thread(&thread)?;
        Ok(to_thread_dto(thread))
    })
}

#[tauri::command]
pub fn rename_chat_thread(thread_id: String, title: String) -> Result<ChatThreadDto, String> {
    with_state(|state| {
        let thread = state.store.rename_chat_thread(&thread_id, &title)?;
        Ok(to_thread_dto(thread))
    })
}

#[tauri::command]
pub fn delete_chat_thread(thread_id: String) -> Result<(), String> {
    with_state(|state| {
        state.store.delete_chat_thread(&thread_id)?;
        Ok(())
    })
}

#[tauri::command]
pub fn list_chat_messages(thread_id: String) -> Result<Vec<ChatMessageDto>, String> {
    with_state(|state| {
        Ok(state
            .store
            .list_chat_messages(&thread_id)?
            .into_iter()
            .map(to_message_dto)
            .collect())
    })
}

#[tauri::command]
pub fn list_chat_memory_entries() -> Result<Vec<ChatMemoryEntryDto>, String> {
    with_state(|state| {
        Ok(state
            .store
            .list_chat_memory_entries()?
            .into_iter()
            .map(to_memory_dto)
            .collect())
    })
}

#[tauri::command]
pub fn save_chat_memory_entry(
    id: Option<String>,
    content: String,
) -> Result<ChatMemoryEntryDto, String> {
    with_state(|state| {
        let now = Utc::now();
        let entry = ChatMemoryEntry {
            id: id.unwrap_or_else(|| Uuid::new_v4().to_string()),
            content,
            created_at: now,
            updated_at: now,
        };
        state.store.save_chat_memory_entry(&entry)?;
        Ok(to_memory_dto(entry))
    })
}

#[tauri::command]
pub fn delete_chat_memory_entry(entry_id: String) -> Result<(), String> {
    with_state(|state| {
        state.store.delete_chat_memory_entry(&entry_id)?;
        Ok(())
    })
}

#[tauri::command]
pub fn preview_codex_task_command(
    thread_id: String,
    content: String,
) -> Result<CodexTaskPreview, String> {
    with_state(|state| {
        let thread = state
            .store
            .get_chat_thread(&thread_id)?
            .ok_or_else(|| "thread not found".to_string())?;
        let profile = state
            .store
            .get_chat_provider_profile(&thread.provider_profile_id)?
            .ok_or_else(|| "provider profile not found".to_string())?;
        let memories = state.store.list_chat_memory_entries()?;
        let workdir = state.paths.root.clone();
        preview_codex_task(&profile, &memories, &content, &workdir)
    })
}

#[tauri::command]
pub async fn send_chat_message(
    app: AppHandle,
    thread_id: String,
    content: String,
    provider_profile_id: Option<String>,
) -> Result<SendChatMessageResponse, String> {
    let (user_message, assistant_message, profile, memories, history, workdir) = with_state(|state| {
        let thread = state
            .store
            .get_chat_thread(&thread_id)?
            .ok_or_else(|| "thread not found".to_string())?;
        let provider_id = provider_profile_id.unwrap_or(thread.provider_profile_id.clone());
        let profile = state
            .store
            .get_chat_provider_profile(&provider_id)?
            .ok_or_else(|| "provider profile not found".to_string())?;
        let now = Utc::now();
        let user_message = ChatMessage {
            id: Uuid::new_v4().to_string(),
            thread_id: thread_id.clone(),
            role: "user".into(),
            content: content.clone(),
            status: "complete".into(),
            provider_profile_id: Some(provider_id.clone()),
            error_message: None,
            metadata_json: "{}".into(),
            created_at: now,
        };
        state.store.insert_chat_message(&user_message)?;
        let assistant_message = ChatMessage {
            id: Uuid::new_v4().to_string(),
            thread_id: thread_id.clone(),
            role: "assistant".into(),
            content: String::new(),
            status: if profile.kind == "codex_cli" {
                "awaiting_confirmation".into()
            } else {
                "streaming".into()
            },
            provider_profile_id: Some(provider_id.clone()),
            error_message: None,
            metadata_json: "{}".into(),
            created_at: now,
        };
        state.store.insert_chat_message(&assistant_message)?;
        state.store.touch_chat_thread(&thread_id)?;
        let memories = state.store.list_chat_memory_entries()?;
        let history = state.store.list_chat_messages(&thread_id)?;
        let workdir = state.paths.root.clone();
        Ok((
            user_message,
            assistant_message,
            profile,
            memories,
            history,
            workdir,
        ))
    })?;

    if profile.kind == "codex_cli" {
        let preview = preview_codex_task(&profile, &memories, &content, &workdir)?;
        if let Ok(mut guard) = pending_codex().lock() {
            guard.insert(
                assistant_message.id.clone(),
                PendingCodexTask {
                    thread_id: thread_id.clone(),
                    prompt: preview.prompt.clone(),
                    provider_profile_id: profile.id.clone(),
                },
            );
        }
        return Ok(SendChatMessageResponse {
            user_message: to_message_dto(user_message),
            assistant_message: to_message_dto(assistant_message),
            codex_preview: Some(preview),
        });
    }

    let assistant_id = assistant_message.id.clone();
    let app_clone = app.clone();
    let profile_clone = profile.clone();
    let memories_clone = memories.clone();
    let history_clone = history;
    let content_clone = content.clone();

    tokio::spawn(async move {
        let result = stream_api_completion(
            app_clone.clone(),
            &profile_clone,
            &memories_clone,
            &history_clone,
            &content_clone,
            &assistant_id,
        )
        .await;

        let update_result = with_state(|state| {
            let mut message = state
                .store
                .get_chat_message(&assistant_id)?
                .ok_or_else(|| "assistant message not found".to_string())?;
            match result {
                Ok(full) => {
                    message.content = full;
                    message.status = "complete".into();
                    message.error_message = None;
                }
                Err(err) => {
                    message.status = "error".into();
                    message.error_message = Some(err);
                }
            }
            state.store.insert_chat_message(&message)?;
            emit_message_updated(&app_clone, &message);
            Ok(())
        });
        if let Err(err) = update_result {
            eprintln!("[appscope][chat] failed to persist assistant message: {err}");
        }
    });

    Ok(SendChatMessageResponse {
        user_message: to_message_dto(user_message),
        assistant_message: to_message_dto(assistant_message),
        codex_preview: None,
    })
}

#[tauri::command]
pub fn confirm_codex_task(app: AppHandle, message_id: String) -> Result<ChatMessageDto, String> {
    let pending = pending_codex()
        .lock()
        .map_err(|_| "pending codex lock poisoned".to_string())?
        .remove(&message_id)
        .ok_or_else(|| "no pending codex task for message".to_string())?;

    let (profile, workdir, preview_summary) = with_state(|state| {
        let profile = state
            .store
            .get_chat_provider_profile(&pending.provider_profile_id)?
            .ok_or_else(|| "provider profile not found".to_string())?;
        let workdir = state.paths.root.clone();
        let preview = preview_codex_task(&profile, &[], &pending.prompt, &workdir)?;
        Ok((profile, workdir, preview.command_summary))
    })?;

    let CodexRunResult {
        stdout,
        exit_code,
        stderr,
    } = run_codex_task(&ProcessCodexRunner, &profile, &pending.prompt, &workdir)?;

    with_state(|state| {
        let mut message = state
            .store
            .get_chat_message(&message_id)?
            .ok_or_else(|| "assistant message not found".to_string())?;
        if exit_code == 0 {
            message.content = stdout;
            message.status = "complete".into();
            message.error_message = None;
        } else {
            message.status = "error".into();
            message.error_message = Some(format!("codex exited with {exit_code}: {stderr}"));
            message.content = stdout;
        }
        state.store.insert_chat_message(&message)?;
        state.store.touch_chat_thread(&pending.thread_id)?;

        let audit = ChatTaskAudit {
            id: Uuid::new_v4().to_string(),
            thread_id: pending.thread_id.clone(),
            message_id: Some(message_id.clone()),
            command_summary: preview_summary,
            workdir: Some(workdir.display().to_string()),
            exit_code: Some(exit_code),
            stderr_preview: Some(stderr.chars().take(500).collect()),
            created_at: Utc::now(),
        };
        state.store.insert_chat_task_audit(&audit)?;
        let _ = app.emit("chat-task-audit", &audit);
        emit_message_updated(&app, &message);
        Ok(to_message_dto(message))
    })
}

#[tauri::command]
pub fn cancel_codex_task(app: AppHandle, message_id: String) -> Result<ChatMessageDto, String> {
    let _ = pending_codex()
        .lock()
        .map_err(|_| "pending codex lock poisoned".to_string())?
        .remove(&message_id);

    with_state(|state| {
        let mut message = state
            .store
            .get_chat_message(&message_id)?
            .ok_or_else(|| "assistant message not found".to_string())?;
        message.status = "error".into();
        message.error_message = Some("Codex task cancelled by user".into());
        state.store.insert_chat_message(&message)?;
        emit_message_updated(&app, &message);
        Ok(to_message_dto(message))
    })
}

#[cfg(test)]
mod tests {
    use crate::paths::AppScopePaths;
    use crate::store::FlowStore;
    use tempfile::tempdir;

    #[test]
    fn chat_provider_commands_roundtrip() {
        let dir = tempdir().unwrap();
        let paths = AppScopePaths::new(dir.path());
        let store = FlowStore::open_at(&paths.database_path(), dir.path()).unwrap();
        let profiles = store.list_chat_provider_profiles().unwrap();
        assert_eq!(profiles.len(), 3);
        let mut deepseek = profiles.into_iter().find(|p| p.id == "deepseek").unwrap();
        deepseek.api_key = Some("test-key".into());
        store.save_chat_provider_profile(&deepseek).unwrap();
        let loaded = store.get_chat_provider_profile("deepseek").unwrap().unwrap();
        assert_eq!(loaded.api_key.as_deref(), Some("test-key"));
    }
}
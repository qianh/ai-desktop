use crate::chat_providers::{build_chat_messages, format_memory_context};
use crate::models::{ChatMemoryEntry, ChatMessage, ChatProviderProfile};
use futures_util::StreamExt;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize)]
pub struct ChatStreamChunk {
    pub message_id: String,
    pub delta: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ChatMessageUpdated {
    pub message_id: String,
    pub status: String,
    pub content: String,
    pub error_message: Option<String>,
}

pub fn completions_url(base_url: &str) -> String {
    let trimmed = base_url.trim_end_matches('/');
    if trimmed.ends_with("/chat/completions") {
        trimmed.to_string()
    } else {
        format!("{trimmed}/chat/completions")
    }
}

pub fn validate_api_profile(profile: &ChatProviderProfile) -> Result<(), String> {
    if profile.kind != "api" {
        return Err("provider is not an API provider".into());
    }
    let key = profile
        .api_key
        .as_deref()
        .filter(|k| !k.trim().is_empty())
        .ok_or_else(|| "API key not configured".to_string())?;
    if key.trim().is_empty() {
        return Err("API key not configured".into());
    }
    let base = profile
        .base_url
        .as_deref()
        .filter(|u| !u.trim().is_empty())
        .ok_or_else(|| "Base URL not configured".to_string())?;
    if base.trim().is_empty() {
        return Err("Base URL not configured".into());
    }
    Ok(())
}

pub async fn stream_api_completion(
    app: AppHandle,
    profile: &ChatProviderProfile,
    memories: &[ChatMemoryEntry],
    history: &[ChatMessage],
    user_content: &str,
    assistant_message_id: &str,
) -> Result<String, String> {
    validate_api_profile(profile)?;
    let memory_context = format_memory_context(memories);
    let messages = build_chat_messages(&memory_context, history, user_content);
    let model = profile
        .default_model
        .clone()
        .filter(|m| !m.trim().is_empty())
        .unwrap_or_else(|| "deepseek-chat".into());

    let body = serde_json::json!({
        "model": model,
        "messages": messages,
        "stream": true,
    });

    let client = reqwest::Client::new();
    let response = client
        .post(completions_url(profile.base_url.as_deref().unwrap_or_default()))
        .header(CONTENT_TYPE, "application/json")
        .header(
            AUTHORIZATION,
            format!("Bearer {}", profile.api_key.as_deref().unwrap_or_default()),
        )
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("API request failed: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("API error {status}: {text}"));
    }

    let mut stream = response.bytes_stream();
    let mut full = String::new();
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        let bytes = chunk.map_err(|e| format!("stream read failed: {e}"))?;
        buffer.push_str(&String::from_utf8_lossy(&bytes));
        while let Some(pos) = buffer.find("\n\n") {
            let frame = buffer.drain(..pos + 2).collect::<String>();
            for line in frame.lines() {
                let line = line.trim();
                if !line.starts_with("data:") {
                    continue;
                }
                let data = line.trim_start_matches("data:").trim();
                if data == "[DONE]" {
                    continue;
                }
                let Ok(json) = serde_json::from_str::<serde_json::Value>(data) else {
                    continue;
                };
                let delta = json["choices"][0]["delta"]["content"]
                    .as_str()
                    .unwrap_or_default();
                if delta.is_empty() {
                    continue;
                }
                full.push_str(delta);
                let _ = app.emit(
                    "chat-stream-chunk",
                    ChatStreamChunk {
                        message_id: assistant_message_id.to_string(),
                        delta: delta.to_string(),
                    },
                );
            }
        }
    }

    Ok(full)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn completions_url_appends_path() {
        assert_eq!(
            completions_url("https://api.deepseek.com"),
            "https://api.deepseek.com/chat/completions"
        );
    }

    #[test]
    fn validate_api_profile_requires_key() {
        let profile = ChatProviderProfile {
            id: "deepseek".into(),
            display_name: "Deepseek".into(),
            kind: "api".into(),
            api_key: None,
            base_url: Some("https://api.deepseek.com".into()),
            default_model: Some("deepseek-chat".into()),
            codex_path: None,
            codex_extra_args_json: "[]".into(),
            enabled: true,
            updated_at: chrono::Utc::now(),
        };
        assert!(validate_api_profile(&profile).is_err());
    }
}
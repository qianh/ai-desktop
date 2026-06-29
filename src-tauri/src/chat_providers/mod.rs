pub mod api;
pub mod codex;

use crate::models::{ChatMemoryEntry, ChatMessage};

pub fn format_memory_context(entries: &[ChatMemoryEntry]) -> String {
    if entries.is_empty() {
        return String::new();
    }
    let lines: Vec<String> = entries
        .iter()
        .map(|e| format!("- {}", e.content.trim()))
        .collect();
    format!(
        "The user has shared the following memories. Use them when relevant:\n{}",
        lines.join("\n")
    )
}

pub fn build_chat_messages(
    memory_context: &str,
    history: &[ChatMessage],
    user_content: &str,
) -> Vec<serde_json::Value> {
    let mut messages = Vec::new();
    if !memory_context.is_empty() {
        messages.push(serde_json::json!({
            "role": "system",
            "content": memory_context,
        }));
    }
    for msg in history {
        if msg.role == "user" || msg.role == "assistant" {
            if msg.status == "complete" || msg.role == "user" {
                messages.push(serde_json::json!({
                    "role": msg.role,
                    "content": msg.content,
                }));
            }
        }
    }
    messages.push(serde_json::json!({
        "role": "user",
        "content": user_content,
    }));
    messages
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    #[test]
    fn format_memory_context_joins_entries() {
        let entries = vec![ChatMemoryEntry {
            id: "m1".into(),
            content: "Prefers Rust".into(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }];
        let ctx = format_memory_context(&entries);
        assert!(ctx.contains("Prefers Rust"));
    }

    #[test]
    fn build_chat_messages_includes_memory_and_user() {
        let ctx = "memory block";
        let history: Vec<ChatMessage> = vec![];
        let msgs = build_chat_messages(ctx, &history, "hi");
        assert_eq!(msgs.len(), 2);
        assert_eq!(msgs[0]["role"], "system");
        assert_eq!(msgs[1]["content"], "hi");
    }
}
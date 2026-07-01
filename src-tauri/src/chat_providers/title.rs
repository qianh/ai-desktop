use crate::models::ChatProviderProfile;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use super::api::{completions_url, validate_api_profile};

pub const DEFAULT_THREAD_TITLE: &str = "New chat";
const TITLE_MAX_LEN: usize = 48;

pub fn is_default_thread_title(title: &str) -> bool {
    let trimmed = title.trim();
    trimmed.is_empty()
        || trimmed.eq_ignore_ascii_case(DEFAULT_THREAD_TITLE)
        || trimmed.eq_ignore_ascii_case("new chat")
        || trimmed == "新对话"
        || trimmed == "新会话"
}

pub fn fallback_thread_title(content: &str) -> String {
    let collapsed = content
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string();
    if collapsed.is_empty() {
        return DEFAULT_THREAD_TITLE.to_string();
    }
    truncate_title(&collapsed, TITLE_MAX_LEN)
}

pub async fn summarize_thread_title(
    profile: &ChatProviderProfile,
    content: &str,
) -> Result<String, String> {
    let fallback = fallback_thread_title(content);
    if validate_api_profile(profile).is_err() {
        return Ok(fallback);
    }

    let model = profile
        .default_model
        .clone()
        .filter(|m| !m.trim().is_empty())
        .unwrap_or_else(|| "deepseek-chat".into());

    let prompt = content.chars().take(800).collect::<String>();
    let body = serde_json::json!({
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": "Generate a short chat thread title from the user's first message. Reply with ONLY the title text: no quotes, no punctuation at the end, max 20 characters, same language as the user."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "stream": false,
        "max_tokens": 32,
        "temperature": 0.2
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
        .map_err(|e| format!("title API request failed: {e}"))?;

    if !response.status().is_success() {
        return Ok(fallback);
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("title API parse failed: {e}"))?;

    let raw = json["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or_default()
        .trim()
        .trim_matches('"')
        .trim_matches('\'')
        .trim()
        .to_string();

    if raw.is_empty() {
        return Ok(fallback);
    }

    Ok(truncate_title(&raw, TITLE_MAX_LEN))
}

fn truncate_title(text: &str, max_len: usize) -> String {
    if text.chars().count() <= max_len {
        return text.to_string();
    }
    let mut out = String::new();
    for (idx, ch) in text.chars().enumerate() {
        if idx >= max_len.saturating_sub(1) {
            break;
        }
        out.push(ch);
    }
    out.push('…');
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_default_titles() {
        assert!(is_default_thread_title("New chat"));
        assert!(is_default_thread_title("  new chat  "));
        assert!(!is_default_thread_title("AEKLF股价走势"));
    }

    #[test]
    fn fallback_collapses_whitespace_and_truncates() {
        let title = fallback_thread_title("  帮我分析   AEKLF  股价走势  ");
        assert!(title.contains("AEKLF"));
        assert!(title.chars().count() <= TITLE_MAX_LEN);
    }

    #[test]
    fn truncate_title_adds_ellipsis() {
        let long = "a".repeat(60);
        let out = truncate_title(&long, 20);
        assert!(out.ends_with('…'));
        assert!(out.chars().count() <= 20);
    }
}
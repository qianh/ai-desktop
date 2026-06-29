use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Page {
    pub id: String,
    pub name: String,
    pub url: String,
    pub browser_app_id: Option<String>,
    pub profile_id: Option<String>,
    pub capture_mode: String,
    pub intercept_reporting_enabled: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Session {
    pub id: String,
    pub target_type: String,
    pub target_id: String,
    pub status: String,
    pub proxy_port: Option<u16>,
    pub cdp_port: Option<u16>,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Flow {
    pub id: String,
    pub session_id: String,
    pub method: String,
    pub url: String,
    pub scheme: String,
    pub host: String,
    pub path: String,
    pub status_code: Option<i32>,
    pub req_headers_json: String,
    pub resp_headers_json: String,
    pub req_body_preview: Option<String>,
    pub resp_body_preview: Option<String>,
    pub mime: Option<String>,
    pub duration_ms: Option<i64>,
    pub req_size: Option<i64>,
    pub resp_size: Option<i64>,
    pub timing_json: Option<String>,
    pub error: Option<String>,
    pub started_at: DateTime<Utc>,
    pub finished_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowListItem {
    pub id: String,
    pub method: String,
    pub url: String,
    pub scheme: String,
    pub host: String,
    pub path: String,
    pub status_code: Option<i32>,
    pub mime: Option<String>,
    pub resp_size: Option<i64>,
    pub duration_ms: Option<i64>,
    pub started_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowDetail {
    pub id: String,
    pub session_id: String,
    pub method: String,
    pub url: String,
    pub scheme: String,
    pub host: String,
    pub path: String,
    pub status_code: Option<i32>,
    pub req_headers: Vec<HeaderPair>,
    pub resp_headers: Vec<HeaderPair>,
    pub req_body_preview: Option<String>,
    pub resp_body_preview: Option<String>,
    pub mime: Option<String>,
    pub duration_ms: Option<i64>,
    pub req_size: Option<i64>,
    pub resp_size: Option<i64>,
    pub timing: Option<serde_json::Value>,
    pub error: Option<String>,
    pub started_at: DateTime<Utc>,
    pub finished_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HeaderPair {
    pub name: String,
    pub value: String,
    pub sensitive: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CertificateState {
    pub state: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ChatProviderProfile {
    pub id: String,
    pub display_name: String,
    pub kind: String,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub default_model: Option<String>,
    pub codex_path: Option<String>,
    pub codex_extra_args_json: String,
    pub enabled: bool,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ChatThread {
    pub id: String,
    pub title: String,
    pub provider_profile_id: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ChatMessage {
    pub id: String,
    pub thread_id: String,
    pub role: String,
    pub content: String,
    pub status: String,
    pub provider_profile_id: Option<String>,
    pub error_message: Option<String>,
    pub metadata_json: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ChatMemoryEntry {
    pub id: String,
    pub content: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChatTaskAudit {
    pub id: String,
    pub thread_id: String,
    pub message_id: Option<String>,
    pub command_summary: String,
    pub workdir: Option<String>,
    pub exit_code: Option<i32>,
    pub stderr_preview: Option<String>,
    pub created_at: DateTime<Utc>,
}

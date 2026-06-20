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
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AppEntry {
    pub id: String,
    pub name: String,
    pub bundle_id: String,
    pub app_path: String,
    pub icon_path: Option<String>,
    pub launch_mode: String,
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

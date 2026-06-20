use crate::models::{Flow, HeaderPair};
use crate::store::FlowStore;
use serde_json::{json, Value};
use std::path::Path;

const SENSITIVE_HEADERS: &[&str] = &["authorization", "cookie", "set-cookie"];

pub fn mask_header_value(name: &str, value: &str) -> String {
    if SENSITIVE_HEADERS.contains(&name.to_ascii_lowercase().as_str()) {
        "***".to_string()
    } else {
        value.to_string()
    }
}

pub fn mask_headers(headers: &[HeaderPair]) -> Vec<HeaderPair> {
    headers
        .iter()
        .map(|h| HeaderPair {
            name: h.name.clone(),
            value: mask_header_value(&h.name, &h.value),
            sensitive: h.sensitive
                || SENSITIVE_HEADERS.contains(&h.name.to_ascii_lowercase().as_str()),
        })
        .collect()
}

pub fn export_session_json(store: &FlowStore, session_id: &str) -> Result<String, String> {
    let flows = store.list_flows_for_session(session_id)?;
    let masked: Vec<Value> = flows.iter().map(|flow| flow_to_json(flow, true)).collect();
    serde_json::to_string_pretty(&json!({
        "session_id": session_id,
        "flows": masked,
    }))
    .map_err(|e| e.to_string())
}

pub fn export_session_har(store: &FlowStore, session_id: &str) -> Result<String, String> {
    let flows = store.list_flows_for_session(session_id)?;
    let entries: Vec<Value> = flows
        .iter()
        .map(|flow| flow_to_har_entry(flow, true))
        .collect();
    let har = json!({
        "log": {
            "version": "1.2",
            "creator": {
                "name": "AppScope",
                "version": "0.1.0"
            },
            "entries": entries
        }
    });
    serde_json::to_string_pretty(&har).map_err(|e| e.to_string())
}

pub fn write_session_export(
    store: &FlowStore,
    session_id: &str,
    format: &str,
    output_path: &Path,
) -> Result<(), String> {
    let content = match format {
        "json" => export_session_json(store, session_id)?,
        "har" => export_session_har(store, session_id)?,
        other => return Err(format!("unsupported export format: {other}")),
    };
    if let Some(parent) = output_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(output_path, content).map_err(|e| e.to_string())
}

fn flow_to_json(flow: &Flow, mask_sensitive: bool) -> Value {
    let req_headers: Vec<HeaderPair> =
        serde_json::from_str(&flow.req_headers_json).unwrap_or_default();
    let resp_headers: Vec<HeaderPair> =
        serde_json::from_str(&flow.resp_headers_json).unwrap_or_default();
    let req_headers = if mask_sensitive {
        mask_headers(&req_headers)
    } else {
        req_headers
    };
    let resp_headers = if mask_sensitive {
        mask_headers(&resp_headers)
    } else {
        resp_headers
    };

    json!({
        "id": flow.id,
        "method": flow.method,
        "url": flow.url,
        "status_code": flow.status_code,
        "req_headers": req_headers,
        "resp_headers": resp_headers,
        "req_body_preview": flow.req_body_preview,
        "resp_body_preview": flow.resp_body_preview,
    })
}

fn flow_to_har_entry(flow: &Flow, mask_sensitive: bool) -> Value {
    let req_headers: Vec<HeaderPair> =
        serde_json::from_str(&flow.req_headers_json).unwrap_or_default();
    let resp_headers: Vec<HeaderPair> =
        serde_json::from_str(&flow.resp_headers_json).unwrap_or_default();
    let req_headers = if mask_sensitive {
        mask_headers(&req_headers)
    } else {
        req_headers
    };
    let resp_headers = if mask_sensitive {
        mask_headers(&resp_headers)
    } else {
        resp_headers
    };

    json!({
        "startedDateTime": flow.started_at.to_rfc3339(),
        "time": flow.duration_ms.unwrap_or(0),
        "request": {
            "method": flow.method,
            "url": flow.url,
            "headers": req_headers.iter().map(|h| json!({"name": h.name, "value": h.value})).collect::<Vec<_>>(),
            "bodySize": flow.req_size.unwrap_or(0)
        },
        "response": {
            "status": flow.status_code.unwrap_or(0),
            "headers": resp_headers.iter().map(|h| json!({"name": h.name, "value": h.value})).collect::<Vec<_>>(),
            "content": {
                "mimeType": flow.mime,
                "text": flow.resp_body_preview
            },
            "bodySize": flow.resp_size.unwrap_or(0)
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{Flow, HeaderPair, Session};
    use chrono::Utc;
    use tempfile::tempdir;

    fn fixture_flow() -> (FlowStore, String) {
        let dir = tempdir().unwrap();
        let store = FlowStore::open_at(&dir.path().join("appscope.db"), dir.path()).unwrap();
        let now = Utc::now();
        let session_id: String = "sess-export".into();

        store
            .save_session(&Session {
                id: session_id.clone(),
                target_type: "page".into(),
                target_id: "page-1".into(),
                status: "capturing".into(),
                proxy_port: Some(8081),
                cdp_port: None,
                started_at: now,
                ended_at: None,
                error: None,
            })
            .unwrap();

        let req_headers = serde_json::to_string(&vec![
            HeaderPair {
                name: "authorization".into(),
                value: "Bearer secret-token".into(),
                sensitive: true,
            },
            HeaderPair {
                name: "cookie".into(),
                value: "session=abc123".into(),
                sensitive: true,
            },
        ])
        .unwrap();
        let resp_headers = serde_json::to_string(&vec![HeaderPair {
            name: "set-cookie".into(),
            value: "sid=xyz; Path=/".into(),
            sensitive: true,
        }])
        .unwrap();

        store
            .insert_flow(&Flow {
                id: "flow-export".into(),
                session_id: session_id.clone(),
                method: "GET".into(),
                url: "http://127.0.0.1:8080/api".into(),
                scheme: "http".into(),
                host: "127.0.0.1".into(),
                path: "/api".into(),
                status_code: Some(200),
                req_headers_json: req_headers,
                resp_headers_json: resp_headers,
                req_body_preview: None,
                resp_body_preview: Some("{\"ok\":true}".into()),
                mime: Some("application/json".into()),
                duration_ms: Some(10),
                req_size: Some(0),
                resp_size: Some(12),
                timing_json: None,
                error: None,
                started_at: now,
                finished_at: Some(now),
            })
            .unwrap();

        (store, session_id)
    }

    #[test]
    fn json_export_masks_sensitive_values() {
        let (store, session_id) = fixture_flow();
        let exported = export_session_json(&store, &session_id).unwrap();
        assert!(!exported.contains("secret-token"));
        assert!(!exported.contains("abc123"));
        assert!(!exported.contains("sid=xyz"));
        assert!(exported.contains("***"));
    }

    #[test]
    fn har_export_masks_sensitive_values() {
        let (store, session_id) = fixture_flow();
        let exported = export_session_har(&store, &session_id).unwrap();
        assert!(!exported.contains("secret-token"));
        assert!(!exported.contains("abc123"));
        assert!(!exported.contains("sid=xyz"));
        assert!(exported.contains("***"));
    }
}

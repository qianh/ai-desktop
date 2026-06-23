use crate::cert::generate_certificate;
use crate::default_page::is_default_chat_page;
use crate::models::{Flow, HeaderPair};
use crate::paths::AppScopePaths;
use crate::store::FlowStore;
use chrono::Utc;
use serde::Deserialize;
use std::io::{BufRead, BufReader, Write};
use tauri::{AppHandle, Emitter};
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

#[derive(Debug)]
pub struct ProxyRuntime {
    pub port: u16,
    pub event_file: PathBuf,
    pub addon_file: PathBuf,
    child: Option<Child>,
}

#[derive(Debug, Deserialize)]
pub struct ProxyFlowEvent {
    pub id: Option<String>,
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
}

pub fn find_mitmdump() -> Result<PathBuf, String> {
    if let Ok(path) = std::env::var("APPSCOPE_MITMDUMP") {
        let p = PathBuf::from(path);
        if p.exists() {
            return Ok(p);
        }
    }

    let output = Command::new("which").arg("mitmdump").output();
    if let Ok(out) = output {
        if out.status.success() {
            let path = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !path.is_empty() {
                return Ok(PathBuf::from(path));
            }
        }
    }

    for candidate in ["/opt/homebrew/bin/mitmdump", "/usr/local/bin/mitmdump"] {
        let p = PathBuf::from(candidate);
        if p.exists() {
            return Ok(p);
        }
    }

    Err("mitmdump not found".into())
}

pub fn available_port() -> Result<u16, String> {
    TcpListener::bind("127.0.0.1:0")
        .map_err(|e| e.to_string())?
        .local_addr()
        .map(|a| a.port())
        .map_err(|e| e.to_string())
}

pub fn write_addon_script(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(path, ADDON_SCRIPT).map_err(|e| e.to_string())
}

fn detect_system_http_proxy() -> Option<(String, u16)> {
    let output = Command::new("scutil")
        .arg("--proxy")
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let enabled = stdout
        .lines()
        .any(|l| l.trim().starts_with("HTTPSEnable") && l.contains('1'));
    if !enabled {
        return None;
    }
    let host = stdout
        .lines()
        .find_map(|l| l.trim().strip_prefix("HTTPSProxy : "))
        .map(str::to_string)?;
    let port: u16 = stdout
        .lines()
        .find_map(|l| l.trim().strip_prefix("HTTPSPort : "))
        .and_then(|p| p.parse().ok())?;
    if host.is_empty() || port == 0 {
        return None;
    }
    Some((host, port))
}

pub fn start_proxy(
    paths: &AppScopePaths,
    session_id: &str,
    chain_system_upstream: bool,
) -> Result<ProxyRuntime, String> {
    let mitmdump = find_mitmdump()?;
    generate_certificate(paths)?;
    let port = available_port()?;
    let event_file = paths.proxy_events_dir().join(format!("{session_id}.jsonl"));
    let addon_file = paths.logs_dir().join(format!("{session_id}_addon.py"));
    write_addon_script(&addon_file)?;

    if event_file.exists() {
        std::fs::remove_file(&event_file).map_err(|e| e.to_string())?;
    }

    let mut cmd = Command::new(mitmdump);
    cmd.arg("-q")
        .arg("-p")
        .arg(port.to_string())
        .arg("--ssl-insecure");

    if chain_system_upstream {
        if let Some((host, proxy_port)) = detect_system_http_proxy() {
            cmd.arg("--mode")
                .arg(format!("upstream:http://{host}:{proxy_port}"));
        }
    }

    let child = cmd
        .arg("--set")
        .arg(format!("confdir={}", paths.certs_dir().display()))
        .arg("-s")
        .arg(&addon_file)
        .env("APPSCOPE_EVENT_FILE", &event_file)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("failed to start mitmdump: {e}"))?;

    thread::sleep(Duration::from_millis(500));

    Ok(ProxyRuntime {
        port,
        event_file,
        addon_file,
        child: Some(child),
    })
}

impl ProxyRuntime {
    pub fn stop(mut self) {
        if let Some(mut child) = self.child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

pub fn parse_flow_event_json(line: &str) -> Result<ProxyFlowEvent, String> {
    serde_json::from_str(line).map_err(|e| format!("invalid flow event json: {e}"))
}

pub fn flow_event_id(event: &ProxyFlowEvent, session_id: &str) -> String {
    if let Some(id) = &event.id {
        if !id.is_empty() {
            return id.clone();
        }
    }
    format!(
        "{session_id}:{}:{}:{}",
        event.method,
        event.url,
        event.status_code.unwrap_or(0)
    )
}

pub fn flow_event_to_flow(event: &ProxyFlowEvent, session_id: &str) -> Flow {
    let now = Utc::now();
    Flow {
        id: flow_event_id(event, session_id),
        session_id: session_id.to_string(),
        method: event.method.clone(),
        url: event.url.clone(),
        scheme: event.scheme.clone(),
        host: event.host.clone(),
        path: event.path.clone(),
        status_code: event.status_code,
        req_headers_json: serde_json::to_string(&event.req_headers).unwrap_or_else(|_| "[]".into()),
        resp_headers_json: serde_json::to_string(&event.resp_headers)
            .unwrap_or_else(|_| "[]".into()),
        req_body_preview: event.req_body_preview.clone(),
        resp_body_preview: event.resp_body_preview.clone(),
        mime: event.mime.clone(),
        duration_ms: event.duration_ms,
        req_size: event.req_size,
        resp_size: event.resp_size,
        timing_json: event
            .timing
            .as_ref()
            .and_then(|t| serde_json::to_string(t).ok()),
        error: event.error.clone(),
        started_at: now,
        finished_at: Some(now),
    }
}

fn count_physical_lines(event_file: &Path) -> Result<usize, String> {
    let file = std::fs::File::open(event_file).map_err(|e| e.to_string())?;
    Ok(BufReader::new(file).lines().count())
}

pub fn sync_event_file(
    store: &FlowStore,
    session_id: &str,
    event_file: &Path,
    app: Option<&AppHandle>,
    mut intercept_line_cursor: Option<&mut usize>,
) -> Result<usize, String> {
    if !event_file.exists() {
        return Ok(0);
    }

    if let Some(cursor) = intercept_line_cursor.as_deref_mut() {
        let total_lines = count_physical_lines(event_file)?;
        if *cursor > total_lines {
            *cursor = 0;
        }
    }

    let file = std::fs::File::open(event_file).map_err(|e| e.to_string())?;
    let reader = BufReader::new(file);
    let mut count = 0usize;
    let mut physical_line = 0usize;

    for line in reader.lines() {
        physical_line += 1;
        let line = line.map_err(|e| e.to_string())?;
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let raw: serde_json::Value = serde_json::from_str(trimmed)
            .map_err(|e| format!("invalid event json: {e}"))?;

        if raw.get("_type").and_then(|v| v.as_str()) == Some("js_intercept") {
            let emit = match intercept_line_cursor.as_ref() {
                Some(cursor) => physical_line > **cursor,
                None => app.is_some(),
            };
            if emit {
                if let Some(app) = app {
                    let page_id = raw.get("page_id").and_then(|v| v.as_str()).unwrap_or("");
                    let reporting_enabled = if page_id.is_empty() {
                        false
                    } else {
                        store
                            .get_page(page_id)
                            .ok()
                            .flatten()
                            .map(|page| {
                                page.intercept_reporting_enabled || is_default_chat_page(&page.url)
                            })
                            .unwrap_or(false)
                    };
                    if reporting_enabled {
                        let items_json =
                            raw.get("items_json").and_then(|v| v.as_str()).unwrap_or("[]");
                        if let Ok(items) =
                            serde_json::from_str::<Vec<serde_json::Value>>(items_json)
                        {
                            if !items.is_empty() {
                                let _ = app.emit(
                                    "page-content-intercept",
                                    serde_json::json!({
                                        "page_id": page_id,
                                        "items": items,
                                    }),
                                );
                            }
                        }
                    }
                }
            }
            if let Some(cursor) = intercept_line_cursor.as_deref_mut() {
                *cursor = physical_line;
            }
            count += 1;
            continue;
        }

        let event = parse_flow_event_json(trimmed)?;
        let flow = flow_event_to_flow(&event, session_id);
        store.insert_flow(&flow)?;
        count += 1;
    }

    Ok(count)
}

pub fn spawn_test_http_server() -> Result<(u16, thread::JoinHandle<()>), String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    listener.set_nonblocking(false).map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let running = Arc::new(AtomicBool::new(true));
    let flag = running.clone();

    let handle = thread::spawn(move || {
        while flag.load(Ordering::Relaxed) {
            match listener.accept() {
                Ok((mut stream, _)) => {
                    let body = b"{\"ok\":true}";
                    let response = format!(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                        body.len()
                    );
                    let _ = stream.write_all(response.as_bytes());
                    let _ = stream.write_all(body);
                }
                Err(_) => break,
            }
        }
    });

    Ok((port, handle))
}

const ADDON_SCRIPT: &str = r#"
import hashlib
import json
import os
from mitmproxy import http

EVENT_FILE = os.environ.get("APPSCOPE_EVENT_FILE", "")

def _header_pairs(headers):
    pairs = []
    for name, value in headers.items(multi=True):
        lower = name.lower()
        sensitive = lower in ("authorization", "cookie", "set-cookie")
        pairs.append({"name": name, "value": value, "sensitive": sensitive})
    return pairs

def _is_intercept_drain(flow):
    path = flow.request.path.split("?")[0].rstrip("/")
    if path in ("/__intercept__", "/__appscope_intercept__"):
        return True
    return flow.request.pretty_host == "appscope.local"

def _intercept_drain_cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Page-Id",
        "Access-Control-Max-Age": "86400",
    }

def request(flow: http.HTTPFlow):
    if not _is_intercept_drain(flow):
        return
    if flow.request.method == "OPTIONS":
        flow.response = http.Response.make(204, b"", _intercept_drain_cors_headers())
        return
    if EVENT_FILE and flow.request.method == "POST":
        body = flow.request.get_text(strict=False) or "[]"
        page_id = flow.request.headers.get("x-page-id", "")
        event = {"_type": "js_intercept", "page_id": page_id, "items_json": body}
        with open(EVENT_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(event) + "\n")
    flow.response = http.Response.make(200, b'{"ok":true}', {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
    })

def response(flow: http.HTTPFlow):
    if not EVENT_FILE:
        return
    if _is_intercept_drain(flow):
        return
    req = flow.request
    resp = flow.response
    if resp is None:
        return
    for csp_header in ("content-security-policy", "content-security-policy-report-only"):
        if csp_header in resp.headers:
            del resp.headers[csp_header]
    event_id = hashlib.sha256(
        f"{req.timestamp_start}:{req.method}:{req.pretty_url}:{resp.status_code}".encode()
    ).hexdigest()[:16]
    event = {
        "id": event_id,
        "method": req.method,
        "url": req.pretty_url,
        "scheme": req.scheme,
        "host": req.host,
        "path": req.path,
        "status_code": resp.status_code,
        "req_headers": _header_pairs(req.headers),
        "resp_headers": _header_pairs(resp.headers),
        "req_body_preview": req.get_text(strict=False)[:2000] if req.raw_content else None,
        "resp_body_preview": resp.get_text(strict=False)[:2000] if resp.raw_content else None,
        "mime": resp.headers.get("content-type"),
        "duration_ms": int((resp.timestamp_end - req.timestamp_start) * 1000) if resp.timestamp_end and req.timestamp_start else None,
        "req_size": len(req.raw_content) if req.raw_content else 0,
        "resp_size": len(resp.raw_content) if resp.raw_content else 0,
        "timing": None,
        "error": None,
    }
    with open(EVENT_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(event) + "\n")
"#;

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn find_mitmdump_returns_path_when_installed() {
        let result = find_mitmdump();
        assert!(result.is_ok(), "expected mitmdump, got {:?}", result);
    }

    #[test]
    fn parse_flow_event_json_maps_event() {
        let json = r#"{
            "method": "GET",
            "url": "http://127.0.0.1:8080/api",
            "scheme": "http",
            "host": "127.0.0.1",
            "path": "/api",
            "status_code": 200,
            "req_headers": [{"name":"accept","value":"*/*","sensitive":false}],
            "resp_headers": [{"name":"content-type","value":"application/json","sensitive":false}],
            "resp_body_preview": "{\"ok\":true}"
        }"#;
        let event = parse_flow_event_json(json).unwrap();
        assert_eq!(event.method, "GET");
        assert_eq!(event.status_code, Some(200));
    }

    #[test]
    fn sync_event_file_is_idempotent() {
        let dir = tempdir().unwrap();
        let paths = AppScopePaths::new(dir.path());
        let store = FlowStore::open(&paths).unwrap();
        let session_id = "sess-idempotent";
        let now = Utc::now();

        store
            .save_session(&crate::models::Session {
                id: session_id.into(),
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

        let event_file = dir.path().join("events.jsonl");
        let line = r#"{"id":"flow-stable-1","method":"GET","url":"http://127.0.0.1:8080/","scheme":"http","host":"127.0.0.1","path":"/","status_code":200,"req_headers":[],"resp_headers":[]}"#;
        std::fs::write(&event_file, format!("{line}\n")).unwrap();

        sync_event_file(&store, session_id, &event_file, None, None).unwrap();
        sync_event_file(&store, session_id, &event_file, None, None).unwrap();
        let flows = store.list_flows(session_id).unwrap();
        assert_eq!(flows.len(), 1);
        assert_eq!(flows[0].id, "flow-stable-1");
    }

    #[test]
    fn sync_event_file_js_intercept_requires_reporting_enabled() {
        let dir = tempdir().unwrap();
        let paths = AppScopePaths::new(dir.path());
        let store = FlowStore::open(&paths).unwrap();
        let now = Utc::now();
        store
            .save_page(&crate::models::Page {
                id: "page-off".into(),
                name: "Off".into(),
                url: "https://example.com/".into(),
                browser_app_id: None,
                profile_id: None,
                capture_mode: "chrome_session".into(),
                intercept_reporting_enabled: false,
                created_at: now,
                updated_at: now,
            })
            .unwrap();

        let event_file = dir.path().join("events.jsonl");
        let intercept_line = r#"{"_type":"js_intercept","page_id":"page-off","items_json":"[{\"id\":\"i1\"}]"}"#;
        std::fs::write(&event_file, format!("{intercept_line}\n")).unwrap();

        let session_id = "sess-reporting-gate";
        let mut cursor = 0usize;
        let count = sync_event_file(
            &store,
            session_id,
            &event_file,
            None,
            Some(&mut cursor),
        )
        .unwrap();
        assert_eq!(count, 1);
        assert_eq!(cursor, 1);
    }

    #[test]
    fn sync_event_file_js_intercept_cursor_resets_on_file_shrink() {
        let dir = tempdir().unwrap();
        let event_file = dir.path().join("events.jsonl");
        let intercept_line = r#"{"_type":"js_intercept","page_id":"page-1","items_json":"[{\"id\":\"i1\",\"timestamp\":1,\"url\":\"https://example.com\",\"method\":\"GET\",\"req_headers\":{},\"req_body\":null,\"status\":200,\"resp_headers\":{},\"resp_body\":null,\"duration_ms\":1}]"}"#;
        std::fs::write(&event_file, format!("{intercept_line}\n")).unwrap();

        let paths = AppScopePaths::new(dir.path());
        let store = FlowStore::open(&paths).unwrap();
        let session_id = "sess-intercept-shrink";
        let mut cursor = 5000usize;

        let count =
            sync_event_file(&store, session_id, &event_file, None, Some(&mut cursor)).unwrap();
        assert_eq!(count, 1);
        assert_eq!(cursor, 1);
    }

    #[test]
    fn sync_event_file_js_intercept_cursor_skips_reemit() {
        let dir = tempdir().unwrap();
        let event_file = dir.path().join("events.jsonl");
        let intercept_line = r#"{"_type":"js_intercept","page_id":"page-1","items_json":"[{\"id\":\"i1\",\"timestamp\":1,\"url\":\"https://example.com\",\"method\":\"GET\",\"req_headers\":{},\"req_body\":null,\"status\":200,\"resp_headers\":{},\"resp_body\":null,\"duration_ms\":1}]"}"#;
        std::fs::write(&event_file, format!("{intercept_line}\n")).unwrap();

        let paths = AppScopePaths::new(dir.path());
        let store = FlowStore::open(&paths).unwrap();
        let session_id = "sess-intercept";
        let mut cursor = 0usize;

        sync_event_file(&store, session_id, &event_file, None, Some(&mut cursor)).unwrap();
        assert_eq!(cursor, 1);

        std::fs::write(
            &event_file,
            format!("{intercept_line}\n{intercept_line}\n"),
        )
        .unwrap();
        let count =
            sync_event_file(&store, session_id, &event_file, None, Some(&mut cursor)).unwrap();
        assert_eq!(count, 2);
        assert_eq!(cursor, 2);
    }

    #[test]
    fn sync_event_file_persists_flow() {
        let dir = tempdir().unwrap();
        let paths = AppScopePaths::new(dir.path());
        let store = FlowStore::open(&paths).unwrap();
        let session_id = "sess-proxy";
        let now = Utc::now();

        store
            .save_session(&crate::models::Session {
                id: session_id.into(),
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

        let event_file = dir.path().join("events.jsonl");
        let line = r#"{"method":"GET","url":"http://127.0.0.1:8080/","scheme":"http","host":"127.0.0.1","path":"/","status_code":200,"req_headers":[],"resp_headers":[],"resp_body_preview":"ok"}"#;
        std::fs::write(&event_file, format!("{line}\n")).unwrap();

        let count = sync_event_file(&store, session_id, &event_file, None, None).unwrap();
        assert_eq!(count, 1);
        let flows = store.list_flows(session_id).unwrap();
        assert_eq!(flows.len(), 1);
        assert_eq!(flows[0].method, "GET");
    }

    #[test]
    fn start_proxy_uses_appscope_cert_confdir() {
        let dir = tempdir().unwrap();
        let paths = AppScopePaths::new(dir.path());
        let proxy = start_proxy(&paths, "sess-ca-confdir", true).unwrap();

        assert!(
            paths.certs_dir().join("mitmproxy-ca-cert.pem").exists(),
            "expected mitmproxy CA certificate under AppScope certs dir"
        );
        assert!(
            paths.certs_dir().join("mitmproxy-ca.pem").exists(),
            "expected mitmproxy CA keypair under AppScope certs dir"
        );

        proxy.stop();
    }
}

use crate::cert::generate_certificate;
use crate::models::{Flow, HeaderPair};
use crate::paths::AppScopePaths;
use crate::store::FlowStore;
use chrono::Utc;
use serde::Deserialize;
use std::io::{BufRead, BufReader, Write};
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

pub fn start_proxy(paths: &AppScopePaths, session_id: &str) -> Result<ProxyRuntime, String> {
    let mitmdump = find_mitmdump()?;
    generate_certificate(paths)?;
    let port = available_port()?;
    let event_file = paths.proxy_events_dir().join(format!("{session_id}.jsonl"));
    let addon_file = paths.logs_dir().join(format!("{session_id}_addon.py"));
    write_addon_script(&addon_file)?;

    if event_file.exists() {
        std::fs::remove_file(&event_file).map_err(|e| e.to_string())?;
    }

    let upstream_proxy = detect_system_http_proxy();

    let mut cmd = Command::new(mitmdump);
    cmd.arg("-q")
        .arg("-p")
        .arg(port.to_string())
        .arg("--ssl-insecure");

    if let Some((host, proxy_port)) = &upstream_proxy {
        cmd.arg("--mode")
            .arg(format!("upstream:http://{host}:{proxy_port}"));
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

pub fn sync_event_file(
    store: &FlowStore,
    session_id: &str,
    event_file: &Path,
) -> Result<usize, String> {
    if !event_file.exists() {
        return Ok(0);
    }

    let file = std::fs::File::open(event_file).map_err(|e| e.to_string())?;
    let reader = BufReader::new(file);
    let mut count = 0usize;

    for line in reader.lines() {
        let line = line.map_err(|e| e.to_string())?;
        let trimmed = line.trim();
        if trimmed.is_empty() {
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

def response(flow: http.HTTPFlow):
    if not EVENT_FILE:
        return
    req = flow.request
    resp = flow.response
    if resp is None:
        return
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

        sync_event_file(&store, session_id, &event_file).unwrap();
        sync_event_file(&store, session_id, &event_file).unwrap();
        let flows = store.list_flows(session_id).unwrap();
        assert_eq!(flows.len(), 1);
        assert_eq!(flows[0].id, "flow-stable-1");
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

        let count = sync_event_file(&store, session_id, &event_file).unwrap();
        assert_eq!(count, 1);
        let flows = store.list_flows(session_id).unwrap();
        assert_eq!(flows.len(), 1);
        assert_eq!(flows[0].method, "GET");
    }

    #[test]
    fn start_proxy_uses_appscope_cert_confdir() {
        let dir = tempdir().unwrap();
        let paths = AppScopePaths::new(dir.path());
        let proxy = start_proxy(&paths, "sess-ca-confdir").unwrap();

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

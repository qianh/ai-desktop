use appscope_lib::models::Session;
use appscope_lib::paths::AppScopePaths;
use appscope_lib::proxy::{find_mitmdump, spawn_test_http_server, start_proxy, sync_event_file};
use appscope_lib::store::FlowStore;
use chrono::Utc;
use std::process::Command;
use std::thread;
use std::time::Duration;
use uuid::Uuid;

fn main() {
    if let Err(err) = run() {
        eprintln!("{err}");
        std::process::exit(1);
    }
    println!("MVP capture verified: real flow persisted");
}

fn run() -> Result<(), String> {
    find_mitmdump()?;

    let dir = std::env::temp_dir().join(format!("appscope-verify-{}", Uuid::new_v4()));
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let paths = AppScopePaths::new(&dir);
    let store = FlowStore::open(&paths)?;

    let (server_port, server_handle) = spawn_test_http_server()?;
    let session_id = Uuid::new_v4().to_string();

    store.save_session(&Session {
        id: session_id.clone(),
        target_type: "page".into(),
        target_id: "verify-page".into(),
        status: "capturing".into(),
        proxy_port: None,
        cdp_port: None,
        started_at: Utc::now(),
        ended_at: None,
        error: None,
    })?;

    let proxy = start_proxy(&paths, &session_id)?;
    let proxy_port = proxy.port;
    let event_file = proxy.event_file.clone();

    thread::sleep(Duration::from_millis(1200));

    let target = format!("http://127.0.0.1:{server_port}/api");
    let curl = Command::new("curl")
        .args([
            "-sS",
            "--max-time",
            "10",
            "-x",
            &format!("127.0.0.1:{proxy_port}"),
            &target,
        ])
        .output()
        .map_err(|e| format!("curl failed: {e}"))?;

    if !curl.status.success() {
        let stderr = String::from_utf8_lossy(&curl.stderr);
        proxy.stop();
        return Err(format!("curl through proxy failed: {stderr}"));
    }

    let mut synced = 0usize;
    for _ in 0..10 {
        thread::sleep(Duration::from_millis(300));
        synced = sync_event_file(&store, &session_id, &event_file, None, None)?;
        if synced > 0 {
            break;
        }
    }

    proxy.stop();
    drop(server_handle);

    if synced == 0 {
        let flows = store.list_flows(&session_id)?;
        if flows.is_empty() {
            let event_hint = if event_file.exists() {
                std::fs::read_to_string(&event_file).unwrap_or_default()
            } else {
                "event file missing".into()
            };
            return Err(format!(
                "no real flow persisted after proxied request (event_file={event_hint})"
            ));
        }
    }

    Ok(())
}

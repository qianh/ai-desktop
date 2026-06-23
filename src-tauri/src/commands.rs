//! Tauri command surface (spec §13).

use crate::apps::{launch_app, scan_installed_apps as scan_apps};
use crate::default_page::is_default_chat_page;
use crate::cert::{
    generate_certificate as generate_ca, get_certificate_status as ca_status,
    install_certificate as install_ca, open_certificate_guide as open_ca_guide,
    remove_certificate as remove_ca,
};
use crate::chrome::validate_url;
use crate::export::write_session_export;
use crate::models::{AppEntry, Page, Session};
use crate::paths::AppScopePaths;
use crate::proxy::{start_proxy, sync_event_file, ProxyRuntime};
use crate::store::FlowStore;
use chrono::Utc;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use uuid::Uuid;

#[derive(Serialize)]
pub struct AppInfo {
    pub id: Option<String>,
    pub name: String,
    pub bundle_id: String,
    pub app_path: String,
    pub icon_path: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SessionInfo {
    pub id: String,
    pub status: String,
    pub proxy_port: u16,
    pub page_url: String,
}

#[derive(Serialize)]
pub struct CertificateStatus {
    pub state: String,
}

#[derive(Serialize)]
pub struct PageInfo {
    pub id: String,
    pub name: String,
    pub url: String,
    pub status: String,
    pub intercept_reporting_enabled: bool,
}

struct AppState {
    store: FlowStore,
    paths: AppScopePaths,
    proxies: HashMap<String, ProxyRuntime>,
    /// Last processed physical line in each session event file for js_intercept emits.
    intercept_sync_lines: HashMap<String, usize>,
}

static STATE: OnceLock<Mutex<AppState>> = OnceLock::new();

fn state_mutex() -> &'static Mutex<AppState> {
    STATE.get_or_init(|| {
        let paths = AppScopePaths::from_default();
        let store = FlowStore::open(&paths).expect("failed to open flow store");
        Mutex::new(AppState {
            store,
            paths,
            proxies: HashMap::new(),
            intercept_sync_lines: HashMap::new(),
        })
    })
}

fn with_state<F, T>(f: F) -> Result<T, String>
where
    F: FnOnce(&mut AppState) -> Result<T, String>,
{
    let mut guard = state_mutex()
        .lock()
        .map_err(|_| "state lock poisoned".to_string())?;
    f(&mut guard)
}

fn app_to_info(app: &AppEntry) -> AppInfo {
    AppInfo {
        id: Some(app.id.clone()),
        name: app.name.clone(),
        bundle_id: app.bundle_id.clone(),
        app_path: app.app_path.clone(),
        icon_path: app.icon_path.clone(),
    }
}

fn scanned_app_to_info(app: &AppEntry) -> AppInfo {
    AppInfo {
        id: None,
        name: app.name.clone(),
        bundle_id: app.bundle_id.clone(),
        app_path: app.app_path.clone(),
        icon_path: app.icon_path.clone(),
    }
}

fn page_display_name(url: &str) -> String {
    validate_url(url)
        .ok()
        .and_then(|u| u.host_str().map(|h| h.to_string()))
        .unwrap_or_else(|| url.to_string())
}

/// §13.1 — enumerate installed `.app` bundles.
#[tauri::command]
pub fn scan_installed_apps() -> Result<Vec<AppInfo>, String> {
    scan_apps().map(|apps| apps.iter().map(scanned_app_to_info).collect())
}

#[tauri::command]
pub fn save_page(name: Option<String>, url: String) -> Result<PageInfo, String> {
    validate_url(&url).map_err(|e| e.message())?;
    let now = Utc::now();
    let page = Page {
        id: Uuid::new_v4().to_string(),
        name: name.unwrap_or_else(|| page_display_name(&url)),
        url,
        browser_app_id: None,
        profile_id: None,
        capture_mode: "chrome_session".into(),
        intercept_reporting_enabled: false,
        created_at: now,
        updated_at: now,
    };
    with_state(|state| {
        state.store.save_page(&page)?;
        Ok(PageInfo {
            id: page.id,
            name: page.name,
            url: page.url,
            status: "idle".into(),
            intercept_reporting_enabled: false,
        })
    })
}

#[tauri::command]
pub fn list_pages() -> Result<Vec<PageInfo>, String> {
    with_state(|state| {
        let pages = state.store.list_pages()?;
        Ok(pages
            .into_iter()
            .map(|p| PageInfo {
                id: p.id,
                name: p.name,
                url: p.url,
                status: "idle".into(),
                intercept_reporting_enabled: p.intercept_reporting_enabled,
            })
            .collect())
    })
}

#[tauri::command]
pub fn set_page_intercept_reporting(
    page_id: String,
    enabled: bool,
) -> Result<PageInfo, String> {
    with_state(|state| {
        let page = state.store.set_page_intercept_reporting(&page_id, enabled)?;
        if enabled {
            let session_ids = state.store.page_session_ids(&page_id)?;
            for session_id in session_ids {
                state.intercept_sync_lines.remove(&session_id);
            }
        }
        Ok(PageInfo {
            id: page.id,
            name: page.name,
            url: page.url,
            status: "idle".into(),
            intercept_reporting_enabled: page.intercept_reporting_enabled,
        })
    })
}

#[tauri::command]
pub fn remove_page(page_id: String) -> Result<(), String> {
    with_state(|state| {
        state
            .store
            .get_page(&page_id)?
            .ok_or_else(|| "page not found".to_string())?;
        let session_ids = state.store.page_session_ids(&page_id)?;

        for session_id in session_ids {
            if let Some(proxy) = state.proxies.remove(&session_id) {
                let event_file = proxy.event_file.clone();
                let _ = sync_event_file(
                    &state.store,
                    &session_id,
                    &event_file,
                    None,
                    None,
                );
                state.intercept_sync_lines.remove(&session_id);
                proxy.stop();
            }
        }

        state.store.delete_page(&page_id)
    })
}

#[tauri::command]
pub fn save_app(name: String, bundle_id: String, app_path: String) -> Result<AppInfo, String> {
    let now = Utc::now();
    let app = AppEntry {
        id: Uuid::new_v4().to_string(),
        name,
        bundle_id,
        app_path: app_path.clone(),
        icon_path: None,
        launch_mode: "normal".into(),
        created_at: now,
        updated_at: now,
    };
    with_state(|state| {
        state.store.save_app(&app)?;
        Ok(app_to_info(&app))
    })
}

#[tauri::command]
pub fn list_apps() -> Result<Vec<AppInfo>, String> {
    with_state(|state| {
        let apps = state.store.list_apps()?;
        Ok(apps.iter().map(app_to_info).collect())
    })
}

#[tauri::command]
pub fn launch_app_command(app_id: String) -> Result<(), String> {
    with_state(|state| {
        let apps = state.store.list_apps()?;
        let app = apps
            .into_iter()
            .find(|a| a.id == app_id)
            .ok_or_else(|| "app not found".to_string())?;
        launch_app(&app.app_path)
    })
}

#[tauri::command]
pub fn remove_app(app_id: String) -> Result<(), String> {
    with_state(|state| {
        let apps = state.store.list_apps()?;
        apps.into_iter()
            .find(|a| a.id == app_id)
            .ok_or_else(|| "app not found".to_string())?;
        state.store.delete_app(&app_id)
    })
}

/// §13.2 — start proxy and return a session; the frontend opens the page in an embedded webview.
#[tauri::command]
pub fn open_page_with_capture(page_id: String) -> Result<SessionInfo, String> {
    open_page_with_capture_core(&page_id)
}

pub fn open_page_with_capture_core(page_id: &str) -> Result<SessionInfo, String> {
    with_state(|state| {
        let page = state
            .store
            .get_page(page_id)?
            .ok_or_else(|| "page not found".to_string())?;
        validate_url(&page.url).map_err(|e| e.message())?;

        let session_id = Uuid::new_v4().to_string();
        let chain_upstream = !is_default_chat_page(&page.url);
        let proxy = start_proxy(&state.paths, &session_id, chain_upstream).map_err(|e| {
            if e.contains("mitmdump not found") {
                "ProxyNotFound: mitmdump not found".to_string()
            } else {
                format!("ProxyFailed: {e}")
            }
        })?;
        let proxy_port = proxy.port;
        let event_file = proxy.event_file.clone();

        state.proxies.insert(session_id.clone(), proxy);

        let session = Session {
            id: session_id.clone(),
            target_type: "page".into(),
            target_id: page.id.clone(),
            status: "capturing".into(),
            proxy_port: Some(proxy_port),
            cdp_port: None,
            started_at: Utc::now(),
            ended_at: None,
            error: None,
        };
        state.store.save_session(&session)?;

        // Best-effort initial sync after short delay for first navigation.
        std::thread::sleep(std::time::Duration::from_millis(300));
        let _ = sync_event_file(
            &state.store,
            &session_id,
            &event_file,
            None,
            None,
        );

        Ok(SessionInfo {
            id: session_id,
            status: "capturing".into(),
            proxy_port,
            page_url: page.url.clone(),
        })
    })
}

/// §13.3 — stop a capture session and release its resources.
#[tauri::command]
pub fn stop_session(session_id: String) -> Result<(), String> {
    with_state(|state| {
        if let Some(proxy) = state.proxies.remove(&session_id) {
            let event_file = proxy.event_file.clone();
            let _ = sync_event_file(
                &state.store,
                &session_id,
                &event_file,
                None,
                None,
            );
            state.intercept_sync_lines.remove(&session_id);
            proxy.stop();
        }
        if let Some(mut session) = state.store.get_session(&session_id)? {
            session.status = "stopped".into();
            session.ended_at = Some(Utc::now());
            state.store.save_session(&session)?;
        }
        Ok(())
    })
}

/// §13.4 — list captured flows for a session.
#[tauri::command]
pub fn list_flows(app: tauri::AppHandle, session_id: String) -> Result<Vec<serde_json::Value>, String> {
    with_state(|state| {
        if let Some(proxy) = state.proxies.get(&session_id) {
            let line_cursor = state
                .intercept_sync_lines
                .entry(session_id.clone())
                .or_insert(0);
            let _ = sync_event_file(
                &state.store,
                &session_id,
                &proxy.event_file,
                Some(&app),
                Some(line_cursor),
            );
        }
        let flows = state.store.list_flows(&session_id)?;
        flows
            .into_iter()
            .map(|f| serde_json::to_value(f).map_err(|e| e.to_string()))
            .collect()
    })
}

/// §13.5 — full detail for a single flow.
#[tauri::command]
pub fn get_flow_detail(flow_id: String) -> Result<serde_json::Value, String> {
    with_state(|state| {
        let detail = state
            .store
            .get_flow_detail(&flow_id)?
            .ok_or_else(|| "flow not found".to_string())?;
        serde_json::to_value(detail).map_err(|e| e.to_string())
    })
}

#[tauri::command]
pub fn export_session(session_id: String, format: String) -> Result<String, String> {
    with_state(|state| {
        let ext = if format == "har" { "har" } else { "json" };
        let output = state
            .paths
            .exports_dir()
            .join(format!("{session_id}.{ext}"));
        write_session_export(&state.store, &session_id, &format, &output)?;
        Ok(output.to_string_lossy().to_string())
    })
}

/// §13.6 — certificate management.
#[tauri::command]
pub fn get_certificate_status() -> Result<CertificateStatus, String> {
    with_state(|state| {
        let status = ca_status(&state.paths);
        Ok(CertificateStatus {
            state: status.state,
        })
    })
}

#[tauri::command]
pub fn generate_certificate() -> Result<(), String> {
    with_state(|state| generate_ca(&state.paths))
}

#[tauri::command]
pub fn install_certificate() -> Result<(), String> {
    with_state(|state| install_ca(&state.paths))
}

#[tauri::command]
pub fn open_certificate_guide() -> Result<(), String> {
    with_state(|state| open_ca_guide(&state.paths))
}

#[tauri::command]
pub fn remove_certificate() -> Result<(), String> {
    with_state(|state| remove_ca(&state.paths))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::paths::AppScopePaths;
    use crate::store::FlowStore;
    use chrono::Utc;
    use tempfile::tempdir;

    fn init_test_state(dir: &std::path::Path) {
        let paths = AppScopePaths::new(dir);
        let store = FlowStore::open(&paths).unwrap();
        let _ = STATE.set(Mutex::new(AppState {
            store,
            paths,
            proxies: HashMap::new(),
            intercept_sync_lines: HashMap::new(),
        }));
    }

    #[test]
    fn open_page_with_capture_errors_when_page_missing() {
        let dir = tempdir().unwrap();
        init_test_state(dir.path());
        let err = open_page_with_capture_core("missing").unwrap_err();
        assert!(err.contains("page not found"));
    }

    #[test]
    fn open_page_with_capture_errors_on_invalid_url_page() {
        let dir = tempdir().unwrap();
        init_test_state(dir.path());
        let now = Utc::now();
        let page = Page {
            id: "page-bad".into(),
            name: "Bad".into(),
            url: "not a url".into(),
            browser_app_id: None,
            profile_id: None,
            capture_mode: "chrome_session".into(),
            intercept_reporting_enabled: false,
            created_at: now,
            updated_at: now,
        };
        state_mutex()
            .lock()
            .unwrap()
            .store
            .save_page(&page)
            .unwrap();
        let err = open_page_with_capture_core("page-bad").unwrap_err();
        assert!(err.contains("InvalidUrl") || err.contains("Invalid URL"));
    }
}

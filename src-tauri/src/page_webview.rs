use tauri::webview::WebviewBuilder;
use tauri::Emitter;
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, WebviewUrl};

const PAGE_WEBVIEW_USER_AGENT: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

#[derive(Clone, serde::Serialize)]
struct PageWebviewLoadEvent {
    page_id: String,
    label: String,
    event: String,
    url: String,
}

pub fn sanitize_webview_label(page_id: &str) -> String {
    let mut label = format!(
        "page-{}",
        page_id
            .chars()
            .map(|c| {
                if c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '/' | ':') {
                    c
                } else {
                    '-'
                }
            })
            .collect::<String>()
    );
    if label.len() > 96 {
        label.truncate(96);
    }
    label
}

fn emit_page_load(
    app: &AppHandle,
    page_id: &str,
    label: &str,
    event: &str,
    url: &str,
) {
    let _ = app.emit(
        "page-webview-load",
        PageWebviewLoadEvent {
            page_id: page_id.to_string(),
            label: label.to_string(),
            event: event.to_string(),
            url: url.to_string(),
        },
    );
    eprintln!("[appscope] page webview {label} {event} {url}");
}

#[tauri::command]
pub fn mount_page_webview(
    app: AppHandle,
    page_id: String,
    url: String,
    proxy_port: u16,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let label = sanitize_webview_label(&page_id);

    if let Some(existing) = app.get_webview(&label) {
        existing
            .close()
            .map_err(|e| format!("close existing webview: {e}"))?;
    }

    let window = app
        .get_window("main")
        .ok_or_else(|| "main window not found".to_string())?;

    let target = url::Url::parse(&url).map_err(|e| format!("invalid url: {e}"))?;
    let proxy = url::Url::parse(&format!("http://127.0.0.1:{proxy_port}"))
        .map_err(|e| format!("invalid proxy url: {e}"))?;

    let load_app = app.clone();
    let load_page_id = page_id.clone();
    let load_label = label.clone();
    let nav_app = app.clone();
    let nav_page_id = page_id.clone();
    let nav_label = label.clone();

    let builder = WebviewBuilder::new(&label, WebviewUrl::External(target.clone()))
        .proxy_url(proxy)
        .user_agent(PAGE_WEBVIEW_USER_AGENT)
        .focused(true)
        .zoom_hotkeys_enabled(true)
        .on_navigation({
            let label = label.clone();
            move |nav_url| {
                emit_page_load(
                    &nav_app,
                    &nav_page_id,
                    &nav_label,
                    "started",
                    nav_url.as_str(),
                );
                eprintln!("[appscope] page webview {label} navigate {nav_url}");
                true
            }
        })
        .on_page_load(move |_webview, payload| {
            let event = match payload.event() {
                tauri::webview::PageLoadEvent::Started => "started",
                tauri::webview::PageLoadEvent::Finished => "finished",
            };
            emit_page_load(
                &load_app,
                &load_page_id,
                &load_label,
                event,
                payload.url().as_str(),
            );
        });

    let webview = window
        .add_child(
            builder,
            LogicalPosition::new(x, y),
            LogicalSize::new(width.max(1.0), height.max(1.0)),
        )
        .map_err(|e| format!("create page webview: {e}"))?;

    if let Err(e) = webview.navigate(target) {
        eprintln!("[appscope] page webview navigate: {e}");
    }

    if let Err(e) = webview.show() {
        eprintln!("[appscope] page webview show: {e}");
    }
    if let Err(e) = webview.set_focus() {
        eprintln!("[appscope] page webview focus: {e}");
    }

    Ok(())
}

#[tauri::command]
pub fn get_page_webview_url(app: AppHandle, page_id: String) -> Result<Option<String>, String> {
    let label = sanitize_webview_label(&page_id);
    let webview = app
        .get_webview(&label)
        .ok_or_else(|| "page webview not found".to_string())?;
    match webview.url() {
        Ok(url) => Ok(Some(url.to_string())),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn close_page_webview(app: AppHandle, page_id: String) -> Result<(), String> {
    let label = sanitize_webview_label(&page_id);
    if let Some(webview) = app.get_webview(&label) {
        webview.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn sync_page_webview_bounds(
    app: AppHandle,
    page_id: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let label = sanitize_webview_label(&page_id);
    let webview = app
        .get_webview(&label)
        .ok_or_else(|| "page webview not found".to_string())?;
    webview
        .set_position(LogicalPosition::new(x, y))
        .map_err(|e| e.to_string())?;
    webview
        .set_size(LogicalSize::new(width.max(1.0), height.max(1.0)))
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::sanitize_webview_label;

    #[test]
    fn label_allows_uuid_page_ids() {
        assert_eq!(
            sanitize_webview_label("e46554d6-7807-4e43-8f12-2f14ac39238f"),
            "page-e46554d6-7807-4e43-8f12-2f14ac39238f"
        );
    }
}
use tauri::webview::WebviewBuilder;
use tauri::Emitter;
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, WebviewUrl};
use tauri::webview::Color;

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
    intercept_reporting_enabled: bool,
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

    let load_app = app.clone();
    let load_page_id = page_id.clone();
    let load_label = label.clone();
    let nav_app = app.clone();
    let nav_page_id = page_id.clone();
    let nav_label = label.clone();

    let mut builder = WebviewBuilder::new(&label, WebviewUrl::External(target.clone()))
        .user_agent(PAGE_WEBVIEW_USER_AGENT)
        .background_color(Color(255, 255, 255, 255))
        .data_store_identifier(page_id_to_data_store_uuid(&page_id));
    if proxy_port > 0 {
        let proxy = url::Url::parse(&format!("http://127.0.0.1:{proxy_port}"))
            .map_err(|e| format!("invalid proxy url: {e}"))?;
        builder = builder.proxy_url(proxy);
    }
    let mut builder = builder
        .focused(true)
        .zoom_hotkeys_enabled(true);
    if let Some(intercept_script) = intercept_script_if_enabled(
        intercept_reporting_enabled,
        &page_id,
        proxy_port,
    ) {
        builder = builder.initialization_script(&intercept_script);
    }
    let builder = builder
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
pub fn set_page_webview_visible(app: AppHandle, page_id: String, visible: bool) -> Result<(), String> {
    let label = sanitize_webview_label(&page_id);
    if let Some(webview) = app.get_webview(&label) {
        if visible {
            webview.show().map_err(|e| e.to_string())?;
        } else {
            webview.hide().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
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


fn make_intercept_script(page_id: &str, _proxy_port: u16) -> String {
    format!(
        r#"
(function() {{
    if (window.__APPSCOPE_INTERCEPT_INIT__) return;
    window.__APPSCOPE_INTERCEPT_INIT__ = true;
    console.log('[appscope] intercept script injected, page_id=' + '{page_id}');

    var PAGE_ID = '{page_id}';
    // Same-origin HTTPS path — avoids mixed-content block on HTTPS chat pages.
    var DRAIN_URL = '/__appscope_intercept__';
    var MAX_BODY_SIZE = 50000;
    // Non-streaming JSON responses (e.g. GET /conversation) can be much larger
    var MAX_BODY_SIZE_JSON = 500000;
    var originalFetch = window.fetch;
    var pending = [];
    var drainCount = 0;

    function genId() {{
        return (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : (Date.now().toString(36) + Math.random().toString(36).slice(2));
    }}
    function truncate(text, limit) {{
        if (typeof text !== 'string') return text;
        return text.length > limit ? text.slice(0, limit) + '...[truncated]' : text;
    }}
    function looksBinary(text) {{
        if (typeof text !== 'string') return false;
        if (text.charCodeAt(0) === 0x1f && text.charCodeAt(1) === 0x8b) return true;
        if (text.length < 8) return false;
        var sample = text.slice(0, 512);
        var nonPrintable = 0;
        for (var i = 0; i < sample.length; i++) {{
            var code = sample.charCodeAt(i);
            if (code < 32 && code !== 9 && code !== 10 && code !== 13) nonPrintable++;
        }}
        return nonPrintable > sample.length * 0.1;
    }}
    function sanitizeBodyText(text) {{
        if (text == null) return null;
        var nullChar = String.fromCharCode(0);
        var stripped = text.indexOf(nullChar) !== -1 ? text.split(nullChar).join('') : text;
        if (looksBinary(stripped)) return '[binary body omitted]';
        return stripped;
    }}
    function headersToObject(headers) {{
        var obj = {{}};
        if (headers && typeof headers.forEach === 'function') {{
            headers.forEach(function(value, key) {{ obj[key] = value; }});
        }}
        return obj;
    }}
    function safeBodyText(body) {{
        if (body == null) return null;
        if (typeof body === 'string') return sanitizeBodyText(truncate(body, MAX_BODY_SIZE));
        try {{ return sanitizeBodyText(truncate(JSON.stringify(body), MAX_BODY_SIZE)); }}
        catch(e) {{ return '[unserializable]'; }}
    }}

    setInterval(function() {{
        drainCount++;
        if (drainCount <= 3 || pending.length > 0) {{
            console.log('[appscope] drain tick #' + drainCount + ', pending=' + pending.length);
        }}
        if (pending.length === 0) return;
        var batch = pending.splice(0);
        console.log('[appscope] sending ' + batch.length + ' items to ' + DRAIN_URL);
        originalFetch.call(window, DRAIN_URL, {{
            method: 'POST',
            headers: {{'Content-Type': 'application/json', 'X-Page-Id': PAGE_ID}},
            body: JSON.stringify(batch),
        }}).then(function(r) {{
            console.log('[appscope] drain POST status=' + r.status);
        }}).catch(function(e) {{
            console.error('[appscope] drain POST failed:', e);
        }});
    }}, 2000);

    window.fetch = async function() {{
        var args = arguments;
        var input = args[0];
        var init = args[1] || {{}};
        var url = typeof input === 'string' ? input : (input && input.url ? input.url : String(input));

        if (url.indexOf('/__appscope_intercept__') !== -1
            || url.indexOf('/__intercept__') !== -1
            || url.indexOf('appscope.local') !== -1) {{
            return originalFetch.apply(this, args);
        }}

        if (pending.length < 3) {{
            console.log('[appscope] intercepted fetch: ' + url.slice(0, 80));
        }}

        var method = (init.method || (input && input.method) || 'GET').toUpperCase();
        var startTime = Date.now();

        var reqBody = null;
        if (init.body != null) {{
            reqBody = safeBodyText(init.body);
        }} else if (input && typeof input !== 'string' && input.body) {{
            try {{
                var cloned = input.clone();
                reqBody = truncate(await cloned.text(), MAX_BODY_SIZE);
            }} catch(e) {{ reqBody = '[unreadable]'; }}
        }}

        var reqHeaders = {{}};
        if (init.headers) {{
            reqHeaders = headersToObject(new Headers(init.headers));
        }} else if (input && typeof input !== 'string' && input.headers) {{
            reqHeaders = headersToObject(input.headers);
        }}

        try {{
            var response = await originalFetch.apply(this, args);
            var clone = response.clone();
            var duration = Date.now() - startTime;
            var respHeaders = headersToObject(clone.headers);
            var contentType = (clone.headers.get('content-type') || '').toLowerCase();

            var respBody = null;
            try {{
                if (contentType.includes('text/event-stream') || contentType.includes('stream')) {{
                    var reader = clone.body.getReader();
                    var decoder = new TextDecoder();
                    var chunks = '';
                    while (true) {{
                        var chunk = await reader.read();
                        if (chunk.done) break;
                        chunks += decoder.decode(chunk.value, {{ stream: true }});
                        if (chunks.length > MAX_BODY_SIZE) {{
                            chunks = chunks.slice(0, MAX_BODY_SIZE) + '...[truncated]';
                            break;
                        }}
                    }}
                    respBody = sanitizeBodyText(chunks);
                }} else {{
                    var bodyLimit = (contentType.includes('application/json') || contentType === '') ? MAX_BODY_SIZE_JSON : MAX_BODY_SIZE;
                    respBody = sanitizeBodyText(truncate(await clone.text(), bodyLimit));
                }}
            }} catch(e) {{
                respBody = '[read error: ' + e.message + ']';
            }}

            pending.push({{
                id: genId(), timestamp: startTime, url: url, method: method,
                req_headers: reqHeaders, req_body: reqBody,
                status: clone.status, resp_headers: respHeaders,
                resp_body: respBody, duration_ms: duration
            }});

            return response;
        }} catch(err) {{
            pending.push({{
                id: genId(), timestamp: startTime, url: url, method: method,
                req_headers: reqHeaders, req_body: reqBody,
                status: 0, resp_headers: {{}},
                resp_body: null, duration_ms: Date.now() - startTime,
                error: err.message
            }});
            throw err;
        }}
    }};
}})();
"#,
        page_id = page_id.replace('\'', "\\'")
    )
}

#[cfg(test)]
mod tests {
    use super::sanitize_webview_label;
    use super::page_id_to_data_store_uuid;

    #[test]
    fn data_store_uuid_returns_uuid_bytes_for_valid_uuid() {
        let uuid_str = "e46554d6-7807-4e43-8f12-2f14ac39238f";
        let bytes = page_id_to_data_store_uuid(uuid_str);
        let expected = uuid::Uuid::parse_str(uuid_str).unwrap();
        assert_eq!(bytes, *expected.as_bytes());
    }

    #[test]
    fn data_store_uuid_does_not_panic_for_non_uuid() {
        let bytes = page_id_to_data_store_uuid("not-a-uuid");
        assert_eq!(bytes.len(), 16);
    }

    #[test]
    fn data_store_uuid_does_not_panic_for_empty_string() {
        let bytes = page_id_to_data_store_uuid("");
        assert_eq!(bytes, [0u8; 16]);
    }

    #[test]
    fn label_allows_uuid_page_ids() {
        assert_eq!(
            sanitize_webview_label("e46554d6-7807-4e43-8f12-2f14ac39238f"),
            "page-e46554d6-7807-4e43-8f12-2f14ac39238f"
        );
    }

    #[test]
    fn intercept_script_contains_key_parts() {
        let script = super::make_intercept_script("test-page-id", 61651);
        assert!(script.contains("__APPSCOPE_INTERCEPT_INIT__"));
        assert!(script.contains("window.fetch"));
        assert!(script.contains("originalFetch"));
        assert!(script.contains("/__appscope_intercept__"));
        assert!(script.contains("[binary body omitted]"));
        assert!(script.contains("test-page-id"));
    }

    #[test]
    fn intercept_script_handles_streaming() {
        let script = super::make_intercept_script("test", 8080);
        assert!(script.contains("text/event-stream"));
        assert!(script.contains("getReader"));
    }

    #[test]
    fn intercept_script_optional_when_disabled() {
        assert!(super::intercept_script_if_enabled(false, "page-1", 8080).is_none());
        assert!(super::intercept_script_if_enabled(true, "page-1", 0).is_none());
        let script = super::intercept_script_if_enabled(true, "page-1", 8080).expect("script");
        assert!(script.contains("__APPSCOPE_INTERCEPT_INIT__"));
        assert!(script.contains("page-1"));
    }
}

pub(crate) fn page_id_to_data_store_uuid(page_id: &str) -> [u8; 16] {
    if let Ok(uuid) = page_id.parse::<uuid::Uuid>() {
        return *uuid.as_bytes();
    }
    let mut bytes = [0u8; 16];
    let src = page_id.as_bytes();
    let len = src.len().min(16);
    bytes[..len].copy_from_slice(&src[..len]);
    bytes
}

pub(crate) fn intercept_script_if_enabled(
    intercept_reporting_enabled: bool,
    page_id: &str,
    proxy_port: u16,
) -> Option<String> {
    if intercept_reporting_enabled && proxy_port > 0 {
        Some(make_intercept_script(page_id, proxy_port))
    } else {
        None
    }
}

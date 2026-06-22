mod apps;
mod cert;
mod chrome;
mod commands;
mod export;
pub mod models;
mod page_webview;
pub mod paths;
pub mod proxy;
pub mod store;

use commands::{
    export_session, generate_certificate, get_certificate_status, get_flow_detail,
    install_certificate, launch_app_command, list_apps, list_flows, list_pages,
    open_certificate_guide, open_page_with_capture, remove_app, remove_certificate, remove_page,
    save_app, save_page, scan_installed_apps, stop_session,
};
use page_webview::{
    close_page_webview, get_page_webview_url, mount_page_webview,
    set_page_webview_visible, sync_page_webview_bounds,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            scan_installed_apps,
            save_page,
            list_pages,
            remove_page,
            save_app,
            list_apps,
            launch_app_command,
            remove_app,
            open_page_with_capture,
            stop_session,
            list_flows,
            get_flow_detail,
            export_session,
            get_certificate_status,
            generate_certificate,
            install_certificate,
            open_certificate_guide,
            remove_certificate,
            mount_page_webview,
            get_page_webview_url,
            close_page_webview,
            set_page_webview_visible,
            sync_page_webview_bounds,
        ])
        .run(tauri::generate_context!())
        .expect("error while running AppScope");
}

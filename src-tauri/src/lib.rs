mod cert;
mod chat_commands;
mod chat_providers;
mod chrome;
mod commands;
mod default_page;
mod export;
pub mod models;
mod page_webview;
pub mod paths;
pub mod proxy;
pub mod store;

use chat_commands::{
    cancel_codex_task, confirm_codex_task, create_chat_thread, delete_chat_memory_entry,
    delete_chat_thread, list_chat_memory_entries, list_chat_messages, list_chat_provider_profiles,
    list_chat_threads, preview_codex_task_command, rename_chat_thread, save_chat_memory_entry,
    save_chat_provider_profile, send_chat_message,
};
use commands::{
    export_session, generate_certificate, get_certificate_status, get_flow_detail,
    install_certificate, list_flows, list_pages, open_certificate_guide, open_page_with_capture,
    remove_certificate, remove_page, save_page, set_page_intercept_reporting, stop_session,
};
use page_webview::{
    close_page_webview, get_page_webview_url, mount_page_webview, open_main_devtools,
    open_page_webview_devtools, set_page_webview_visible, sync_page_webview_bounds,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            save_page,
            list_pages,
            set_page_intercept_reporting,
            remove_page,
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
            open_page_webview_devtools,
            open_main_devtools,
            close_page_webview,
            set_page_webview_visible,
            sync_page_webview_bounds,
            list_chat_provider_profiles,
            save_chat_provider_profile,
            list_chat_threads,
            create_chat_thread,
            rename_chat_thread,
            delete_chat_thread,
            list_chat_messages,
            send_chat_message,
            list_chat_memory_entries,
            save_chat_memory_entry,
            delete_chat_memory_entry,
            preview_codex_task_command,
            confirm_codex_task,
            cancel_codex_task,
        ])
        .build(tauri::generate_context!())
        .expect("error while building AppScope");

    app.run(|_, event| match event {
        tauri::RunEvent::WindowEvent {
            event: tauri::WindowEvent::CloseRequested { .. },
            ..
        }
        | tauri::RunEvent::ExitRequested { .. }
        | tauri::RunEvent::Exit => commands::stop_all_capture_sessions(),
        _ => {}
    });
}

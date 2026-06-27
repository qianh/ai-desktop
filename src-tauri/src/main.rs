// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Workaround for wry 0.55.1 crash on macOS 26+:
    // CFRelease(NULL) in platform_webview_version() is now fatal (was silently ignored before).
    // Forcing WKWebView class lookup here ensures the WebKit framework fully initializes
    // and registers its NSBundle before wry calls [NSBundle bundleWithIdentifier:@"com.apple.WebKit"].
    #[cfg(target_os = "macos")]
    unsafe {
        extern "C" {
            fn objc_lookUpClass(name: *const std::ffi::c_char) -> *const std::ffi::c_void;
        }
        let _ = objc_lookUpClass(c"WKWebView".as_ptr() as _);
    }

    appscope_lib::run()
}

use crate::models::AppEntry;
use chrono::Utc;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use uuid::Uuid;

pub fn scan_directories() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Ok(home) = std::env::var("HOME") {
        dirs.push(PathBuf::from("/Applications"));
        dirs.push(PathBuf::from(home).join("Applications"));
    } else {
        dirs.push(PathBuf::from("/Applications"));
    }
    dirs
}

pub fn scan_installed_apps() -> Result<Vec<AppEntry>, String> {
    let mut apps = Vec::new();
    let now = Utc::now();

    for dir in scan_directories() {
        if !dir.exists() {
            continue;
        }
        let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) != Some("app") {
                continue;
            }
            if let Some(parsed) = parse_app_bundle(&path) {
                apps.push(AppEntry {
                    id: Uuid::new_v4().to_string(),
                    name: parsed.0,
                    bundle_id: parsed.1,
                    app_path: path.to_string_lossy().to_string(),
                    icon_path: None,
                    launch_mode: "normal".into(),
                    created_at: now,
                    updated_at: now,
                });
            }
        }
    }

    apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(apps)
}

pub fn parse_app_bundle(app_path: &Path) -> Option<(String, String)> {
    let plist = app_path.join("Contents/Info.plist");
    if !plist.exists() {
        return None;
    }

    let name = read_plist_value(&plist, "CFBundleName")
        .or_else(|| read_plist_value(&plist, "CFBundleDisplayName"))
        .unwrap_or_else(|| {
            app_path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("App")
                .to_string()
        });
    let bundle_id = read_plist_value(&plist, "CFBundleIdentifier")
        .unwrap_or_else(|| format!("local.{}", name.to_lowercase().replace(' ', "")));

    Some((name, bundle_id))
}

fn read_plist_value(plist: &Path, key: &str) -> Option<String> {
    let output = Command::new("plutil")
        .args(["-extract", key, "raw", "-o", "-"])
        .arg(plist)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}

pub fn build_launch_command(app_path: &str) -> Vec<String> {
    vec!["open".into(), "-a".into(), app_path.into()]
}

pub fn launch_app(app_path: &str) -> Result<(), String> {
    let args = build_launch_command(app_path);
    let status = Command::new(&args[0])
        .args(&args[1..])
        .status()
        .map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err("failed to launch app".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn write_fake_app(dir: &Path, name: &str, bundle_id: &str) -> PathBuf {
        let app = dir.join(format!("{name}.app"));
        let contents = app.join("Contents");
        fs::create_dir_all(&contents).unwrap();
        let plist = format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleName</key><string>{name}</string>
<key>CFBundleIdentifier</key><string>{bundle_id}</string>
</dict></plist>"#
        );
        fs::write(contents.join("Info.plist"), plist).unwrap();
        app
    }

    #[test]
    fn parse_app_bundle_reads_plist() {
        let dir = tempdir().unwrap();
        let app = write_fake_app(dir.path(), "Demo App", "com.demo.app");
        let parsed = parse_app_bundle(&app).unwrap();
        assert_eq!(parsed.0, "Demo App");
        assert_eq!(parsed.1, "com.demo.app");
    }

    #[test]
    fn build_launch_command_uses_open() {
        let cmd = build_launch_command("/Applications/Demo.app");
        assert_eq!(cmd, vec!["open", "-a", "/Applications/Demo.app"]);
    }
}

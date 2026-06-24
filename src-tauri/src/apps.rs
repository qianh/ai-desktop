use crate::models::AppEntry;
use base64::prelude::{Engine as _, BASE64_STANDARD};
use chrono::Utc;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use uuid::Uuid;

/// Pixel size for the rasterized icon. 64px stays crisp inside the modal's
/// 24×24 box on retina while keeping the base64 payload small (~6KB/app).
const ICON_PX: u32 = 64;

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

pub fn scan_installed_apps(cache_dir: &Path) -> Result<Vec<AppEntry>, String> {
    let now = Utc::now();

    // 1. Enumerate bundles + parse name/bundle_id (cheap, sequential).
    let mut bundles: Vec<(PathBuf, String, String)> = Vec::new();
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
            if let Some((name, bundle_id)) = parse_app_bundle(&path) {
                bundles.push((path, name, bundle_id));
            }
        }
    }

    // 2. Rasterize icons in parallel (the slow part — one `sips` spawn each).
    let icons = convert_icons_parallel(&bundles, cache_dir);

    // 3. Assemble entries.
    let mut apps: Vec<AppEntry> = bundles
        .into_iter()
        .zip(icons)
        .map(|((path, name, bundle_id), icon_path)| AppEntry {
            id: Uuid::new_v4().to_string(),
            name,
            bundle_id,
            app_path: path.to_string_lossy().to_string(),
            icon_path,
            launch_mode: "normal".into(),
            created_at: now,
            updated_at: now,
        })
        .collect();

    apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(apps)
}

/// Resolve each bundle's icon to a data URI across bounded worker threads.
fn convert_icons_parallel(
    bundles: &[(PathBuf, String, String)],
    cache_dir: &Path,
) -> Vec<Option<String>> {
    let n = bundles.len();
    let mut out: Vec<Option<String>> = vec![None; n];
    if n == 0 {
        return out;
    }
    let workers = std::thread::available_parallelism()
        .map(|p| p.get())
        .unwrap_or(4)
        .clamp(1, 8);
    let chunk = n.div_ceil(workers);

    std::thread::scope(|scope| {
        for (out_chunk, bundle_chunk) in out.chunks_mut(chunk).zip(bundles.chunks(chunk)) {
            scope.spawn(move || {
                for (slot, bundle) in out_chunk.iter_mut().zip(bundle_chunk) {
                    *slot = app_icon_data_uri(&bundle.0, cache_dir);
                }
            });
        }
    });

    out
}

/// `data:image/png;base64,...` URI for an app icon, or `None` when the bundle
/// ships no `.icns` (e.g. asset-catalog-only apps) or conversion fails. Never
/// errors — a missing icon simply falls back to the letter placeholder.
pub fn app_icon_data_uri(app_path: &Path, cache_dir: &Path) -> Option<String> {
    let icns = resolve_icns_path(app_path)?;
    let png = ensure_png_cache(app_path, &icns, cache_dir)?;
    let bytes = fs::read(&png).ok()?;
    if bytes.is_empty() {
        return None;
    }
    Some(format!("data:image/png;base64,{}", BASE64_STANDARD.encode(bytes)))
}

/// Locate the `.icns` file inside an app bundle. Prefers `CFBundleIconFile`
/// (with or without the `.icns` extension), then falls back to scanning
/// `Contents/Resources` for a likely app icon.
pub fn resolve_icns_path(app_path: &Path) -> Option<PathBuf> {
    let resources = app_path.join("Contents/Resources");
    let plist = app_path.join("Contents/Info.plist");

    if let Some(icon_file) = read_plist_value(&plist, "CFBundleIconFile") {
        let name = icon_file.trim();
        if !name.is_empty() {
            let direct = resources.join(name);
            if direct.is_file() {
                return Some(direct);
            }
            let with_ext = resources.join(format!("{name}.icns"));
            if with_ext.is_file() {
                return Some(with_ext);
            }
        }
    }

    let mut candidates: Vec<PathBuf> = fs::read_dir(&resources)
        .ok()?
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.extension().and_then(|s| s.to_str()) == Some("icns"))
        .collect();
    if candidates.is_empty() {
        return None;
    }
    candidates.sort();
    let preferred = candidates.iter().find(|p| {
        let n = p
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();
        n == "appicon.icns" || n == "icon.icns" || n.contains("appicon")
    });
    Some(preferred.cloned().unwrap_or_else(|| candidates[0].clone()))
}

/// Rasterize `.icns` → PNG via `sips`, cached on disk. Cache key combines a
/// hash of the app path (avoids same-name collisions across /Applications and
/// ~/Applications) with the icon's mtime (auto-invalidates on app update).
fn ensure_png_cache(app_path: &Path, icns: &Path, cache_dir: &Path) -> Option<PathBuf> {
    let key = fnv1a_hex(&app_path.to_string_lossy());
    let out = cache_dir.join(format!("{key}-{}.png", icns_mtime_secs(icns)));
    if out.is_file() {
        return Some(out);
    }
    fs::create_dir_all(cache_dir).ok()?;
    let result = Command::new("sips")
        .args(["-s", "format", "png", "-Z"])
        .arg(ICON_PX.to_string())
        .arg(icns)
        .arg("--out")
        .arg(&out)
        .output()
        .ok()?;
    if result.status.success() && out.is_file() {
        Some(out)
    } else {
        None
    }
}

fn icns_mtime_secs(icns: &Path) -> u64 {
    fs::metadata(icns)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn fnv1a_hex(s: &str) -> String {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for byte in s.bytes() {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
    }
    format!("{hash:016x}")
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
    fn resolve_icns_finds_resources_icon() {
        let dir = tempdir().unwrap();
        let app = write_fake_app(dir.path(), "Demo App", "com.demo.app");
        let res = app.join("Contents/Resources");
        fs::create_dir_all(&res).unwrap();
        fs::write(res.join("AppIcon.icns"), b"fake").unwrap();
        let icns = resolve_icns_path(&app).unwrap();
        assert_eq!(icns.file_name().unwrap(), "AppIcon.icns");
    }

    #[test]
    fn resolve_icns_none_when_absent() {
        let dir = tempdir().unwrap();
        let app = write_fake_app(dir.path(), "NoIcon", "com.demo.noicon");
        assert!(resolve_icns_path(&app).is_none());
    }

    #[test]
    fn app_icon_data_uri_none_without_icns() {
        let dir = tempdir().unwrap();
        let app = write_fake_app(dir.path(), "NoIcon", "com.demo.noicon");
        let cache = dir.path().join("cache");
        assert!(app_icon_data_uri(&app, &cache).is_none());
    }

    #[test]
    fn build_launch_command_uses_open() {
        let cmd = build_launch_command("/Applications/Demo.app");
        assert_eq!(cmd, vec!["open", "-a", "/Applications/Demo.app"]);
    }
}

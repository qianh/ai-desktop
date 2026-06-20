use crate::models::CertificateState;
use crate::paths::AppScopePaths;
use std::path::{Path, PathBuf};
use std::process::Command;

const CA_CERT_NAME: &str = "mitmproxy-ca-cert.pem";
const CA_KEYPAIR_NAME: &str = "mitmproxy-ca.pem";
const LEGACY_CA_CERT_NAME: &str = "appscope-ca.pem";
const LEGACY_CA_KEY_NAME: &str = "appscope-ca.key";

pub fn cert_paths(paths: &AppScopePaths) -> (PathBuf, PathBuf) {
    (
        paths.certs_dir().join(CA_CERT_NAME),
        paths.certs_dir().join(CA_KEYPAIR_NAME),
    )
}

pub fn get_certificate_status(paths: &AppScopePaths) -> CertificateState {
    let _ = migrate_legacy_certificate(paths);
    let (cert_path, key_path) = cert_paths(paths);
    if !cert_path.exists() && !key_path.exists() {
        return CertificateState {
            state: "NotGenerated".into(),
        };
    }
    if cert_path.exists() && key_path.exists() {
        if is_trusted_in_keychain() {
            return CertificateState {
                state: "Trusted".into(),
            };
        }
        if is_installed_in_keychain(&cert_path) {
            return CertificateState {
                state: "Installed".into(),
            };
        }
        return CertificateState {
            state: "Generated".into(),
        };
    }
    CertificateState {
        state: "Invalid".into(),
    }
}

pub fn generate_certificate(paths: &AppScopePaths) -> Result<(), String> {
    paths.ensure_dirs().map_err(|e| e.to_string())?;
    if migrate_legacy_certificate(paths)? {
        return Ok(());
    }

    let (cert_path, keypair_path) = cert_paths(paths);
    if cert_path.exists() && keypair_path.exists() {
        return Ok(());
    }

    let key_path = paths.certs_dir().join("mitmproxy-ca.key.tmp");
    let output = Command::new("openssl")
        .args([
            "req",
            "-x509",
            "-newkey",
            "rsa:2048",
            "-nodes",
            "-keyout",
            key_path.to_str().unwrap_or_default(),
            "-out",
            cert_path.to_str().unwrap_or_default(),
            "-days",
            "3650",
            "-subj",
            "/CN=AppScope Local CA/O=AppScope",
            "-addext",
            "basicConstraints=critical,CA:TRUE",
            "-addext",
            "keyUsage=critical,keyCertSign,cRLSign",
            "-addext",
            "extendedKeyUsage=serverAuth",
        ])
        .output()
        .map_err(|e| format!("openssl not available: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("failed to generate certificate: {}", stderr.trim()));
    }
    write_keypair_file(&key_path, &cert_path, &keypair_path)?;
    let _ = std::fs::remove_file(key_path);
    Ok(())
}

pub fn remove_certificate(paths: &AppScopePaths) -> Result<(), String> {
    let (cert_path, key_path) = cert_paths(paths);
    let _ = Command::new("security")
        .args(["delete-certificate", "-c", "AppScope Local CA"])
        .arg(login_keychain_path())
        .status();
    if cert_path.exists() {
        std::fs::remove_file(cert_path).map_err(|e| e.to_string())?;
    }
    if key_path.exists() {
        std::fs::remove_file(key_path).map_err(|e| e.to_string())?;
    }
    for legacy in legacy_cert_paths(paths) {
        if legacy.exists() {
            std::fs::remove_file(legacy).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

pub fn install_certificate(paths: &AppScopePaths) -> Result<(), String> {
    let (cert_path, _) = cert_paths(paths);
    if !cert_path.exists() {
        return Err("CertificateNotGenerated".into());
    }

    if is_trusted_in_keychain() {
        return open_keychain_access();
    }

    // Install AND trust the CA as a root. `add-trusted-cert -d` writes the admin
    // trust domain (System.keychain) and raises a GUI admin-auth prompt; this is
    // what actually makes WKWebView accept mitmproxy's per-site leaf certs.
    // Plain `add-certificates` only imports without trust, so pages stay blank.
    let trust = Command::new("security")
        .args(["add-trusted-cert", "-d", "-r", "trustRoot", "-k"])
        .arg("/Library/Keychains/System.keychain")
        .arg(&cert_path)
        .output()
        .map_err(|e| format!("security add-trusted-cert failed: {e}"))?;

    if trust.status.success() || is_trusted_in_keychain() {
        return Ok(());
    }

    // Fallback: user cancelled the auth prompt or admin domain is unavailable —
    // import into the login keychain and open Keychain Access for manual trust.
    let keychain = login_keychain_path();
    let import = Command::new("security")
        .args(["add-certificates", "-k"])
        .arg(&keychain)
        .arg(&cert_path)
        .output()
        .map_err(|e| format!("security add-certificates failed: {e}"))?;

    if !import.status.success() {
        let stderr = String::from_utf8_lossy(&import.stderr);
        let stdout = String::from_utf8_lossy(&import.stdout);
        let combined = format!("{stderr}{stdout}");
        if is_duplicate_keychain_error(&combined) || is_installed_in_keychain(&cert_path) {
            return open_keychain_access();
        }
        return Err(format!("failed to import certificate: {stderr}"));
    }

    open_keychain_access()
}

pub fn open_certificate_guide(paths: &AppScopePaths) -> Result<(), String> {
    let (cert_path, _) = cert_paths(paths);
    if !cert_path.exists() {
        return Err("CertificateNotGenerated".into());
    }
    if !is_installed_in_keychain(&cert_path) {
        install_certificate(paths)?;
        return Ok(());
    }
    open_keychain_access()
}

fn login_keychain_path() -> PathBuf {
    if let Ok(home) = std::env::var("HOME") {
        return Path::new(&home).join("Library/Keychains/login.keychain-db");
    }
    PathBuf::from("login.keychain-db")
}

fn legacy_cert_paths(paths: &AppScopePaths) -> [PathBuf; 2] {
    [
        paths.certs_dir().join(LEGACY_CA_CERT_NAME),
        paths.certs_dir().join(LEGACY_CA_KEY_NAME),
    ]
}

fn migrate_legacy_certificate(paths: &AppScopePaths) -> Result<bool, String> {
    let (cert_path, keypair_path) = cert_paths(paths);
    if cert_path.exists() && keypair_path.exists() {
        return Ok(false);
    }

    let [legacy_cert_path, legacy_key_path] = legacy_cert_paths(paths);
    if !legacy_cert_path.exists() || !legacy_key_path.exists() {
        return Ok(false);
    }

    std::fs::copy(&legacy_cert_path, &cert_path).map_err(|e| e.to_string())?;
    write_keypair_file(&legacy_key_path, &legacy_cert_path, &keypair_path)?;
    Ok(true)
}

fn write_keypair_file(
    key_path: &Path,
    cert_path: &Path,
    keypair_path: &Path,
) -> Result<(), String> {
    let key = std::fs::read_to_string(key_path).map_err(|e| e.to_string())?;
    let cert = std::fs::read_to_string(cert_path).map_err(|e| e.to_string())?;
    std::fs::write(keypair_path, format!("{}\n{}", key.trim_end(), cert)).map_err(|e| e.to_string())
}

fn is_duplicate_keychain_error(message: &str) -> bool {
    message.contains("-25294")
        || message.contains("errSecDuplicateItem")
        || message.contains("already in")
        || message.contains("SecItemAdd")
}

fn open_keychain_access() -> Result<(), String> {
    Command::new("open")
        .arg("-a")
        .arg("Keychain Access")
        .status()
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn is_installed_in_keychain(cert_path: &Path) -> bool {
    let file_fp = certificate_fingerprint(cert_path);
    let Some(file_fp) = file_fp else {
        return false;
    };
    let output = Command::new("security")
        .args(["find-certificate", "-c", "AppScope Local CA", "-Z"])
        .arg(login_keychain_path())
        .output();
    let Ok(out) = output else {
        return false;
    };
    if !out.status.success() {
        return false;
    }
    let stdout = String::from_utf8_lossy(&out.stdout);
    stdout
        .lines()
        .find_map(|line| line.strip_prefix("SHA-1 hash:").map(str::trim))
        .is_some_and(|hash| hash.eq_ignore_ascii_case(&file_fp))
}

fn certificate_fingerprint(cert_path: &Path) -> Option<String> {
    let output = Command::new("openssl")
        .args(["x509", "-in"])
        .arg(cert_path)
        .args(["-noout", "-fingerprint", "-sha1"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    stdout
        .split('=')
        .nth(1)
        .map(|fp| fp.trim().replace(':', ""))
}

// Whether the CA is configured as a trusted anchor in the keychain trust
// settings. IMPORTANT: `security verify-cert -c <self-signed root>` returns
// success for ANY structurally valid self-signed cert regardless of whether it
// is a trusted anchor, so it produces false "Trusted" readings — that is why
// WKWebView rejected mitmproxy's leaf certs while the UI showed "CA Trusted".
// Read the actual trust settings (admin domain first, then user domain) instead.
fn is_trusted_in_keychain() -> bool {
    for admin_domain in [true, false] {
        let mut cmd = Command::new("security");
        cmd.arg("dump-trust-settings");
        if admin_domain {
            cmd.arg("-d");
        }
        if let Ok(out) = cmd.output() {
            if String::from_utf8_lossy(&out.stdout).contains("AppScope Local CA") {
                return true;
            }
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn status_not_generated_when_missing_files() {
        let dir = tempdir().unwrap();
        let paths = AppScopePaths::new(dir.path());
        let status = get_certificate_status(&paths);
        assert_eq!(status.state, "NotGenerated");
    }

    #[test]
    fn remove_certificate_deletes_files() {
        let dir = tempdir().unwrap();
        let paths = AppScopePaths::new(dir.path());
        paths.ensure_dirs().unwrap();
        let (cert_path, key_path) = cert_paths(&paths);
        std::fs::write(&cert_path, "cert").unwrap();
        std::fs::write(&key_path, "key").unwrap();
        remove_certificate(&paths).unwrap();
        assert!(!cert_path.exists());
        assert!(!key_path.exists());
        assert_eq!(get_certificate_status(&paths).state, "NotGenerated");
    }

    #[test]
    fn status_generated_when_files_exist() {
        let dir = tempdir().unwrap();
        let paths = AppScopePaths::new(dir.path());
        paths.ensure_dirs().unwrap();
        let (cert_path, key_path) = cert_paths(&paths);
        std::fs::write(&cert_path, "-----BEGIN CERTIFICATE-----\n").unwrap();
        std::fs::write(&key_path, "-----BEGIN PRIVATE KEY-----\n").unwrap();
        let status = get_certificate_status(&paths);
        assert_eq!(status.state, "Generated");
    }

    #[test]
    fn generate_certificate_writes_mitmdump_ca_files() {
        let dir = tempdir().unwrap();
        let paths = AppScopePaths::new(dir.path());

        generate_certificate(&paths).unwrap();

        assert!(paths.certs_dir().join("mitmproxy-ca-cert.pem").exists());
        assert!(paths.certs_dir().join("mitmproxy-ca.pem").exists());
        assert_eq!(get_certificate_status(&paths).state, "Generated");
    }
}

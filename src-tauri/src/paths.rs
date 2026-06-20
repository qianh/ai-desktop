use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub struct AppScopePaths {
    pub root: PathBuf,
}

impl AppScopePaths {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }

    pub fn default_support_dir() -> PathBuf {
        dirs_support_base().join("AppScope")
    }

    pub fn from_default() -> Self {
        Self::new(Self::default_support_dir())
    }

    pub fn database_path(&self) -> PathBuf {
        self.root.join("appscope.db")
    }

    pub fn certs_dir(&self) -> PathBuf {
        self.root.join("certs")
    }

    pub fn profiles_dir(&self) -> PathBuf {
        self.root.join("profiles")
    }

    pub fn exports_dir(&self) -> PathBuf {
        self.root.join("exports")
    }

    pub fn logs_dir(&self) -> PathBuf {
        self.root.join("logs")
    }

    pub fn proxy_events_dir(&self) -> PathBuf {
        self.root.join("proxy-events")
    }

    pub fn ensure_dirs(&self) -> std::io::Result<()> {
        for dir in [
            &self.root,
            &self.certs_dir(),
            &self.profiles_dir(),
            &self.exports_dir(),
            &self.logs_dir(),
            &self.proxy_events_dir(),
        ] {
            std::fs::create_dir_all(dir)?;
        }
        Ok(())
    }
}

fn dirs_support_base() -> PathBuf {
    if let Ok(home) = std::env::var("HOME") {
        Path::new(&home).join("Library").join("Application Support")
    } else {
        PathBuf::from("/tmp")
    }
}

use url::Url;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ChromeError {
    InvalidUrl(String),
}

impl ChromeError {
    pub fn message(&self) -> String {
        match self {
            ChromeError::InvalidUrl(url) => format!("Invalid URL: {url}"),
        }
    }
}

pub fn validate_url(raw: &str) -> Result<Url, ChromeError> {
    let trimmed = raw.trim();
    let with_scheme = if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        trimmed.to_string()
    } else {
        format!("https://{trimmed}")
    };
    Url::parse(&with_scheme).map_err(|_| ChromeError::InvalidUrl(raw.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_url_accepts_bare_host() {
        let url = validate_url("example.com").unwrap();
        assert_eq!(url.host_str(), Some("example.com"));
        assert_eq!(url.scheme(), "https");
    }

    #[test]
    fn validate_url_rejects_invalid() {
        let err = validate_url("not a url!!!").unwrap_err();
        assert_eq!(err, ChromeError::InvalidUrl("not a url!!!".into()));
    }
}

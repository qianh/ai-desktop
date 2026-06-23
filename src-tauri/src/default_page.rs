pub const DEFAULT_CHAT_PAGE_URL: &str = "https://chat.worldwide-logistics.cn/chat";

pub fn normalize_page_url(url: &str) -> String {
    match url::Url::parse(url.trim()) {
        Ok(parsed) => {
            let path = parsed.path().trim_end_matches('/');
            let path = if path.is_empty() { "/" } else { path };
            format!(
                "{}{}{}",
                parsed.origin().ascii_serialization(),
                path,
                parsed
                    .query()
                    .map(|q| format!("?{q}"))
                    .unwrap_or_default()
            )
        }
        Err(_) => url.trim().trim_end_matches('/').to_string(),
    }
}

pub fn is_default_chat_page(url: &str) -> bool {
    normalize_page_url(url) == normalize_page_url(DEFAULT_CHAT_PAGE_URL)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recognizes_default_chat_url_variants() {
        assert!(is_default_chat_page("https://chat.worldwide-logistics.cn/chat"));
        assert!(is_default_chat_page("https://chat.worldwide-logistics.cn/chat/"));
    }
}
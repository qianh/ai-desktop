use crate::models::{AppEntry, Flow, FlowDetail, FlowListItem, HeaderPair, Page, Session};
use crate::paths::AppScopePaths;
use chrono::{DateTime, Utc};
use rusqlite::{params, Connection};
use std::path::Path;

pub struct FlowStore {
    conn: Connection,
    paths: AppScopePaths,
}

impl FlowStore {
    pub fn open(paths: &AppScopePaths) -> Result<Self, String> {
        paths.ensure_dirs().map_err(|e| e.to_string())?;
        let conn = Connection::open(paths.database_path()).map_err(|e| e.to_string())?;
        let store = Self {
            conn,
            paths: paths.clone(),
        };
        store.migrate()?;
        Ok(store)
    }

    pub fn open_at(db_path: &Path, root: &Path) -> Result<Self, String> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        let store = Self {
            conn,
            paths: AppScopePaths::new(root),
        };
        store.migrate()?;
        Ok(store)
    }

    pub fn paths(&self) -> &AppScopePaths {
        &self.paths
    }

    fn migrate(&self) -> Result<(), String> {
        self.conn
            .execute_batch(
                "
                PRAGMA foreign_keys = ON;
                CREATE TABLE IF NOT EXISTS pages (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    url TEXT NOT NULL,
                    browser_app_id TEXT,
                    profile_id TEXT,
                    capture_mode TEXT NOT NULL DEFAULT 'chrome_session',
                    intercept_reporting_enabled INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS apps (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    bundle_id TEXT NOT NULL,
                    app_path TEXT NOT NULL,
                    icon_path TEXT,
                    launch_mode TEXT NOT NULL DEFAULT 'normal',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY,
                    target_type TEXT NOT NULL,
                    target_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    proxy_port INTEGER,
                    cdp_port INTEGER,
                    started_at TEXT NOT NULL,
                    ended_at TEXT,
                    error TEXT
                );
                CREATE TABLE IF NOT EXISTS flows (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL REFERENCES sessions(id),
                    method TEXT NOT NULL,
                    url TEXT NOT NULL,
                    scheme TEXT NOT NULL,
                    host TEXT NOT NULL,
                    path TEXT NOT NULL,
                    status_code INTEGER,
                    req_headers_json TEXT NOT NULL DEFAULT '[]',
                    resp_headers_json TEXT NOT NULL DEFAULT '[]',
                    req_body_preview TEXT,
                    resp_body_preview TEXT,
                    mime TEXT,
                    duration_ms INTEGER,
                    req_size INTEGER,
                    resp_size INTEGER,
                    timing_json TEXT,
                    error TEXT,
                    started_at TEXT NOT NULL,
                    finished_at TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_flows_session ON flows(session_id);
                ",
            )
            .map_err(|e| e.to_string())?;
        // Additive migration for existing DBs; NOT NULL DEFAULT 0 backfills old rows.
        // Ignore the error when the column already exists.
        let _ = self.conn.execute(
            "ALTER TABLE pages ADD COLUMN intercept_reporting_enabled INTEGER NOT NULL DEFAULT 0",
            [],
        );
        Ok(())
    }

    pub fn save_page(&self, page: &Page) -> Result<(), String> {
        self.conn
            .execute(
                "INSERT OR REPLACE INTO pages (id, name, url, browser_app_id, profile_id, capture_mode, intercept_reporting_enabled, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    page.id,
                    page.name,
                    page.url,
                    page.browser_app_id,
                    page.profile_id,
                    page.capture_mode,
                    i32::from(page.intercept_reporting_enabled),
                    page.created_at.to_rfc3339(),
                    page.updated_at.to_rfc3339(),
                ],
            )
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn list_pages(&self) -> Result<Vec<Page>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT id, name, url, browser_app_id, profile_id, capture_mode, intercept_reporting_enabled, created_at, updated_at FROM pages ORDER BY updated_at DESC",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(Page {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    url: row.get(2)?,
                    browser_app_id: row.get(3)?,
                    profile_id: row.get(4)?,
                    capture_mode: row.get(5)?,
                    intercept_reporting_enabled: row.get::<_, i32>(6)? != 0,
                    created_at: parse_ts(row.get::<_, String>(7)?),
                    updated_at: parse_ts(row.get::<_, String>(8)?),
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())
    }

    pub fn get_page(&self, id: &str) -> Result<Option<Page>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT id, name, url, browser_app_id, profile_id, capture_mode, intercept_reporting_enabled, created_at, updated_at FROM pages WHERE id = ?1",
            )
            .map_err(|e| e.to_string())?;
        let mut rows = stmt.query(params![id]).map_err(|e| e.to_string())?;
        if let Some(row) = rows.next().map_err(|e| e.to_string())? {
            return Ok(Some(read_page_row(row)?));
        }
        Ok(None)
    }

    pub fn page_session_ids(&self, page_id: &str) -> Result<Vec<String>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT id FROM sessions WHERE target_type = 'page' AND target_id = ?1 ORDER BY started_at ASC",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![page_id], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())
    }

    pub fn set_page_intercept_reporting(
        &self,
        page_id: &str,
        enabled: bool,
    ) -> Result<Page, String> {
        let changed = self
            .conn
            .execute(
                "UPDATE pages SET intercept_reporting_enabled = ?1 WHERE id = ?2",
                params![i32::from(enabled), page_id],
            )
            .map_err(|e| e.to_string())?;
        if changed == 0 {
            return Err("page not found".into());
        }
        self.get_page(page_id)?
            .ok_or_else(|| "page not found".into())
    }

    pub fn delete_page(&self, page_id: &str) -> Result<(), String> {
        self.conn
            .execute(
                "DELETE FROM flows WHERE session_id IN (
                    SELECT id FROM sessions WHERE target_type = 'page' AND target_id = ?1
                )",
                params![page_id],
            )
            .map_err(|e| e.to_string())?;
        self.conn
            .execute(
                "DELETE FROM sessions WHERE target_type = 'page' AND target_id = ?1",
                params![page_id],
            )
            .map_err(|e| e.to_string())?;
        self.conn
            .execute("DELETE FROM pages WHERE id = ?1", params![page_id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn save_app(&self, app: &AppEntry) -> Result<(), String> {
        self.conn
            .execute(
                "INSERT OR REPLACE INTO apps (id, name, bundle_id, app_path, icon_path, launch_mode, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    app.id,
                    app.name,
                    app.bundle_id,
                    app.app_path,
                    app.icon_path,
                    app.launch_mode,
                    app.created_at.to_rfc3339(),
                    app.updated_at.to_rfc3339(),
                ],
            )
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn list_apps(&self) -> Result<Vec<AppEntry>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT id, name, bundle_id, app_path, icon_path, launch_mode, created_at, updated_at FROM apps ORDER BY name",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(AppEntry {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    bundle_id: row.get(2)?,
                    app_path: row.get(3)?,
                    icon_path: row.get(4)?,
                    launch_mode: row.get(5)?,
                    created_at: parse_ts(row.get::<_, String>(6)?),
                    updated_at: parse_ts(row.get::<_, String>(7)?),
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())
    }

    pub fn delete_app(&self, app_id: &str) -> Result<(), String> {
        self.conn
            .execute("DELETE FROM apps WHERE id = ?1", params![app_id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn save_session(&self, session: &Session) -> Result<(), String> {
        self.conn
            .execute(
                "INSERT OR REPLACE INTO sessions (id, target_type, target_id, status, proxy_port, cdp_port, started_at, ended_at, error)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    session.id,
                    session.target_type,
                    session.target_id,
                    session.status,
                    session.proxy_port,
                    session.cdp_port,
                    session.started_at.to_rfc3339(),
                    session.ended_at.map(|t| t.to_rfc3339()),
                    session.error,
                ],
            )
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_session(&self, id: &str) -> Result<Option<Session>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT id, target_type, target_id, status, proxy_port, cdp_port, started_at, ended_at, error FROM sessions WHERE id = ?1",
            )
            .map_err(|e| e.to_string())?;
        let mut rows = stmt.query(params![id]).map_err(|e| e.to_string())?;
        if let Some(row) = rows.next().map_err(|e| e.to_string())? {
            return Ok(Some(read_session_row(row)?));
        }
        Ok(None)
    }

    pub fn insert_flow(&self, flow: &Flow) -> Result<(), String> {
        self.conn
            .execute(
                "INSERT OR REPLACE INTO flows (
                    id, session_id, method, url, scheme, host, path, status_code,
                    req_headers_json, resp_headers_json, req_body_preview, resp_body_preview,
                    mime, duration_ms, req_size, resp_size, timing_json, error, started_at, finished_at
                ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20)",
                params![
                    flow.id,
                    flow.session_id,
                    flow.method,
                    flow.url,
                    flow.scheme,
                    flow.host,
                    flow.path,
                    flow.status_code,
                    flow.req_headers_json,
                    flow.resp_headers_json,
                    flow.req_body_preview,
                    flow.resp_body_preview,
                    flow.mime,
                    flow.duration_ms,
                    flow.req_size,
                    flow.resp_size,
                    flow.timing_json,
                    flow.error,
                    flow.started_at.to_rfc3339(),
                    flow.finished_at.map(|t| t.to_rfc3339()),
                ],
            )
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn list_flows(&self, session_id: &str) -> Result<Vec<FlowListItem>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT id, method, url, scheme, host, path, status_code, mime, resp_size, duration_ms, started_at
                 FROM flows WHERE session_id = ?1 ORDER BY started_at ASC",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![session_id], |row| {
                Ok(FlowListItem {
                    id: row.get(0)?,
                    method: row.get(1)?,
                    url: row.get(2)?,
                    scheme: row.get(3)?,
                    host: row.get(4)?,
                    path: row.get(5)?,
                    status_code: row.get(6)?,
                    mime: row.get(7)?,
                    resp_size: row.get(8)?,
                    duration_ms: row.get(9)?,
                    started_at: parse_ts(row.get::<_, String>(10)?),
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())
    }

    pub fn get_flow_detail(&self, flow_id: &str) -> Result<Option<FlowDetail>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT id, session_id, method, url, scheme, host, path, status_code,
                        req_headers_json, resp_headers_json, req_body_preview, resp_body_preview,
                        mime, duration_ms, req_size, resp_size, timing_json, error, started_at, finished_at
                 FROM flows WHERE id = ?1",
            )
            .map_err(|e| e.to_string())?;
        let mut rows = stmt.query(params![flow_id]).map_err(|e| e.to_string())?;
        if let Some(row) = rows.next().map_err(|e| e.to_string())? {
            return Ok(Some(read_flow_detail_row(row)?));
        }
        Ok(None)
    }

    pub fn list_flows_for_session(&self, session_id: &str) -> Result<Vec<Flow>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT id, session_id, method, url, scheme, host, path, status_code,
                        req_headers_json, resp_headers_json, req_body_preview, resp_body_preview,
                        mime, duration_ms, req_size, resp_size, timing_json, error, started_at, finished_at
                 FROM flows WHERE session_id = ?1 ORDER BY started_at ASC",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![session_id], |row| {
                let finished: Option<String> = row.get(19)?;
                Ok(Flow {
                    id: row.get(0)?,
                    session_id: row.get(1)?,
                    method: row.get(2)?,
                    url: row.get(3)?,
                    scheme: row.get(4)?,
                    host: row.get(5)?,
                    path: row.get(6)?,
                    status_code: row.get(7)?,
                    req_headers_json: row.get(8)?,
                    resp_headers_json: row.get(9)?,
                    req_body_preview: row.get(10)?,
                    resp_body_preview: row.get(11)?,
                    mime: row.get(12)?,
                    duration_ms: row.get(13)?,
                    req_size: row.get(14)?,
                    resp_size: row.get(15)?,
                    timing_json: row.get(16)?,
                    error: row.get(17)?,
                    started_at: parse_ts(row.get::<_, String>(18)?),
                    finished_at: finished.map(parse_ts),
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())
    }
}

fn read_page_row(row: &rusqlite::Row<'_>) -> Result<Page, String> {
    Ok(Page {
        id: row.get(0).map_err(|e| e.to_string())?,
        name: row.get(1).map_err(|e| e.to_string())?,
        url: row.get(2).map_err(|e| e.to_string())?,
        browser_app_id: row.get(3).map_err(|e| e.to_string())?,
        profile_id: row.get(4).map_err(|e| e.to_string())?,
        capture_mode: row.get(5).map_err(|e| e.to_string())?,
        intercept_reporting_enabled: row.get::<_, i32>(6).map_err(|e| e.to_string())? != 0,
        created_at: parse_ts(row.get::<_, String>(7).map_err(|e| e.to_string())?),
        updated_at: parse_ts(row.get::<_, String>(8).map_err(|e| e.to_string())?),
    })
}

fn read_session_row(row: &rusqlite::Row<'_>) -> Result<Session, String> {
    let ended: Option<String> = row.get(7).map_err(|e| e.to_string())?;
    Ok(Session {
        id: row.get(0).map_err(|e| e.to_string())?,
        target_type: row.get(1).map_err(|e| e.to_string())?,
        target_id: row.get(2).map_err(|e| e.to_string())?,
        status: row.get(3).map_err(|e| e.to_string())?,
        proxy_port: row.get(4).map_err(|e| e.to_string())?,
        cdp_port: row.get(5).map_err(|e| e.to_string())?,
        started_at: parse_ts(row.get::<_, String>(6).map_err(|e| e.to_string())?),
        ended_at: ended.map(parse_ts),
        error: row.get(8).map_err(|e| e.to_string())?,
    })
}

fn read_flow_detail_row(row: &rusqlite::Row<'_>) -> Result<FlowDetail, String> {
    let req_headers_json: String = row.get(8).map_err(|e| e.to_string())?;
    let resp_headers_json: String = row.get(9).map_err(|e| e.to_string())?;
    let timing_json: Option<String> = row.get(16).map_err(|e| e.to_string())?;
    let finished: Option<String> = row.get(19).map_err(|e| e.to_string())?;
    Ok(FlowDetail {
        id: row.get(0).map_err(|e| e.to_string())?,
        session_id: row.get(1).map_err(|e| e.to_string())?,
        method: row.get(2).map_err(|e| e.to_string())?,
        url: row.get(3).map_err(|e| e.to_string())?,
        scheme: row.get(4).map_err(|e| e.to_string())?,
        host: row.get(5).map_err(|e| e.to_string())?,
        path: row.get(6).map_err(|e| e.to_string())?,
        status_code: row.get(7).map_err(|e| e.to_string())?,
        req_headers: parse_headers(&req_headers_json),
        resp_headers: parse_headers(&resp_headers_json),
        req_body_preview: row.get(10).map_err(|e| e.to_string())?,
        resp_body_preview: row.get(11).map_err(|e| e.to_string())?,
        mime: row.get(12).map_err(|e| e.to_string())?,
        duration_ms: row.get(13).map_err(|e| e.to_string())?,
        req_size: row.get(14).map_err(|e| e.to_string())?,
        resp_size: row.get(15).map_err(|e| e.to_string())?,
        timing: timing_json.and_then(|t| serde_json::from_str(&t).ok()),
        error: row.get(17).map_err(|e| e.to_string())?,
        started_at: parse_ts(row.get::<_, String>(18).map_err(|e| e.to_string())?),
        finished_at: finished.map(parse_ts),
    })
}

fn parse_ts(value: String) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(&value)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now())
}

fn parse_headers(json: &str) -> Vec<HeaderPair> {
    serde_json::from_str(json).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::HeaderPair;
    use chrono::Utc;
    use tempfile::tempdir;

    fn sample_headers_json() -> String {
        serde_json::to_string(&vec![
            HeaderPair {
                name: "authorization".into(),
                value: "Bearer secret-token".into(),
                sensitive: true,
            },
            HeaderPair {
                name: "cookie".into(),
                value: "session=abc123".into(),
                sensitive: true,
            },
            HeaderPair {
                name: "accept".into(),
                value: "application/json".into(),
                sensitive: false,
            },
        ])
        .unwrap()
    }

    fn sample_resp_headers_json() -> String {
        serde_json::to_string(&vec![
            HeaderPair {
                name: "set-cookie".into(),
                value: "sid=xyz; Path=/".into(),
                sensitive: true,
            },
            HeaderPair {
                name: "content-type".into(),
                value: "application/json".into(),
                sensitive: false,
            },
        ])
        .unwrap()
    }

    #[test]
    fn list_flows_returns_persisted_flow() {
        let dir = tempdir().unwrap();
        let store = FlowStore::open_at(&dir.path().join("appscope.db"), dir.path()).unwrap();
        let now = Utc::now();

        let page = Page {
            id: "page-1".into(),
            name: "Test".into(),
            url: "http://127.0.0.1:8080/".into(),
            browser_app_id: None,
            profile_id: None,
            capture_mode: "chrome_session".into(),
            intercept_reporting_enabled: false,
            created_at: now,
            updated_at: now,
        };
        store.save_page(&page).unwrap();

        let session = Session {
            id: "sess-1".into(),
            target_type: "page".into(),
            target_id: page.id.clone(),
            status: "capturing".into(),
            proxy_port: Some(8081),
            cdp_port: None,
            started_at: now,
            ended_at: None,
            error: None,
        };
        store.save_session(&session).unwrap();

        let flow = Flow {
            id: "flow-1".into(),
            session_id: session.id.clone(),
            method: "GET".into(),
            url: "http://127.0.0.1:8080/api".into(),
            scheme: "http".into(),
            host: "127.0.0.1".into(),
            path: "/api".into(),
            status_code: Some(200),
            req_headers_json: sample_headers_json(),
            resp_headers_json: sample_resp_headers_json(),
            req_body_preview: None,
            resp_body_preview: Some("{\"ok\":true}".into()),
            mime: Some("application/json".into()),
            duration_ms: Some(42),
            req_size: Some(0),
            resp_size: Some(12),
            timing_json: None,
            error: None,
            started_at: now,
            finished_at: Some(now),
        };
        store.insert_flow(&flow).unwrap();

        let flows = store.list_flows("sess-1").unwrap();
        assert_eq!(flows.len(), 1);
        assert_eq!(flows[0].id, "flow-1");
        assert_eq!(flows[0].method, "GET");
        assert_eq!(flows[0].status_code, Some(200));
    }

    #[test]
    fn get_flow_detail_returns_headers_and_previews() {
        let dir = tempdir().unwrap();
        let store = FlowStore::open_at(&dir.path().join("appscope.db"), dir.path()).unwrap();
        let now = Utc::now();

        let session = Session {
            id: "sess-2".into(),
            target_type: "page".into(),
            target_id: "page-1".into(),
            status: "capturing".into(),
            proxy_port: Some(8081),
            cdp_port: None,
            started_at: now,
            ended_at: None,
            error: None,
        };
        store.save_session(&session).unwrap();

        let flow = Flow {
            id: "flow-2".into(),
            session_id: session.id.clone(),
            method: "POST".into(),
            url: "http://127.0.0.1:8080/login".into(),
            scheme: "http".into(),
            host: "127.0.0.1".into(),
            path: "/login".into(),
            status_code: Some(201),
            req_headers_json: sample_headers_json(),
            resp_headers_json: sample_resp_headers_json(),
            req_body_preview: Some("{\"user\":\"a\"}".into()),
            resp_body_preview: Some("{\"token\":\"t\"}".into()),
            mime: Some("application/json".into()),
            duration_ms: Some(100),
            req_size: Some(20),
            resp_size: Some(30),
            timing_json: None,
            error: None,
            started_at: now,
            finished_at: Some(now),
        };
        store.insert_flow(&flow).unwrap();

        let detail = store
            .get_flow_detail("flow-2")
            .unwrap()
            .expect("flow detail");
        assert_eq!(detail.method, "POST");
        assert_eq!(detail.req_headers.len(), 3);
        assert_eq!(detail.resp_headers.len(), 2);
        assert_eq!(detail.req_body_preview.as_deref(), Some("{\"user\":\"a\"}"));
        assert_eq!(
            detail.resp_body_preview.as_deref(),
            Some("{\"token\":\"t\"}")
        );
    }

    #[test]
    fn delete_page_removes_page_sessions_and_flows() {
        let dir = tempdir().unwrap();
        let store = FlowStore::open_at(&dir.path().join("appscope.db"), dir.path()).unwrap();
        let now = Utc::now();

        let page = Page {
            id: "page-delete".into(),
            name: "Delete".into(),
            url: "http://127.0.0.1:8080/".into(),
            browser_app_id: None,
            profile_id: None,
            capture_mode: "chrome_session".into(),
            intercept_reporting_enabled: false,
            created_at: now,
            updated_at: now,
        };
        store.save_page(&page).unwrap();

        let session = Session {
            id: "sess-delete".into(),
            target_type: "page".into(),
            target_id: page.id.clone(),
            status: "capturing".into(),
            proxy_port: Some(8081),
            cdp_port: None,
            started_at: now,
            ended_at: None,
            error: None,
        };
        store.save_session(&session).unwrap();

        let flow = Flow {
            id: "flow-delete".into(),
            session_id: session.id.clone(),
            method: "GET".into(),
            url: "http://127.0.0.1:8080/api".into(),
            scheme: "http".into(),
            host: "127.0.0.1".into(),
            path: "/api".into(),
            status_code: Some(200),
            req_headers_json: sample_headers_json(),
            resp_headers_json: sample_resp_headers_json(),
            req_body_preview: None,
            resp_body_preview: None,
            mime: Some("application/json".into()),
            duration_ms: Some(10),
            req_size: Some(0),
            resp_size: Some(12),
            timing_json: None,
            error: None,
            started_at: now,
            finished_at: Some(now),
        };
        store.insert_flow(&flow).unwrap();

        let session_ids = store.page_session_ids(&page.id).unwrap();
        assert_eq!(session_ids, vec!["sess-delete".to_string()]);

        store.delete_page(&page.id).unwrap();

        assert!(store.get_page(&page.id).unwrap().is_none());
        assert!(store.get_session(&session.id).unwrap().is_none());
        assert!(store.list_flows(&session.id).unwrap().is_empty());
    }

    #[test]
    fn new_page_defaults_intercept_reporting_disabled() {
        let dir = tempdir().unwrap();
        let store = FlowStore::open_at(&dir.path().join("appscope.db"), dir.path()).unwrap();
        let now = Utc::now();
        let page = Page {
            id: "page-new".into(),
            name: "New".into(),
            url: "https://example.com/".into(),
            browser_app_id: None,
            profile_id: None,
            capture_mode: "chrome_session".into(),
            intercept_reporting_enabled: false,
            created_at: now,
            updated_at: now,
        };
        store.save_page(&page).unwrap();
        let loaded = store.get_page("page-new").unwrap().expect("page");
        assert!(!loaded.intercept_reporting_enabled);
    }

    #[test]
    fn set_page_intercept_reporting_persists_toggle() {
        let dir = tempdir().unwrap();
        let store = FlowStore::open_at(&dir.path().join("appscope.db"), dir.path()).unwrap();
        let now = Utc::now();
        let page = Page {
            id: "page-toggle".into(),
            name: "Toggle".into(),
            url: "https://example.com/".into(),
            browser_app_id: None,
            profile_id: None,
            capture_mode: "chrome_session".into(),
            intercept_reporting_enabled: false,
            created_at: now,
            updated_at: now,
        };
        store.save_page(&page).unwrap();
        let enabled = store
            .set_page_intercept_reporting("page-toggle", true)
            .unwrap();
        assert!(enabled.intercept_reporting_enabled);
        let reloaded = store.get_page("page-toggle").unwrap().expect("page");
        assert!(reloaded.intercept_reporting_enabled);
    }
}

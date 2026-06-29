use crate::chat_providers::format_memory_context;
use crate::models::{ChatMemoryEntry, ChatProviderProfile};
use serde::Serialize;
use std::path::Path;
use std::process::Command;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct CodexTaskPreview {
    pub command_summary: String,
    pub workdir: String,
    pub risk_summary: String,
    pub prompt: String,
}

#[derive(Debug, Clone)]
pub struct CodexRunResult {
    pub stdout: String,
    pub exit_code: i32,
    pub stderr: String,
}

pub trait CodexRunner: Send + Sync {
    fn run(&self, codex_path: &str, args: &[String], workdir: &Path) -> Result<CodexRunResult, String>;
}

pub struct ProcessCodexRunner;

impl CodexRunner for ProcessCodexRunner {
    fn run(&self, codex_path: &str, args: &[String], workdir: &Path) -> Result<CodexRunResult, String> {
        let output = Command::new(codex_path)
            .args(args)
            .current_dir(workdir)
            .output()
            .map_err(|e| format!("failed to run codex: {e}"))?;
        Ok(CodexRunResult {
            stdout: String::from_utf8_lossy(&output.stdout).to_string(),
            exit_code: output.status.code().unwrap_or(-1),
            stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        })
    }
}

pub fn validate_codex_profile(profile: &ChatProviderProfile) -> Result<(), String> {
    if profile.kind != "codex_cli" {
        return Err("provider is not a Codex CLI provider".into());
    }
    Ok(())
}

pub fn build_codex_prompt(memories: &[ChatMemoryEntry], user_content: &str) -> String {
    let memory = format_memory_context(memories);
    if memory.is_empty() {
        user_content.to_string()
    } else {
        format!("{memory}\n\nUser request:\n{user_content}")
    }
}

pub fn build_codex_args(profile: &ChatProviderProfile, prompt: &str) -> Result<Vec<String>, String> {
    let extra: Vec<String> = serde_json::from_str(&profile.codex_extra_args_json)
        .map_err(|e| format!("invalid codex_extra_args_json: {e}"))?;
    for arg in &extra {
        if arg.contains(';') || arg.contains('|') || arg.contains('&') || arg.contains('`') {
            return Err("codex extra args contain disallowed shell characters".into());
        }
    }
    let model = profile
        .default_model
        .clone()
        .filter(|m| !m.trim().is_empty())
        .unwrap_or_else(|| "gpt-4o-mini".into());
    let mut args = vec![
        "exec".to_string(),
        "--model".to_string(),
        model,
        "-s".to_string(),
        "workspace-write".to_string(),
        "-a".to_string(),
        "on-request".to_string(),
    ];
    args.extend(extra);
    args.push(prompt.to_string());
    Ok(args)
}

pub fn preview_codex_task(
    profile: &ChatProviderProfile,
    memories: &[ChatMemoryEntry],
    user_content: &str,
    workdir: &Path,
) -> Result<CodexTaskPreview, String> {
    validate_codex_profile(profile)?;
    let prompt = build_codex_prompt(memories, user_content);
    let args = build_codex_args(profile, &prompt)?;
    let codex_path = profile
        .codex_path
        .clone()
        .filter(|p| !p.trim().is_empty())
        .unwrap_or_else(|| "codex".into());
    let command_summary = format!("{codex_path} {}", args.join(" "));
    Ok(CodexTaskPreview {
        command_summary,
        workdir: workdir.display().to_string(),
        risk_summary: "Codex may modify files and run commands in the workspace after you confirm."
            .into(),
        prompt,
    })
}

pub fn run_codex_task<R: CodexRunner>(
    runner: &R,
    profile: &ChatProviderProfile,
    prompt: &str,
    workdir: &Path,
) -> Result<CodexRunResult, String> {
    validate_codex_profile(profile)?;
    let args = build_codex_args(profile, prompt)?;
    let codex_path = profile
        .codex_path
        .clone()
        .filter(|p| !p.trim().is_empty())
        .unwrap_or_else(|| "codex".into());
    runner.run(&codex_path, &args, workdir)
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use std::sync::{Arc, Mutex};

    struct FakeRunner {
        pub last_args: Arc<Mutex<Vec<String>>>,
        pub stdout: String,
    }

    impl CodexRunner for FakeRunner {
        fn run(&self, _codex_path: &str, args: &[String], _workdir: &Path) -> Result<CodexRunResult, String> {
            *self.last_args.lock().unwrap() = args.to_vec();
            Ok(CodexRunResult {
                stdout: self.stdout.clone(),
                exit_code: 0,
                stderr: String::new(),
            })
        }
    }

    fn codex_profile() -> ChatProviderProfile {
        ChatProviderProfile {
            id: "chatgpt_codex".into(),
            display_name: "ChatGPT".into(),
            kind: "codex_cli".into(),
            api_key: None,
            base_url: None,
            default_model: Some("gpt-4o-mini".into()),
            codex_path: Some("codex".into()),
            codex_extra_args_json: "[]".into(),
            enabled: true,
            updated_at: Utc::now(),
        }
    }

    #[test]
    fn build_codex_args_rejects_shell_injection() {
        let mut profile = codex_profile();
        profile.codex_extra_args_json = r#"["; rm -rf /"]"#.into();
        assert!(build_codex_args(&profile, "hi").is_err());
    }

    #[test]
    fn run_codex_task_uses_fake_runner() {
        let last_args = Arc::new(Mutex::new(Vec::new()));
        let runner = FakeRunner {
            last_args: last_args.clone(),
            stdout: "done".into(),
        };
        let profile = codex_profile();
        let result = run_codex_task(&runner, &profile, "fix tests", Path::new("/tmp")).unwrap();
        assert_eq!(result.stdout, "done");
        assert!(last_args.lock().unwrap().contains(&"fix tests".to_string()));
    }

    #[test]
    fn preview_includes_workdir_and_command() {
        let profile = codex_profile();
        let preview = preview_codex_task(&profile, &[], "hello", Path::new("/workspace")).unwrap();
        assert!(preview.command_summary.contains("codex"));
        assert_eq!(preview.workdir, "/workspace");
    }
}
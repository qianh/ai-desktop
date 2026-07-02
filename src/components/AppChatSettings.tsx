import { useEffect, useState } from "react";
import {
  deleteChatMemoryEntry,
  listChatMemoryEntries,
  listChatProviderProfiles,
  saveChatMemoryEntry,
  saveChatProviderProfile,
} from "../chatApi";
import type { ChatMemoryEntry, ChatProviderProfile } from "../types/chat";
import { setWatermark, getWatermark, DEFAULT_WATERMARK } from "./AppChatWorkspace";

export default function AppChatSettings() {
  const [profiles, setProfiles] = useState<ChatProviderProfile[]>([]);
  const [memories, setMemories] = useState<ChatMemoryEntry[]>([]);
  const [memoryDraft, setMemoryDraft] = useState("");
  const [watermarkDraft, setWatermarkDraft] = useState(getWatermark);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    const [p, m] = await Promise.all([listChatProviderProfiles(), listChatMemoryEntries()]);
    setProfiles(p);
    setMemories(m);
  };

  useEffect(() => {
    void refresh().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const updateProfile = async (profile: ChatProviderProfile, field: string, value: string) => {
    const next = { ...profile, [field]: value || null, updated_at: new Date().toISOString() };
    await saveChatProviderProfile(next);
    await refresh();
  };

  const addMemory = async () => {
    const text = memoryDraft.trim();
    if (!text) return;
    await saveChatMemoryEntry(text);
    setMemoryDraft("");
    await refresh();
  };

  return (
    <div className="asc-app-chat-settings">
      {error && <div className="asc-app-chat-settings__error">{error}</div>}
      <section className="asc-app-chat-settings__section">
        <h4 className="asc-app-chat-settings__heading">个性化</h4>
        <label className="asc-app-chat-settings__field">
          <span className="asc-app-chat-settings__label">聊天页水印文字</span>
          <div className="asc-app-chat-settings__memory-add">
            <input
              className="asc-app-chat-settings__input"
              value={watermarkDraft}
              onChange={(e) => setWatermarkDraft(e.target.value)}
              placeholder="WWL"
              maxLength={6}
            />
            <button
              type="button"
              className="asc-app-chat-settings__btn"
              onClick={() => { setWatermark(watermarkDraft.trim() || DEFAULT_WATERMARK); }}
            >
              保存
            </button>
          </div>
        </label>
      </section>
      <section className="asc-app-chat-settings__section">
        <h4 className="asc-app-chat-settings__heading">Model Providers</h4>
        {profiles.map((p) => (
          <div key={p.id} className="asc-app-chat-settings__card">
            <div className="asc-app-chat-settings__card-title">{p.display_name}</div>
            {p.kind === "api" && (
              <>
                <label className="asc-app-chat-settings__field">
                  <span className="asc-app-chat-settings__label">API Key</span>
                  <input
                    type="password"
                    className="asc-app-chat-settings__input"
                    value={p.api_key ?? ""}
                    placeholder="sk-…"
                    onChange={(e) => void updateProfile(p, "api_key", e.target.value)}
                  />
                </label>
                <label className="asc-app-chat-settings__field">
                  <span className="asc-app-chat-settings__label">Base URL</span>
                  <input
                    className="asc-app-chat-settings__input"
                    value={p.base_url ?? ""}
                    onChange={(e) => void updateProfile(p, "base_url", e.target.value)}
                  />
                </label>
                <label className="asc-app-chat-settings__field">
                  <span className="asc-app-chat-settings__label">Model</span>
                  <input
                    className="asc-app-chat-settings__input"
                    value={p.default_model ?? ""}
                    onChange={(e) => void updateProfile(p, "default_model", e.target.value)}
                  />
                </label>
              </>
            )}
            {p.kind === "codex_cli" && (
              <>
                <label className="asc-app-chat-settings__field">
                  <span className="asc-app-chat-settings__label">Codex path</span>
                  <input
                    className="asc-app-chat-settings__input"
                    value={p.codex_path ?? "codex"}
                    onChange={(e) => void updateProfile(p, "codex_path", e.target.value)}
                  />
                </label>
                <label className="asc-app-chat-settings__field">
                  <span className="asc-app-chat-settings__label">Model</span>
                  <input
                    className="asc-app-chat-settings__input"
                    value={p.default_model ?? ""}
                    onChange={(e) => void updateProfile(p, "default_model", e.target.value)}
                  />
                </label>
              </>
            )}
          </div>
        ))}
      </section>
      <section className="asc-app-chat-settings__section">
        <h4 className="asc-app-chat-settings__heading">Global Memory</h4>
        <div className="asc-app-chat-settings__memory-add">
          <input
            className="asc-app-chat-settings__input"
            value={memoryDraft}
            onChange={(e) => setMemoryDraft(e.target.value)}
            placeholder="Add a memory fact…"
          />
          <button type="button" onClick={() => void addMemory()} className="asc-app-chat-settings__btn">
            Add
          </button>
        </div>
        {memories.map((m) => (
          <div key={m.id} className="asc-app-chat-settings__memory-row">
            <span className="asc-app-chat-settings__memory-text">{m.content}</span>
            <button
              type="button"
              onClick={() => void deleteChatMemoryEntry(m.id).then(refresh)}
              className="asc-app-chat-settings__btn asc-app-chat-settings__btn--ghost"
            >
              Delete
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
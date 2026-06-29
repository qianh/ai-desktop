import { useEffect, useState } from "react";
import {
  deleteChatMemoryEntry,
  listChatMemoryEntries,
  listChatProviderProfiles,
  saveChatMemoryEntry,
  saveChatProviderProfile,
} from "../chatApi";
import type { ChatMemoryEntry, ChatProviderProfile } from "../types/chat";

export default function AppChatSettings() {
  const [profiles, setProfiles] = useState<ChatProviderProfile[]>([]);
  const [memories, setMemories] = useState<ChatMemoryEntry[]>([]);
  const [memoryDraft, setMemoryDraft] = useState("");
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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error && <div style={{ color: "var(--c-danger, #c44)", fontSize: 13 }}>{error}</div>}
      <section>
        <h4 style={headingStyle}>Model Providers</h4>
        {profiles.map((p) => (
          <div key={p.id} style={cardStyle}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{p.display_name}</div>
            {p.kind === "api" && (
              <>
                <label style={labelStyle}>
                  API Key
                  <input
                    type="password"
                    value={p.api_key ?? ""}
                    onChange={(e) => void updateProfile(p, "api_key", e.target.value)}
                    style={inputStyle}
                  />
                </label>
                <label style={labelStyle}>
                  Base URL
                  <input
                    value={p.base_url ?? ""}
                    onChange={(e) => void updateProfile(p, "base_url", e.target.value)}
                    style={inputStyle}
                  />
                </label>
                <label style={labelStyle}>
                  Model
                  <input
                    value={p.default_model ?? ""}
                    onChange={(e) => void updateProfile(p, "default_model", e.target.value)}
                    style={inputStyle}
                  />
                </label>
              </>
            )}
            {p.kind === "codex_cli" && (
              <>
                <label style={labelStyle}>
                  Codex path
                  <input
                    value={p.codex_path ?? "codex"}
                    onChange={(e) => void updateProfile(p, "codex_path", e.target.value)}
                    style={inputStyle}
                  />
                </label>
                <label style={labelStyle}>
                  Model
                  <input
                    value={p.default_model ?? ""}
                    onChange={(e) => void updateProfile(p, "default_model", e.target.value)}
                    style={inputStyle}
                  />
                </label>
              </>
            )}
          </div>
        ))}
      </section>
      <section>
        <h4 style={headingStyle}>Global Memory</h4>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            value={memoryDraft}
            onChange={(e) => setMemoryDraft(e.target.value)}
            placeholder="Add a memory fact..."
            style={{ ...inputStyle, flex: 1 }}
          />
          <button type="button" onClick={() => void addMemory()} style={smallBtn}>
            Add
          </button>
        </div>
        {memories.map((m) => (
          <div key={m.id} style={{ ...cardStyle, display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontSize: 13 }}>{m.content}</span>
            <button
              type="button"
              onClick={() => void deleteChatMemoryEntry(m.id).then(refresh)}
              style={smallBtn}
            >
              Delete
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}

const headingStyle: React.CSSProperties = {
  margin: "0 0 8px",
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: ".06em",
  color: "var(--c-text-4)",
};

const cardStyle: React.CSSProperties = {
  background: "var(--c-bg-3)",
  borderRadius: 8,
  padding: 12,
  marginBottom: 8,
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 12,
  marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--c-border)",
  borderRadius: 6,
  padding: "6px 8px",
  background: "var(--c-bg)",
  color: "var(--c-text)",
  fontSize: 13,
};

const smallBtn: React.CSSProperties = {
  appearance: "none",
  border: "1px solid var(--c-border)",
  background: "var(--c-bg-3)",
  borderRadius: 6,
  padding: "6px 10px",
  cursor: "pointer",
  fontSize: 12,
};
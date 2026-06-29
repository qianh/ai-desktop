import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  cancelCodexTask,
  confirmCodexTask,
  createChatThread,
  deleteChatThread,
  listChatMessages,
  listChatProviderProfiles,
  listChatThreads,
  sendChatMessage,
} from "../chatApi";
import {
  applyMessageUpdated,
  applyStreamChunk,
  mergeSendResponse,
} from "../lib/chatEvents";
import type {
  ChatMessage,
  ChatMessageUpdated,
  ChatProviderProfile,
  ChatStreamChunk,
  ChatThread,
  CodexTaskPreview,
} from "../types/chat";
import CodexTaskConfirmationModal from "./CodexTaskConfirmationModal";

export default function AppChatWorkspace() {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [providers, setProviders] = useState<ChatProviderProfile[]>([]);
  const [providerId, setProviderId] = useState("deepseek");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codexPreview, setCodexPreview] = useState<CodexTaskPreview | null>(null);
  const [pendingCodexMessageId, setPendingCodexMessageId] = useState<string | null>(null);

  const loadThreads = useCallback(async () => {
    const [t, p] = await Promise.all([listChatThreads(), listChatProviderProfiles()]);
    setThreads(t);
    setProviders(p);
    if (!activeThreadId && t.length > 0) {
      setActiveThreadId(t[0].id);
      setProviderId(t[0].provider_profile_id);
    }
  }, [activeThreadId]);

  useEffect(() => {
    void loadThreads()
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [loadThreads]);

  useEffect(() => {
    if (!activeThreadId) {
      setMessages([]);
      return;
    }
    void listChatMessages(activeThreadId)
      .then(setMessages)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    const thread = threads.find((t) => t.id === activeThreadId);
    if (thread) setProviderId(thread.provider_profile_id);
  }, [activeThreadId, threads]);

  useEffect(() => {
    const unsubs: Array<() => void> = [];
    void (async () => {
      const u1 = await listen<ChatStreamChunk>("chat-stream-chunk", (event) => {
        setMessages((prev) => applyStreamChunk(prev, event.payload));
      });
      const u2 = await listen<ChatMessageUpdated>("chat-message-updated", (event) => {
        setMessages((prev) => applyMessageUpdated(prev, event.payload));
        setSending(false);
      });
      unsubs.push(u1, u2);
    })();
    return () => unsubs.forEach((fn) => fn());
  }, []);

  const handleNewThread = async () => {
    const thread = await createChatThread("New chat", providerId);
    setThreads((prev) => [thread, ...prev]);
    setActiveThreadId(thread.id);
    setMessages([]);
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !activeThreadId || sending) return;
    setSending(true);
    setError(null);
    setDraft("");
    try {
      const response = await sendChatMessage(activeThreadId, text, providerId);
      setMessages((prev) => mergeSendResponse(prev, response));
      if (response.codex_preview) {
        setCodexPreview(response.codex_preview);
        setPendingCodexMessageId(response.assistant_message.id);
        setSending(false);
        return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSending(false);
    }
  };

  const handleConfirmCodex = async () => {
    if (!pendingCodexMessageId) return;
    setSending(true);
    setCodexPreview(null);
    try {
      const updated = await confirmCodexTask(pendingCodexMessageId);
      setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPendingCodexMessageId(null);
      setSending(false);
    }
  };

  const handleCancelCodex = async () => {
    if (!pendingCodexMessageId) return;
    const updated = await cancelCodexTask(pendingCodexMessageId);
    setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    setCodexPreview(null);
    setPendingCodexMessageId(null);
    setSending(false);
  };

  if (loading) {
    return <div style={centered}>Loading App Chat…</div>;
  }

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      <aside
        style={{
          width: 220,
          borderRight: "1px solid var(--c-border-2)",
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          background: "var(--c-bg-3)",
        }}
      >
        <button type="button" onClick={() => void handleNewThread()} style={actionBtn}>
          + New chat
        </button>
        {threads.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveThreadId(t.id)}
            style={{
              ...threadBtn,
              background: t.id === activeThreadId ? "var(--c-accent-soft)" : "transparent",
            }}
          >
            {t.title}
          </button>
        ))}
        {activeThreadId && (
          <button
            type="button"
            onClick={() => void deleteChatThread(activeThreadId).then(loadThreads)}
            style={{ ...actionBtn, marginTop: "auto", color: "var(--c-text-3)" }}
          >
            Delete thread
          </button>
        )}
      </aside>

      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header
          style={{
            padding: "10px 16px",
            borderBottom: "1px solid var(--c-border-2)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 14 }}>App Chat</span>
          <select
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            style={selectStyle}
            aria-label="Model provider"
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
        </header>

        <div style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {!activeThreadId && (
            <div style={{ color: "var(--c-text-3)", fontSize: 13 }}>
              Create a chat thread to get started.
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "80%",
                padding: "10px 12px",
                borderRadius: 10,
                background: m.role === "user" ? "var(--c-accent-soft)" : "var(--c-bg-3)",
                fontSize: 14,
                whiteSpace: "pre-wrap",
              }}
            >
              {m.content || (m.status === "streaming" || m.status === "loading" ? "…" : "")}
              {m.error_message && (
                <div style={{ color: "var(--c-danger, #c44)", fontSize: 12, marginTop: 6 }}>
                  {m.error_message}
                </div>
              )}
            </div>
          ))}
        </div>

        {error && (
          <div style={{ padding: "0 16px", color: "var(--c-danger, #c44)", fontSize: 13 }}>{error}</div>
        )}

        <footer style={{ padding: 12, borderTop: "1px solid var(--c-border-2)", display: "flex", gap: 8 }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={activeThreadId ? "Message App Chat…" : "Create a thread first"}
            disabled={!activeThreadId || sending}
            rows={2}
            style={{
              flex: 1,
              resize: "none",
              borderRadius: 8,
              border: "1px solid var(--c-border)",
              padding: 10,
              background: "var(--c-bg)",
              color: "var(--c-text)",
              fontSize: 14,
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
          />
          <button type="button" onClick={() => void handleSend()} disabled={!activeThreadId || sending} style={actionBtn}>
            Send
          </button>
        </footer>
      </main>

      {codexPreview && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--c-overlay)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
          }}
        >
          <CodexTaskConfirmationModal
            preview={codexPreview}
            onConfirm={() => void handleConfirmCodex()}
            onCancel={() => void handleCancelCodex()}
          />
        </div>
      )}
    </div>
  );
}

const centered: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  color: "var(--c-text-3)",
};

const actionBtn: React.CSSProperties = {
  appearance: "none",
  border: "1px solid var(--c-border)",
  background: "var(--c-bg-3)",
  borderRadius: 8,
  padding: "8px 12px",
  cursor: "pointer",
  fontSize: 13,
};

const threadBtn: React.CSSProperties = {
  appearance: "none",
  border: "none",
  textAlign: "left",
  padding: "8px 10px",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 13,
  color: "var(--c-text)",
};

const selectStyle: React.CSSProperties = {
  marginLeft: "auto",
  borderRadius: 6,
  border: "1px solid var(--c-border)",
  padding: "4px 8px",
  background: "var(--c-bg)",
  color: "var(--c-text)",
  fontSize: 13,
};
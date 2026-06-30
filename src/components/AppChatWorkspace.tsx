import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
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

type AppChatContextValue = {
  threads: ChatThread[];
  activeThreadId: string;
  setActiveThreadId: (id: string) => void;
  messages: ChatMessage[];
  providers: ChatProviderProfile[];
  providerId: string;
  setProviderId: (id: string) => void;
  draft: string;
  setDraft: (v: string) => void;
  loading: boolean;
  sending: boolean;
  error: string | null;
  handleNewThread: () => Promise<void>;
  handleSend: () => Promise<void>;
  handleDeleteThread: () => Promise<void>;
  codexPreview: CodexTaskPreview | null;
  handleConfirmCodex: () => Promise<void>;
  handleCancelCodex: () => Promise<void>;
};

const AppChatContext = createContext<AppChatContextValue | null>(null);

function useAppChat() {
  const ctx = useContext(AppChatContext);
  if (!ctx) throw new Error("AppChat components must be used within AppChatShell");
  return ctx;
}

export function AppChatShell({ children }: { children: ReactNode }) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState("");
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

  const handleDeleteThread = async () => {
    if (!activeThreadId) return;
    await deleteChatThread(activeThreadId);
    await loadThreads();
  };

  const value: AppChatContextValue = {
    threads,
    activeThreadId,
    setActiveThreadId,
    messages,
    providers,
    providerId,
    setProviderId,
    draft,
    setDraft,
    loading,
    sending,
    error,
    handleNewThread,
    handleSend,
    handleDeleteThread,
    codexPreview,
    handleConfirmCodex,
    handleCancelCodex,
  };

  return <AppChatContext.Provider value={value}>{children}</AppChatContext.Provider>;
}

export function AppChatSidebarPanel() {
  const {
    threads,
    activeThreadId,
    setActiveThreadId,
    loading,
    handleNewThread,
    handleDeleteThread,
  } = useAppChat();

  if (loading) {
    return <div style={{ padding: 10, fontSize: 12, color: "var(--c-text-4)" }}>Loading…</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "4px 0 8px" }}>
      <div style={sectionLabelStyle}>Threads</div>
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
          onClick={() => void handleDeleteThread()}
          style={{ ...actionBtn, marginTop: 4, color: "var(--c-text-3)" }}
        >
          Delete thread
        </button>
      )}
    </div>
  );
}

export function AppChatMainPanel() {
  const {
    activeThreadId,
    messages,
    providers,
    providerId,
    setProviderId,
    draft,
    setDraft,
    loading,
    sending,
    error,
    handleSend,
    codexPreview,
    handleConfirmCodex,
    handleCancelCodex,
  } = useAppChat();

  if (loading) {
    return <div style={centered}>Loading App Chat…</div>;
  }

  return (
    <>
      <header style={headerStyle}>
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

      <div style={messagesStyle}>
        {!activeThreadId && (
          <div style={{ color: "var(--c-text-3)", fontSize: 13 }}>Create a chat thread to get started.</div>
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
              <div style={{ color: "var(--c-danger, #c44)", fontSize: 12, marginTop: 6 }}>{m.error_message}</div>
            )}
          </div>
        ))}
      </div>

      {error && <div style={{ padding: "0 16px", color: "var(--c-danger, #c44)", fontSize: 13 }}>{error}</div>}

      <footer style={footerStyle}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={activeThreadId ? "Message App Chat…" : "Create a thread first"}
          disabled={!activeThreadId || sending}
          rows={2}
          style={textareaStyle}
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

      {codexPreview && (
        <div style={modalOverlayStyle}>
          <CodexTaskConfirmationModal
            preview={codexPreview}
            onConfirm={() => void handleConfirmCodex()}
            onCancel={() => void handleCancelCodex()}
          />
        </div>
      )}
    </>
  );
}

/** Legacy default: full split layout (tests / standalone). */
export default function AppChatWorkspace() {
  return (
    <AppChatShell>
      <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
        <aside style={legacyAsideStyle}>
          <AppChatSidebarPanel />
        </aside>
        <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <AppChatMainPanel />
        </main>
      </div>
    </AppChatShell>
  );
}

const sectionLabelStyle: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  color: "var(--c-text-4)",
  letterSpacing: ".06em",
  textTransform: "uppercase",
  padding: "8px 8px 2px",
};

const centered: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  color: "var(--c-text-3)",
};

const actionBtn: CSSProperties = {
  appearance: "none",
  border: "1px solid var(--c-border)",
  background: "var(--c-bg-3)",
  borderRadius: 8,
  padding: "8px 12px",
  cursor: "pointer",
  fontSize: 13,
  margin: "0 8px",
};

const threadBtn: CSSProperties = {
  appearance: "none",
  border: "none",
  textAlign: "left",
  padding: "8px 10px",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 13,
  color: "var(--c-text)",
  margin: "0 8px",
};

const headerStyle: CSSProperties = {
  padding: "10px 16px",
  borderBottom: "1px solid var(--c-border-2)",
  display: "flex",
  alignItems: "center",
  gap: 12,
  flex: "none",
};

const messagesStyle: CSSProperties = {
  flex: 1,
  overflow: "auto",
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 12,
  minHeight: 0,
};

const footerStyle: CSSProperties = {
  padding: 12,
  borderTop: "1px solid var(--c-border-2)",
  display: "flex",
  gap: 8,
  flex: "none",
};

const textareaStyle: CSSProperties = {
  flex: 1,
  resize: "none",
  borderRadius: 8,
  border: "1px solid var(--c-border)",
  padding: 10,
  background: "var(--c-bg)",
  color: "var(--c-text)",
  fontSize: 14,
};

const selectStyle: CSSProperties = {
  marginLeft: "auto",
  borderRadius: 6,
  border: "1px solid var(--c-border)",
  padding: "4px 8px",
  background: "var(--c-bg)",
  color: "var(--c-text)",
  fontSize: 13,
};

const modalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "var(--c-overlay)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 10000,
};

const legacyAsideStyle: CSSProperties = {
  width: 220,
  borderRight: "1px solid var(--c-border-2)",
  padding: 12,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  background: "var(--c-bg-3)",
};
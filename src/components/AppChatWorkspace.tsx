import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  applyThreadUpdated,
  mergeSendResponse,
  resolveActiveThreadAfterDelete,
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
import DeleteChatThreadModal from "./modals/DeleteChatThreadModal";
import ConversationMarkdown from "./ConversationMarkdown";

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
  requestDeleteThread: (threadId: string) => void;
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
  const [deleteTarget, setDeleteTarget] = useState<ChatThread | null>(null);

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
      const u3 = await listen<ChatThread>("chat-thread-updated", (event) => {
        setThreads((prev) => applyThreadUpdated(prev, event.payload));
      });
      unsubs.push(u1, u2, u3);
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

  const requestDeleteThread = (threadId: string) => {
    const target = threads.find((t) => t.id === threadId);
    if (target) setDeleteTarget(target);
  };

  const confirmDeleteThread = async () => {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    setError(null);
    await deleteChatThread(targetId);
    const fresh = await listChatThreads();
    const { nextActiveId } = resolveActiveThreadAfterDelete(
      activeThreadId,
      targetId,
      fresh,
    );
    setThreads(fresh);
    if (activeThreadId === targetId) {
      setActiveThreadId(nextActiveId);
      setMessages([]);
      setDraft("");
      setCodexPreview(null);
      setPendingCodexMessageId(null);
      const next = fresh.find((t) => t.id === nextActiveId);
      if (next) setProviderId(next.provider_profile_id);
    }
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
    requestDeleteThread,
    codexPreview,
    handleConfirmCodex,
    handleCancelCodex,
  };

  return (
    <AppChatContext.Provider value={value}>
      {children}
      {deleteTarget && (
        <div style={modalOverlayStyle}>
          <DeleteChatThreadModal
            threadTitle={deleteTarget.title}
            onClose={() => setDeleteTarget(null)}
            onConfirm={confirmDeleteThread}
          />
        </div>
      )}
    </AppChatContext.Provider>
  );
}

function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 9) return "早上好";
  if (hour >= 9 && hour < 12) return "上午好";
  if (hour >= 12 && hour < 14) return "中午好";
  if (hour >= 14 && hour < 18) return "下午好";
  if (hour >= 18 && hour < 23) return "晚上好";
  return "夜深了";
}

function ChatEmptyGreeting() {
  const [now, setNow] = useState(() => new Date());
  const greeting = useMemo(() => greetingForHour(now.getHours()), [now]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="asc-app-chat-empty">
      <div className="asc-app-chat-empty__mark" aria-hidden>
        <svg width="200" height="160" viewBox="0 0 400 320" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M398.97 0.5L147.576 319.5H1.03027L37.5996 273.081L120.167 169.603L120.171 169.598L215.342 47.5605L215.343 47.5615L252.424 0.5H398.97ZM264.544 273.271H372.527L336.082 319.498H189.886L202.642 303.307C217.584 284.34 240.398 273.271 264.544 273.271ZM209.164 0.5L202.786 8.58887C183.782 32.6885 154.782 46.752 124.091 46.752H25.9805L62.4268 0.5H209.164Z"
            stroke="currentColor"
          />
        </svg>
      </div>
      <p className="asc-app-chat-empty__text">{greeting}</p>
    </div>
  );
}

function ChatBrandMark({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3c4 0 7 2.5 7 6.5S16 16 12 16c-.8 0-1.6-.1-2.3-.3L5 19l1.5-4.2C5.2 13.4 5 12.2 5 11 5 6.5 8 3 12 3z" />
    </svg>
  );
}

export function AppChatSidebarPanel() {
  const {
    threads,
    activeThreadId,
    setActiveThreadId,
    loading,
    handleNewThread,
    requestDeleteThread,
    error,
  } = useAppChat();

  if (loading) {
    return <div className="asc-app-chat-thread-rail__loading">Loading…</div>;
  }

  return (
    <div className="asc-app-chat-thread-rail__inner">
      <button type="button" className="asc-app-chat-thread-rail__new" onClick={() => void handleNewThread()}>
        <span aria-hidden>+</span>
        <span>New chat</span>
      </button>
      {error && <div className="asc-app-chat-thread-rail__error">{error}</div>}
      <div className="asc-app-chat-thread-rail__list">
        {threads.map((t) => {
          const active = t.id === activeThreadId;
          return (
            <div
              key={t.id}
              className={
                active
                  ? "asc-app-chat-thread-rail__row asc-app-chat-thread-rail__row--active"
                  : "asc-app-chat-thread-rail__row"
              }
            >
              <button
                type="button"
                onClick={() => setActiveThreadId(t.id)}
                className="asc-app-chat-thread-rail__item"
                title={t.title}
              >
                {t.title}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  requestDeleteThread(t.id);
                }}
                className="asc-app-chat-thread-rail__row-delete"
                title="Delete chat"
                aria-label={`Delete ${t.title}`}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeProvider = providers.find((p) => p.id === providerId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  if (loading) {
    return <div className="asc-app-chat-main__loading">Loading App Chat…</div>;
  }

  return (
    <>
      <div className="asc-app-chat-messages">
        <div className="asc-app-chat-messages__inner">
          {!activeThreadId && <ChatEmptyGreeting />}
          {activeThreadId && messages.length === 0 && !sending && <ChatEmptyGreeting />}
          {messages.map((m) => (
            <div
              key={m.id}
              className={
                m.role === "user"
                  ? "asc-app-chat-turn asc-app-chat-turn--user"
                  : "asc-app-chat-turn asc-app-chat-turn--assistant"
              }
            >
              {m.role === "assistant" && (
                <div className="asc-app-chat-turn__avatar" aria-hidden>
                  <ChatBrandMark />
                </div>
              )}
              <div
                className={
                  m.role === "user"
                    ? "asc-app-chat-bubble asc-app-chat-bubble--user"
                    : "asc-app-chat-bubble asc-app-chat-bubble--assistant"
                }
              >
                {m.role === "assistant" ? (
                  m.content ? (
                    <ConversationMarkdown content={m.content} />
                  ) : m.status === "streaming" || m.status === "loading" ? (
                    <span className="asc-app-chat-streaming">Thinking…</span>
                  ) : null
                ) : (
                  <span className="asc-app-chat-bubble__plain">{m.content}</span>
                )}
                {m.error_message && (
                  <div className="asc-app-chat-bubble__error">{m.error_message}</div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {error && <div className="asc-app-chat-error">{error}</div>}

      <div className="asc-app-chat-composer-region">
        <div className="asc-app-chat-composer-wrap">
          <div className="asc-app-chat-composer">
            <div className="asc-app-chat-composer__toolbar">
              <label className="asc-app-chat-composer__model-label">
                <span>Model</span>
                <select
                  value={providerId}
                  onChange={(e) => setProviderId(e.target.value)}
                  className="asc-app-chat-composer__model-select"
                  aria-label="Model provider"
                  disabled={!activeThreadId}
                >
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name}
                    </option>
                  ))}
                </select>
              </label>
              {activeProvider && (
                <span className="asc-app-chat-composer__model-hint">{activeProvider.default_model}</span>
              )}
            </div>
            <div className="asc-app-chat-composer__body">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={activeThreadId ? "Message…" : "Create a thread to start chatting"}
                disabled={!activeThreadId || sending}
                rows={3}
                className="asc-app-chat-composer__input"
                data-testid="chat-input"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
              />
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={!activeThreadId || sending || !draft.trim()}
                className="asc-app-chat-composer__send"
                aria-label="Send message"
              >
                {sending ? "…" : "↑"}
              </button>
            </div>
          </div>
        </div>
      </div>

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

/** Chat main area only — thread list lives in App Sidebar (FR-007). */
export function AppChatContent() {
  return (
    <div className="asc-app-chat">
      <main className="asc-app-chat-main">
        <AppChatMainPanel />
      </main>
    </div>
  );
}

/** Legacy default: full split layout (tests / standalone). */
export default function AppChatWorkspace() {
  return (
    <AppChatShell>
      <AppChatContent />
    </AppChatShell>
  );
}

const modalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "var(--c-overlay)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 10000,
};
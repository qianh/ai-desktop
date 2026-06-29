import type { CodexTaskPreview } from "../types/chat";

type Props = {
  preview: CodexTaskPreview;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function CodexTaskConfirmationModal({ preview, onConfirm, onCancel }: Props) {
  return (
    <div
      role="dialog"
      aria-labelledby="codex-task-title"
      style={{
        background: "var(--c-bg-2)",
        border: "1px solid var(--c-border)",
        borderRadius: 12,
        padding: 20,
        width: "min(520px, 92vw)",
        boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
      }}
    >
      <h3 id="codex-task-title" style={{ margin: "0 0 8px", fontSize: 16 }}>
        Confirm Codex task
      </h3>
      <p style={{ margin: "0 0 12px", color: "var(--c-text-3)", fontSize: 13 }}>
        {preview.risk_summary}
      </p>
      <div style={{ fontSize: 12, color: "var(--c-text-2)", marginBottom: 8 }}>
        <strong>Workdir:</strong> {preview.workdir}
      </div>
      <pre
        style={{
          margin: "0 0 16px",
          padding: 10,
          background: "var(--c-bg-4)",
          borderRadius: 8,
          fontSize: 11,
          overflow: "auto",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {preview.command_summary}
      </pre>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancel} style={btnStyle(false)}>
          Cancel
        </button>
        <button type="button" onClick={onConfirm} style={btnStyle(true)}>
          Run Codex
        </button>
      </div>
    </div>
  );
}

function btnStyle(primary: boolean): React.CSSProperties {
  return {
    appearance: "none",
    border: primary ? "none" : "1px solid var(--c-border)",
    background: primary ? "var(--c-accent)" : "var(--c-bg-3)",
    color: primary ? "#fff" : "var(--c-text)",
    borderRadius: 8,
    padding: "8px 14px",
    cursor: "pointer",
    fontSize: 13,
  };
}
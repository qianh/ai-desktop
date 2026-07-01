import { useState } from "react";
import { dangerBtn, secondaryBtn } from "../../lib/ui";

type Props = {
  threadTitle: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

export default function DeleteChatThreadModal({ threadTitle, onClose, onConfirm }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: 420,
        background: "var(--c-bg)",
        borderRadius: 13,
        boxShadow: "0 24px 60px rgba(0,0,0,.4)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "18px 22px 0" }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--c-text)" }}>删除会话</div>
        <div style={{ fontSize: 12.5, color: "var(--c-text-2)", marginTop: 10, lineHeight: 1.5 }}>
          确定删除 <strong>{threadTitle}</strong>？该会话的所有消息将一并删除。
        </div>
      </div>
      <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
        {error && (
          <div style={{ fontSize: 12, color: "#d23b30", lineHeight: 1.4 }}>{error}</div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" onClick={onClose} disabled={busy} style={secondaryBtn}>
            取消
          </button>
          <button type="button" onClick={() => void handleConfirm()} disabled={busy} style={dangerBtn}>
            {busy ? "删除中…" : "删除"}
          </button>
        </div>
      </div>
    </div>
  );
}
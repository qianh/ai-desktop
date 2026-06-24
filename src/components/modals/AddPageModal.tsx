// Add Page modal — configure a URL for Chrome-session capture (§5.2 of the spec).
import { useState, type CSSProperties, type FormEvent } from "react";
import { MONO, primaryBtn, secondaryBtn } from "../../lib/ui";

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #d8d8dc",
  borderRadius: 8,
  padding: "8px 11px",
  font: "13px ui-monospace,Menlo,monospace",
  color: "var(--c-text)",
  outline: "none",
};
const selectStyle: CSSProperties = {
  border: "1px solid #d8d8dc",
  borderRadius: 8,
  padding: "8px 11px",
  font: "13px -apple-system,system-ui",
  color: "var(--c-text)",
  background: "var(--c-bg)",
};
const labelText: CSSProperties = { fontSize: 11.5, color: "var(--c-text-3)", display: "block", marginBottom: 5 };

type Props = {
  onClose: () => void;
  onOpenCertGuide: () => void;
  onSave: (url: string, name?: string) => Promise<void>;
  onOpenCapture: (url: string, name?: string) => Promise<void>;
};

export default function AddPageModal({ onClose, onOpenCertGuide, onSave, onOpenCapture }: Props) {
  const [url, setUrl] = useState("http://127.0.0.1:8080/");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (action: "save" | "capture") => {
    setBusy(true);
    setError(null);
    try {
      if (action === "save") await onSave(url, name || undefined);
      else await onOpenCapture(url, name || undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div onClick={(e) => e.stopPropagation()} style={{ width: 480, background: "var(--c-bg)", borderRadius: 13, boxShadow: "0 24px 60px rgba(0,0,0,.4)", overflow: "hidden" }}>
      <div style={{ padding: "18px 22px 0" }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--c-text)" }}>Add Page</div>
        <div style={{ fontSize: 12, color: "var(--c-text-4)", marginTop: 2 }}>添加一个 URL，在应用内打开页面并抓包。</div>
      </div>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void submit("capture");
        }}
        style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}
      >
        <label style={{ display: "block" }}>
          <span style={labelText}>Name (optional)</span>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: "block" }}>
          <span style={labelText}>URL</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} style={inputStyle} required />
        </label>
        <div style={{ display: "flex", gap: 12 }}>
          <label style={{ flex: 1 }}>
            <span style={labelText}>Browser</span>
            <div style={selectStyle}>Google Chrome ▾</div>
          </label>
          <label style={{ flex: 1 }}>
            <span style={labelText}>Capture Mode</span>
            <div style={selectStyle}>In-App Session ▾</div>
          </label>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--c-text-4)", background: "var(--c-bg-2)", borderRadius: 8, padding: "10px 12px", lineHeight: 1.5, fontFamily: MONO }}>
          embedded webview + per-session local proxy
        </div>
        {error && <div style={{ fontSize: 12, color: "#d23b30" }}>{error}</div>}
      </form>
      <div style={{ padding: "14px 22px", background: "var(--c-bg-2)", borderTop: "1px solid #f0f0f2", display: "flex", justifyContent: "flex-end", gap: 9 }}>
        <button onClick={onClose} style={secondaryBtn} disabled={busy}>
          取消
        </button>
        <button onClick={() => void submit("save")} style={secondaryBtn} disabled={busy}>
          保存
        </button>
        <button onClick={() => void submit("capture")} style={primaryBtn} disabled={busy}>
          ⏵ Open &amp; Capture
        </button>
        <button onClick={onOpenCertGuide} style={secondaryBtn} disabled={busy}>
          CA 引导
        </button>
      </div>
    </div>
  );
}

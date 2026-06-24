// Add App modal — pick from scanned installed apps (§5.3 of the spec).
import { useEffect, useState } from "react";
import { scanInstalledApps, type ApiApp } from "../../api";
import { MONO, iconStyle, primaryBtn, secondaryBtn } from "../../lib/ui";

type Props = {
  onClose: () => void;
  onSave: (app: ApiApp) => Promise<void>;
};

export default function AddAppModal({ onClose, onSave }: Props) {
  const [apps, setApps] = useState<ApiApp[]>([]);
  const [selected, setSelected] = useState<ApiApp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const scanned = await scanInstalledApps();
        setApps(scanned);
        if (scanned[0]) setSelected(scanned[0]);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const letter = (name: string) => (name.trim()[0] || "A").toUpperCase();

  return (
    <div onClick={(e) => e.stopPropagation()} style={{ width: 480, background: "#fff", borderRadius: 13, boxShadow: "0 24px 60px rgba(0,0,0,.4)", overflow: "hidden" }}>
      <div style={{ padding: "18px 22px 0" }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: "#1d1d1f" }}>Add App</div>
        <div style={{ fontSize: 12, color: "#9a9aa0", marginTop: 2 }}>从已安装应用中选择，并指定启动模式。</div>
      </div>
      <div style={{ padding: "14px 14px", maxHeight: 240, overflow: "auto" }}>
        {loading && <div style={{ fontSize: 12, color: "#8a8a8e", padding: 10 }}>扫描应用中…</div>}
        {error && <div style={{ fontSize: 12, color: "#d23b30", padding: 10 }}>{error}</div>}
        {!loading &&
          !error &&
          apps.map((app) => (
            <div
              key={app.bundle_id}
              onClick={() => setSelected(app)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                padding: "8px 10px",
                borderRadius: 8,
                cursor: "pointer",
                background: selected?.bundle_id === app.bundle_id ? "#f0f4ff" : "transparent",
              }}
            >
              {app.icon_path ? (
                <img
                  src={app.icon_path}
                  alt=""
                  width={24}
                  height={24}
                  style={{ width: 24, height: 24, borderRadius: 6, flex: "none", objectFit: "contain" }}
                />
              ) : (
                <span style={iconStyle("#5b6470")}>{letter(app.name)}</span>
              )}
              <span style={{ flex: 1, fontSize: 13, color: "#1d1d1f" }}>{app.name}</span>
              <span style={{ font: "11px ui-monospace,Menlo,monospace", color: "#a0a0a6", fontFamily: MONO }}>{app.bundle_id}</span>
            </div>
          ))}
      </div>
      <div style={{ padding: "0 22px 14px" }}>
        <div style={{ fontSize: 11.5, color: "#9a9aa0", lineHeight: 1.5 }}>
          启动模式：Normal · System Proxy Capture · <span style={{ color: "#b0b0b6" }}>Transparent Capture (Coming Soon)</span>
        </div>
      </div>
      <div style={{ padding: "14px 22px", background: "#fafafb", borderTop: "1px solid #f0f0f2", display: "flex", justifyContent: "flex-end", gap: 9 }}>
        <button onClick={onClose} style={secondaryBtn} disabled={busy}>
          取消
        </button>
        <button
          onClick={async () => {
            if (!selected) return;
            setBusy(true);
            try {
              await onSave(selected);
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          }}
          style={primaryBtn}
          disabled={busy || !selected}
        >
          添加
        </button>
      </div>
    </div>
  );
}
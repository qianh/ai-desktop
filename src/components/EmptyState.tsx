// Shown for an idle page with no captured requests yet.
import { primaryBtn } from "../lib/ui";

type Props = {
  onOpenCapture?: () => void | Promise<void>;
  busy?: boolean;
};

export default function EmptyState({ onOpenCapture, busy = false }: Props) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: 36,
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: 15,
          border: "2px dashed #d4d4d8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 26,
          color: "#c4c4ca",
        }}
      >
        ↯
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: "#1d1d1f" }}>还没有捕获到请求</div>
      <div style={{ fontSize: 12.5, color: "#9a9aa0", maxWidth: 320, lineHeight: 1.5 }}>
        点击 Open &amp; Capture，AppScope 将在应用内打开页面并启动本地代理开始抓包。
      </div>
      {onOpenCapture && (
        <button onClick={() => void onOpenCapture()} style={primaryBtn} disabled={busy}>
          {busy ? "启动中…" : "⏵ Open & Capture"}
        </button>
      )}
    </div>
  );
}

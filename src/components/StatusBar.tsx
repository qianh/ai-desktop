// Bottom status bar — proxy / CA / QUIC state.
type Props = {
  statusLeft: string;
  live: boolean;
  hasPageSession?: boolean;
  proxyPort?: number | null;
  certState: string;
  quicDisabled: boolean;
};

function formatConnectionLabel(hasPageSession: boolean, proxyPort?: number | null): string {
  if (!hasPageSession) return "proxy idle";
  if (proxyPort === 0) return "direct";
  if (proxyPort != null && proxyPort > 0) return `proxy 127.0.0.1:${proxyPort}`;
  return "proxy idle";
}

function certColor(state: string): string {
  if (state === "Trusted") return "#30a14e";
  if (state === "Installed" || state === "Generated") return "#c97b20";
  return "var(--c-text-3)";
}

export default function StatusBar({
  statusLeft,
  live,
  hasPageSession = false,
  proxyPort,
  certState,
  quicDisabled,
}: Props) {
  return (
    <div
      className="asc-glass-chrome"
      data-asc-region="statusbar"
      style={{
        height: 25,
        flex: "none",
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "0 14px",
        background: "var(--c-divider)",
        borderTop: "1px solid var(--c-border-2)",
        font: "11px ui-monospace,'SF Mono',Menlo,monospace",
        color: "var(--c-text-3)",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: live ? "#30a14e" : "var(--c-border-3)",
            animation: live ? "ascPulse 1.6s infinite" : undefined,
          }}
        />
        {statusLeft}
      </span>
      <div style={{ flex: 1 }} />
      <span>{formatConnectionLabel(hasPageSession, proxyPort)}</span>
      <span style={{ color: "var(--c-border-2)" }}>·</span>
      <span style={{ color: certColor(certState) }}>CA {certState}</span>
      <span style={{ color: "var(--c-border-2)" }}>·</span>
      <span>{quicDisabled ? "QUIC off" : "QUIC on"}</span>
    </div>
  );
}

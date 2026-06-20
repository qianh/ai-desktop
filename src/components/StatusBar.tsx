// Bottom status bar — proxy / CA / QUIC state.
type Props = {
  statusLeft: string;
  live: boolean;
  proxyPort?: number | null;
  certState: string;
  quicDisabled: boolean;
};

function certColor(state: string): string {
  if (state === "Trusted") return "#30a14e";
  if (state === "Installed" || state === "Generated") return "#c97b20";
  return "#8a8a8e";
}

export default function StatusBar({ statusLeft, live, proxyPort, certState, quicDisabled }: Props) {
  return (
    <div
      style={{
        height: 25,
        flex: "none",
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "0 14px",
        background: "#f1f1f3",
        borderTop: "1px solid #e0e0e4",
        font: "11px ui-monospace,'SF Mono',Menlo,monospace",
        color: "#8a8a8e",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: live ? "#30a14e" : "#c4c4c8",
            animation: live ? "ascPulse 1.6s infinite" : undefined,
          }}
        />
        {statusLeft}
      </span>
      <div style={{ flex: 1 }} />
      <span>{proxyPort ? `proxy 127.0.0.1:${proxyPort}` : "proxy idle"}</span>
      <span style={{ color: "#d0d0d4" }}>·</span>
      <span style={{ color: certColor(certState) }}>CA {certState}</span>
      <span style={{ color: "#d0d0d4" }}>·</span>
      <span>{quicDisabled ? "QUIC off" : "QUIC on"}</span>
    </div>
  );
}

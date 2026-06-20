// Certificate Manager view (§9 of the spec).
import { dangerBtn, primaryBtn, secondaryBtn } from "../lib/ui";

const STEPS = ["Generated", "Installed", "Trusted"];

type Props = {
  state: string;
  onInstall: () => void | Promise<void>;
  onOpenGuide: () => void | Promise<void>;
  onGenerate: () => void | Promise<void>;
  onRemove: () => void | Promise<void>;
  onRefresh: () => void | Promise<void>;
};

function stateLabel(state: string): string {
  switch (state) {
    case "Trusted":
      return "已安装并被系统信任 · 可解密 HTTPS";
    case "Generated":
      return "已生成 · 点击「安装到钥匙串」导入";
    case "Installed":
      return "已在钥匙串 · 点击「信任引导」设置始终信任";
    case "Invalid":
      return "证书文件不完整";
    case "Removed":
      return "已删除";
    default:
      return "尚未生成 AppScope Local CA";
  }
}

export default function CertManager({ state, onInstall, onOpenGuide, onGenerate, onRemove, onRefresh }: Props) {
  const trusted = state === "Trusted";
  const generated = state === "Generated" || state === "Installed" || trusted;

  return (
    <div style={{ flex: 1, overflow: "auto", minHeight: 0, padding: "28px 36px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <h1 style={{ fontSize: 21, fontWeight: 600, margin: "0 0 4px", color: "#1d1d1f" }}>Certificate Manager</h1>
        <p style={{ fontSize: 13, color: "#8a8a8e", margin: "0 0 22px", lineHeight: 1.5 }}>
          AppScope 使用本机生成的 Root CA 解密经其代理的 HTTPS 流量。私钥仅保存在本机，永不上传。
        </p>

        <div
          style={{
            border: "1px solid #e6e6ea",
            borderRadius: 12,
            padding: "20px 22px",
            display: "flex",
            gap: 18,
            alignItems: "center",
            marginBottom: 18,
            background: "#fbfbfc",
          }}
        >
          <div style={{ width: 54, height: 54, borderRadius: 13, background: trusted ? "#e7f6ec" : "#f2f2f5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flex: "none" }}>
            🛡
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#1d1d1f" }}>AppScope Local CA</div>
            <div style={{ fontSize: 12.5, color: "#8a8a8e", marginTop: 2 }}>{stateLabel(state)}</div>
          </div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: trusted ? "#30a14e" : "#8a8a8e",
              background: trusted ? "#e7f6ec" : "#f2f2f5",
              borderRadius: 7,
              padding: "6px 12px",
            }}
          >
            {state}
          </span>
        </div>

        <div style={{ display: "flex", gap: 0, marginBottom: 24, alignItems: "center" }}>
          {STEPS.map((label, idx) => {
            const done =
              (label === "Generated" && generated) ||
              (label === "Installed" && (state === "Installed" || trusted)) ||
              (label === "Trusted" && trusted);
            return (
              <div key={label} style={{ display: "flex", alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, width: 78 }}>
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background: done ? "#30a14e" : "#e6e6ea",
                      color: done ? "#fff" : "#8a8a8e",
                      fontSize: 13,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {done ? "✓" : idx + 1}
                  </span>
                  <span style={{ fontSize: 10.5, color: done ? "#30a14e" : "#8a8a8e", textAlign: "center" }}>{label}</span>
                </div>
                {idx < STEPS.length - 1 && <span style={{ width: 26, height: 2, background: done ? "#30a14e" : "#e6e6ea", marginBottom: 16 }} />}
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginBottom: 22 }}>
          <button onClick={() => void onGenerate()} style={primaryBtn}>
            生成 CA
          </button>
          <button onClick={() => void onInstall()} style={primaryBtn} disabled={!generated || trusted}>
            安装到钥匙串
          </button>
          <button onClick={() => void onOpenGuide()} style={secondaryBtn} disabled={!generated || trusted}>
            信任引导
          </button>
          <button onClick={() => void onRefresh()} style={secondaryBtn}>
            检查信任状态
          </button>
          <button onClick={() => void onRemove()} style={dangerBtn} disabled={!generated}>
            删除 CA
          </button>
        </div>

        <div style={{ border: "1px solid #f0e0c8", background: "#fdf7ec", borderRadius: 10, padding: "13px 15px", display: "flex", gap: 11 }}>
          <span style={{ fontSize: 15 }}>⚠️</span>
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: "#8a6d3b" }}>
            信任 AppScope CA 后，AppScope 可以解密通过它代理的 HTTPS 流量。请只在你信任的设备和会话中开启抓包。不要抓取银行、支付、密码管理器等敏感应用。
          </p>
        </div>
      </div>
    </div>
  );
}
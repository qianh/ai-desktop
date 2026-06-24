// Cert Guide modal — walks the user through trusting the AppScope CA (§9.2 of the spec).
import { primaryBtn, secondaryBtn } from "../../lib/ui";

const STEPS: [string, string][] = [
  ["1", "证书已在钥匙串中（若弹出 -25294 说明已存在，点「好」即可）。"],
  ["2", "打开「钥匙串访问」→ 左侧选「登录」→ 顶部选「证书」→ 找到 AppScope Local CA。"],
  ["3", "双击证书 → 展开「信任」→「使用此证书时」选「始终信任」，输入密码确认。"],
];

type Props = {
  onClose: () => void;
  onOpenKeychain: () => void | Promise<void>;
};

export default function CertGuideModal({ onClose, onOpenKeychain }: Props) {
  return (
    <div onClick={(e) => e.stopPropagation()} style={{ width: 460, background: "var(--c-bg)", borderRadius: 13, boxShadow: "0 24px 60px rgba(0,0,0,.4)", overflow: "hidden" }}>
      <div style={{ padding: "20px 22px 0", textAlign: "center" }}>
        <div style={{ fontSize: 34 }}>🛡</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--c-text)", marginTop: 6 }}>信任 AppScope CA</div>
        <div style={{ fontSize: 12, color: "var(--c-text-4)", marginTop: 3, lineHeight: 1.5 }}>解密 HTTPS 前需要你手动安装并信任本机证书。</div>
      </div>
      <div style={{ padding: "18px 24px", display: "flex", flexDirection: "column", gap: 13 }}>
        {STEPS.map(([n, text]) => (
          <div key={n} style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
            <span style={{ width: 21, height: 21, borderRadius: "50%", background: "#eef2fb", color: "#1e66d0", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
              {n}
            </span>
            <span style={{ fontSize: 12.5, color: "var(--c-text)", lineHeight: 1.5 }}>{text}</span>
          </div>
        ))}
        <div style={{ fontSize: 11, color: "#8a6d3b", background: "#fdf7ec", border: "1px solid #f0e0c8", borderRadius: 8, padding: "9px 11px", lineHeight: 1.5 }}>
          信任后 AppScope 即可解密其代理的 HTTPS 流量，请仅在受信任的设备上开启。
        </div>
      </div>
      <div style={{ padding: "14px 22px", background: "var(--c-bg-2)", borderTop: "1px solid var(--c-divider)", display: "flex", justifyContent: "flex-end", gap: 9 }}>
        <button onClick={onClose} style={secondaryBtn}>
          稍后
        </button>
        <button
          onClick={() => {
            void onOpenKeychain();
          }}
          style={primaryBtn}
        >
          打开钥匙串并信任
        </button>
      </div>
    </div>
  );
}

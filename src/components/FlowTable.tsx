// Captured-request list. Variant A = table + right inspector; Variant B = DevTools
// table + bottom inspector with a waterfall column. Ported from the showFlows block.
import { useRef, useState, type CSSProperties } from "react";
import type { Flow } from "../types";
import { ACCENT } from "../lib/ui";
import { cat as catFn, catColor, methodColor, statusColor } from "../lib/format";
import FlowDetail from "./FlowDetail";

const CHIPS: [string, string][] = [
  ["all", "All"],
  ["fetch", "Fetch/XHR"],
  ["js", "JS"],
  ["css", "CSS"],
  ["img", "Img"],
  ["font", "Font"],
  ["doc", "Doc"],
  ["ws", "WS"],
  ["err", "Errors"],
];

const GRID_A = "54px 64px 1fr 150px 78px 74px 70px";
const GRID_B = "1fr 60px 60px 80px 130px 70px 200px";

const headCell: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 600,
  color: "#9a9aa0",
  textTransform: "uppercase",
  letterSpacing: ".03em",
};

function typeLabel(f: Flow): string {
  const c = catFn(f.type);
  return c === "fetch" ? (f.type === "xhr" ? "xhr" : "fetch") : c;
}

type Props = {
  flows: Flow[];
  variant: "A" | "B";
  showWaterfall: boolean;
  query: string;
  filter: string;
  selectedId: string | null;
  recording: boolean;
  onSelect: (id: string) => void;
  onQuery: (v: string) => void;
  onFilter: (k: string) => void;
  onToggleRecord: () => void;
  onClear: () => void;
};

function usePanelResize(axis: "x" | "y", initial: number, min: number, max: number) {
  const [size, setSize] = useState(initial);
  const panelRef = useRef<HTMLDivElement>(null);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const panel = panelRef.current;
    if (!panel) return;
    const pos = axis === "x" ? "clientX" : "clientY" as const;
    const dim = axis === "x" ? "width" : "height" as const;
    const start = e[pos];
    const startSize = panel.getBoundingClientRect()[dim];

    const onMove = (ev: MouseEvent) => {
      setSize(Math.max(min, Math.min(max, startSize + start - ev[pos])));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = axis === "x" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
  };

  return { size, panelRef, onMouseDown } as const;
}

export default function FlowTable(p: Props) {
  const detailX = usePanelResize("x", 436, 200, 800);
  const detailY = usePanelResize("y", 304, 100, 700);

  const q = p.query.trim().toLowerCase();
  const filtered = p.flows.filter((f) => {
    if (p.filter === "all") {
      /* keep */
    } else if (p.filter === "err") {
      if (!(f.status && f.status >= 400)) return false;
    } else if (catFn(f.type) !== p.filter) return false;
    if (q && !(f.path + f.host + f.method).toLowerCase().includes(q)) return false;
    return true;
  });

  const flowT0 = (f: Flow) => {
    const idx = p.flows.indexOf(f);
    return idx < 0 ? 0 : idx * 42;
  };
  const maxEnd = Math.max(1, ...p.flows.map((f) => flowT0(f) + (f.time || 0)));
  const selectedFlow = p.flows.find((f) => f.id === p.selectedId) || null;

  const chipBase: CSSProperties = {
    appearance: "none",
    border: "none",
    cursor: "pointer",
    font: "11px -apple-system,system-ui",
    padding: "3px 9px",
    borderRadius: 6,
  };

  const renderStatus = (f: Flow, sel: boolean) => {
    const sCol = sel ? "#fff" : statusColor(f.status);
    const text = f.status == null ? "···" : f.status === 101 ? "101" : String(f.status);
    return { sCol, text };
  };

  const rowA = (f: Flow) => {
    const sel = f.id === p.selectedId;
    const { sCol, text } = renderStatus(f, sel);
    const fg = sel ? "#fff" : "#1d1d1f";
    const sub = sel ? "rgba(255,255,255,.82)" : "#9a9aa0";
    return (
      <button
        key={f.id}
        onClick={() => p.onSelect(f.id)}
        style={{
          display: "grid",
          gridTemplateColumns: GRID_A,
          alignItems: "center",
          width: "100%",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          padding: "7px 12px",
          borderBottom: "1px solid #f4f4f6",
          background: sel ? ACCENT : "transparent",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", flex: "none", background: sCol, animation: f.status == null ? "ascPulse 1s infinite" : undefined }} />
          <span style={{ font: "600 11.5px ui-monospace,Menlo,monospace", color: sCol }}>{text}</span>
        </span>
        <span style={{ font: "600 11px ui-monospace,Menlo,monospace", color: sel ? "#fff" : methodColor(f.method) }}>{f.method}</span>
        <span style={{ font: "12px ui-monospace,Menlo,monospace", color: fg, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.path}</span>
        <span style={{ fontSize: 11.5, color: sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.host}</span>
        <span style={{ fontSize: 11, color: sub }}>{typeLabel(f)}</span>
        <span style={{ font: "11px ui-monospace,Menlo,monospace", color: sub, textAlign: "right" }}>{f.sizeLabel}</span>
        <span style={{ font: "11px ui-monospace,Menlo,monospace", color: sub, textAlign: "right" }}>{f.time == null ? "—" : f.time + " ms"}</span>
      </button>
    );
  };

  const rowB = (f: Flow) => {
    const sel = f.id === p.selectedId;
    const { sCol, text } = renderStatus(f, sel);
    const fg = sel ? "#fff" : "#1d1d1f";
    const sub = sel ? "rgba(255,255,255,.82)" : "#9a9aa0";
    const t0 = flowT0(f);
    const dur = f.time || (f.status == null ? 0 : 6);
    const wfColor = sel ? "#fff" : catColor(catFn(f.type));
    return (
      <button
        key={f.id}
        onClick={() => p.onSelect(f.id)}
        style={{
          display: "grid",
          gridTemplateColumns: GRID_B,
          alignItems: "center",
          width: "100%",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          padding: "7px 12px",
          borderBottom: "1px solid #f4f4f6",
          background: sel ? ACCENT : "transparent",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", flex: "none", background: sCol, animation: f.status == null ? "ascPulse 1s infinite" : undefined }} />
          <span style={{ font: "12px ui-monospace,Menlo,monospace", color: fg, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.path}</span>
        </span>
        <span style={{ font: "600 11.5px ui-monospace,Menlo,monospace", color: sCol }}>{text}</span>
        <span style={{ font: "11px ui-monospace,Menlo,monospace", color: sub }}>{f.method}</span>
        <span style={{ fontSize: 11, color: sub }}>{typeLabel(f)}</span>
        <span style={{ fontSize: 11, color: sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.initiator}</span>
        <span style={{ font: "11px ui-monospace,Menlo,monospace", color: sub, textAlign: "right" }}>{f.sizeLabel}</span>
        {p.showWaterfall && (
          <span style={{ position: "relative", height: 13 }}>
            <span
              style={{
                position: "absolute",
                top: 3,
                height: 7,
                borderRadius: 3,
                left: `${((t0 / maxEnd) * 100).toFixed(1)}%`,
                width: `${Math.max(1.5, (dur / maxEnd) * 100).toFixed(1)}%`,
                background: wfColor,
              }}
            />
          </span>
        )}
      </button>
    );
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* toolbar */}
      <div style={{ flex: "none", borderBottom: "1px solid #ececef", padding: "8px 12px", display: "flex", alignItems: "center", gap: 10, background: "#fbfbfc" }}>
        <button
          onClick={p.onToggleRecord}
          style={{
            appearance: "none",
            border: "1px solid #e2e2e6",
            cursor: "pointer",
            font: "11.5px -apple-system,system-ui",
            fontWeight: 500,
            color: p.recording ? "#c0392b" : "#6e6e73",
            background: "#fff",
            borderRadius: 7,
            padding: "4px 10px",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.recording ? "#c0392b" : "#b0b0b6", animation: p.recording ? "ascPulse 1.4s infinite" : undefined }} />
          {p.recording ? "Recording" : "Paused"}
        </button>
        <button onClick={p.onClear} title="清空" style={{ appearance: "none", border: "none", background: "none", cursor: "pointer", color: "#8a8a8e", fontSize: 14, padding: "4px 6px" }}>
          ⌫
        </button>
        <div style={{ width: 1, height: 18, background: "#e2e2e6" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 5, background: "#f1f1f3", borderRadius: 7, padding: "4px 9px", flex: 1, maxWidth: 260 }}>
          <span style={{ color: "#9a9aa0", fontSize: 11 }}>⌕</span>
          <input
            value={p.query}
            onChange={(e) => p.onQuery(e.target.value)}
            placeholder="Filter URL / path"
            style={{ flex: 1, minWidth: 0, border: "none", background: "none", outline: "none", font: "11.5px ui-monospace,Menlo,monospace", color: "#1d1d1f" }}
          />
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 3 }}>
          {CHIPS.map(([k, label]) => {
            const on = p.filter === k;
            return (
              <button
                key={k}
                onClick={() => p.onFilter(k)}
                style={{ ...chipBase, background: on ? ACCENT : "transparent", color: on ? "#fff" : "#6e6e73", fontWeight: on ? 600 : 400 }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* variant A: table + right inspector */}
      {p.variant === "A" && (
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div style={{ flex: "none", display: "grid", gridTemplateColumns: GRID_A, padding: "6px 12px", borderBottom: "1px solid #ececef", background: "#fafafb" }}>
              <div style={headCell}>Status</div>
              <div style={headCell}>Method</div>
              <div style={headCell}>Path</div>
              <div style={headCell}>Host</div>
              <div style={headCell}>Type</div>
              <div style={{ ...headCell, textAlign: "right" }}>Size</div>
              <div style={{ ...headCell, textAlign: "right" }}>Time</div>
            </div>
            <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>{filtered.map(rowA)}</div>
          </div>
          <div onMouseDown={detailX.onMouseDown} style={{ width: 5, flex: "none", cursor: "col-resize", position: "relative", zIndex: 1 }}>
            <div style={{ position: "absolute", left: 2, top: 0, bottom: 0, width: 1, background: "#ececef" }} />
          </div>
          <div ref={detailX.panelRef} style={{ width: detailX.size, flex: "none", minHeight: 0 }}>
            <FlowDetail flow={selectedFlow} />
          </div>
        </div>
      )}

      {/* variant B: DevTools table + bottom inspector */}
      {p.variant === "B" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <div style={{ flex: "none", display: "grid", gridTemplateColumns: GRID_B, padding: "6px 12px", borderBottom: "1px solid #ececef", background: "#fafafb" }}>
              <div style={headCell}>Name</div>
              <div style={headCell}>Status</div>
              <div style={headCell}>Method</div>
              <div style={headCell}>Type</div>
              <div style={headCell}>Initiator</div>
              <div style={{ ...headCell, textAlign: "right" }}>Size</div>
              <div style={headCell}>Waterfall</div>
            </div>
            <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>{filtered.map(rowB)}</div>
          </div>
          <div onMouseDown={detailY.onMouseDown} style={{ height: 5, flex: "none", cursor: "row-resize", position: "relative", zIndex: 1 }}>
            <div style={{ position: "absolute", top: 2, left: 0, right: 0, height: 1, background: "#e0e0e4" }} />
          </div>
          <div ref={detailY.panelRef} style={{ height: detailY.size, flex: "none", minHeight: 0, boxShadow: "0 -1px 4px rgba(0,0,0,.04)" }}>
            <FlowDetail flow={selectedFlow} />
          </div>
        </div>
      )}
    </div>
  );
}

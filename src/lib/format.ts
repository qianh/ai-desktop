// Formatting + color helpers, ported verbatim from the DCLogic methods in
// AppScope.dc.html (fmtSize / mc / sc / cat / catColor).

export function fmtSize(b: number | null | undefined): string {
  if (b == null) return "—";
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(2) + " MB";
}

/** Method color */
export function methodColor(m: string): string {
  return (
    ({ GET: "#2d7d46", POST: "#1e66d0", PUT: "#b26b00", PATCH: "#7a5af0", DELETE: "#c03030" } as Record<
      string,
      string
    >)[m] || "#5b6470"
  );
}

/** Status code color */
export function statusColor(s: number | null | undefined): string {
  if (s == null) return "#8a8a8e";
  if (s === 101) return "#7a5af0";
  if (s < 300) return "#30a14e";
  if (s < 400) return "#8a8a8e";
  if (s < 500) return "#e08600";
  return "#d23b30";
}

/** Map a flow type to a short category key */
export function cat(t: string): string {
  return (
    ({
      document: "doc",
      stylesheet: "css",
      script: "js",
      image: "img",
      font: "font",
      websocket: "ws",
      xhr: "fetch",
      fetch: "fetch",
    } as Record<string, string>)[t] || "other"
  );
}

/** Category color (used for waterfall bars / type labels) */
export function catColor(c: string): string {
  return (
    ({
      doc: "#1e66d0",
      css: "#7a5af0",
      js: "#e0863b",
      img: "#30a14e",
      font: "#b26b00",
      ws: "#7a5af0",
      fetch: "#2d7d46",
    } as Record<string, string>)[c] || "#8a8a8e"
  );
}

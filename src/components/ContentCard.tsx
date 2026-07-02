import type { CSSProperties, ReactNode } from "react";
import { CONTENT_CARD_PADDING_PX, CONTENT_CARD_RADIUS_PX } from "../lib/chromeLayout";

export default function ContentCard({ children }: { children: ReactNode }) {
  return (
    <div className="asc-content-card" style={cardStyle}>
      {children}
    </div>
  );
}

const cardStyle: CSSProperties = {
  position: "relative",
  flex: 1,
  minWidth: 0,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  margin: CONTENT_CARD_PADDING_PX,
  borderRadius: CONTENT_CARD_RADIUS_PX,
  border: "1px solid var(--c-border-2)",
  background: "var(--c-bg)",
  boxShadow: "var(--c-elevate, none)",
};
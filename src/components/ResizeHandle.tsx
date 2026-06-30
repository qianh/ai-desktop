import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

type Props = {
  ariaLabel: string;
  onResizeDelta: (deltaPx: number) => void;
  onResizeEnd?: () => void;
};

export default function ResizeHandle({ ariaLabel, onResizeDelta, onResizeEnd }: Props) {
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    let lastX = e.clientX;

    const onMove = (ev: PointerEvent) => {
      const delta = ev.clientX - lastX;
      lastX = ev.clientX;
      onResizeDelta(delta);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      onResizeEnd?.();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      style={handleStyle}
    />
  );
}

const handleStyle: CSSProperties = {
  width: 5,
  flex: "none",
  cursor: "ew-resize",
  alignSelf: "stretch",
  background: "transparent",
  position: "relative",
  touchAction: "none",
};
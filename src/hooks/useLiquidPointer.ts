function updateHighlight(el: HTMLElement, event: PointerEvent) {
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;

  el.style.setProperty("--mx", `${x}%`);
  el.style.setProperty("--my", `${y}%`);
  el.style.setProperty("--glass-highlight-opacity", "0.56");
}

function resetHighlight(el: HTMLElement) {
  el.style.setProperty("--mx", "50%");
  el.style.setProperty("--my", "0%");
  el.style.setProperty("--glass-highlight-opacity", "0.34");
}

/** Event-delegated liquid pointer with rAF throttling — no React state. */
export function bindLiquidPointer(root: ParentNode = document) {
  let activeEl: HTMLElement | null = null;
  let frame = 0;
  let lastEvent: PointerEvent | null = null;

  const flush = () => {
    frame = 0;
    if (!activeEl || !lastEvent) return;
    updateHighlight(activeEl, lastEvent);
  };

  const onPointerMove = (event: Event) => {
    if (!(event instanceof PointerEvent)) return;
    const el = (event.target as HTMLElement | null)?.closest<HTMLElement>(".liquid-glass");
    if (!el) {
      if (activeEl) {
        resetHighlight(activeEl);
        activeEl = null;
      }
      return;
    }

    if (activeEl && activeEl !== el) {
      resetHighlight(activeEl);
    }

    activeEl = el;
    lastEvent = event;
    if (!frame) frame = requestAnimationFrame(flush);
  };

  const onPointerLeave = (event: Event) => {
    if (!(event instanceof PointerEvent)) return;
    const el = (event.target as HTMLElement | null)?.closest<HTMLElement>(".liquid-glass");
    if (!el || el !== activeEl) return;
    resetHighlight(el);
    activeEl = null;
    lastEvent = null;
  };

  root.addEventListener("pointermove", onPointerMove, { passive: true });
  root.addEventListener("pointerout", onPointerLeave, { passive: true });

  return () => {
    root.removeEventListener("pointermove", onPointerMove);
    root.removeEventListener("pointerout", onPointerLeave);
    if (frame) cancelAnimationFrame(frame);
    if (activeEl) resetHighlight(activeEl);
  };
}
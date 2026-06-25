export type PageWebviewHorizontal = {
  sidebarRight: number;
  panelRight: number;
};

/** Horizontal anchors for Rust-side window height computation. */
export function measurePageWebviewHorizontal(
  panel: HTMLElement,
  sidebar?: HTMLElement | null,
): PageWebviewHorizontal | null {
  if (!sidebar) return null;
  const panelRect = panel.getBoundingClientRect();
  const sidebarRect = sidebar.getBoundingClientRect();
  if (panelRect.width < 1 || panelRect.height < 1) return null;
  if (sidebarRect.width < 1) return null;
  return { sidebarRight: sidebarRect.right, panelRight: panelRect.right };
}
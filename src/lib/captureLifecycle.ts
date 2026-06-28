export const BACKGROUND_CAPTURE_STOP_DELAY_MS = 5 * 60 * 1000;

export type StopPageCaptureDeps = {
  stopSession: (sessionId: string) => Promise<void>;
  closePageWebview: (pageId: string) => Promise<void>;
};

export function shouldStopGlobalRecordingAfterStops(
  sessionsByPage: Record<string, string>,
  stoppedPageIds: string[],
): boolean {
  if (stoppedPageIds.length === 0) return false;
  const stopped = new Set(stoppedPageIds);
  return Object.keys(sessionsByPage).every((pageId) => stopped.has(pageId));
}

export async function stopPageCapture(
  pageId: string,
  sessionId: string,
  deps: StopPageCaptureDeps,
): Promise<void> {
  await deps.stopSession(sessionId);
  try {
    await deps.closePageWebview(pageId);
  } catch {
    // The React unmount path may have already closed the child webview.
  }
}

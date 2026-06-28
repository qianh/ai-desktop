import { describe, expect, it, vi } from "vitest";
import {
  shouldStopGlobalRecordingAfterStops,
  stopPageCapture,
} from "./captureLifecycle";

describe("shouldStopGlobalRecordingAfterStops", () => {
  it("keeps global recording enabled when another page session remains active", () => {
    expect(
      shouldStopGlobalRecordingAfterStops(
        { "page-1": "session-1", "page-2": "session-2" },
        ["page-1"],
      ),
    ).toBe(false);
  });

  it("stops global recording after the final active page session stops", () => {
    expect(
      shouldStopGlobalRecordingAfterStops(
        { "page-1": "session-1" },
        ["page-1"],
      ),
    ).toBe(true);
  });
});

describe("stopPageCapture", () => {
  it("stops the backend session before closing the native page webview", async () => {
    const calls: string[] = [];
    const stopSession = vi.fn(async () => {
      calls.push("stop");
    });
    const closePageWebview = vi.fn(async () => {
      calls.push("close");
    });

    await stopPageCapture("page-1", "session-1", {
      stopSession,
      closePageWebview,
    });

    expect(stopSession).toHaveBeenCalledWith("session-1");
    expect(closePageWebview).toHaveBeenCalledWith("page-1");
    expect(calls).toEqual(["stop", "close"]);
  });

  it("still resolves when the native webview has already gone away", async () => {
    const stopSession = vi.fn(async () => undefined);
    const closePageWebview = vi.fn(async () => {
      throw new Error("page webview not found");
    });

    await expect(
      stopPageCapture("page-1", "session-1", {
        stopSession,
        closePageWebview,
      }),
    ).resolves.toBeUndefined();
  });
});

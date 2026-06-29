import { describe, expect, it } from "vitest";
import { applyMessageUpdated, applyStreamChunk, mergeSendResponse } from "./chatEvents";
import type { ChatMessage } from "../types/chat";

const baseMessage = (id: string, content = ""): ChatMessage => ({
  id,
  thread_id: "t1",
  role: "assistant",
  content,
  status: "streaming",
  provider_profile_id: "deepseek",
  error_message: null,
  metadata_json: "{}",
  created_at: "2026-01-01T00:00:00Z",
});

describe("chatEvents", () => {
  it("applyStreamChunk appends delta", () => {
    const next = applyStreamChunk([baseMessage("m1", "hi")], {
      message_id: "m1",
      delta: " there",
    });
    expect(next[0].content).toBe("hi there");
    expect(next[0].status).toBe("streaming");
  });

  it("applyMessageUpdated replaces status and content", () => {
    const next = applyMessageUpdated([baseMessage("m1", "partial")], {
      message_id: "m1",
      status: "complete",
      content: "final",
      error_message: null,
    });
    expect(next[0].status).toBe("complete");
    expect(next[0].content).toBe("final");
  });

  it("mergeSendResponse appends user and assistant messages", () => {
    const user = { ...baseMessage("u1"), role: "user", status: "complete" };
    const assistant = baseMessage("a1");
    const next = mergeSendResponse([], { user_message: user, assistant_message: assistant });
    expect(next).toHaveLength(2);
  });
});
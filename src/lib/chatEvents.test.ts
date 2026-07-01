import { describe, expect, it } from "vitest";
import {
  applyMessageUpdated,
  applyStreamChunk,
  applyThreadUpdated,
  mergeSendResponse,
  resolveActiveThreadAfterDelete,
} from "./chatEvents";
import type { ChatMessage, ChatThread } from "../types/chat";

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

  it("applyThreadUpdated replaces matching thread title", () => {
    const threads: ChatThread[] = [
      {
        id: "t1",
        title: "New chat",
        provider_profile_id: "deepseek",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];
    const next = applyThreadUpdated(threads, {
      ...threads[0],
      title: "AEKLF股价走势",
      updated_at: "2026-01-02T00:00:00Z",
    });
    expect(next[0].title).toBe("AEKLF股价走势");
  });

  it("resolveActiveThreadAfterDelete selects next thread when active is removed", () => {
    const threads: ChatThread[] = [
      {
        id: "t1",
        title: "First",
        provider_profile_id: "deepseek",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
      },
      {
        id: "t2",
        title: "Second",
        provider_profile_id: "deepseek",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];
    const result = resolveActiveThreadAfterDelete("t1", "t1", threads);
    expect(result.remaining).toHaveLength(1);
    expect(result.nextActiveId).toBe("t2");
  });
});
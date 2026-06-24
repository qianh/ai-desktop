import { describe, it, expect } from "vitest";
import { messagesFromIntercept } from "./conversationFilter";
import type { InterceptedFetch } from "../types";

function makeIntercept(overrides: Partial<InterceptedFetch> = {}): InterceptedFetch {
  return {
    id: "test-id",
    timestamp: 1000,
    url: "https://chatgpt.com/backend-api/conversation/abc",
    method: "GET",
    status: 200,
    duration_ms: 100,
    req_headers: {},
    resp_headers: {},
    req_body: null,
    resp_body: null,
    ...overrides,
  };
}

function makeMappingBody(options: {
  turns: Array<{ role: "user" | "assistant"; text: string; time?: number }>;
  currentNodeId?: string;
}): string {
  const nodes: Record<string, unknown> = {};
  let parentId: string | null = null;
  const ids = options.turns.map((_, i) => `node${i + 1}`);

  for (let i = 0; i < options.turns.length; i++) {
    const { role, text, time = i + 1 } = options.turns[i];
    const nodeId = ids[i];
    nodes[nodeId] = {
      id: nodeId,
      parent: parentId,
      children: i < ids.length - 1 ? [ids[i + 1]] : [],
      message: {
        author: { role },
        create_time: time,
        content: { content_type: "text", parts: [text] },
      },
    };
    parentId = nodeId;
  }

  const currentNodeId = options.currentNodeId ?? ids[ids.length - 1];
  return JSON.stringify({ mapping: nodes, current_node: currentNodeId, title: "test" });
}

describe("messagesFromIntercept – multi-turn mapping", () => {
  it("returns all 4 messages for a 2-turn conversation", () => {
    const body = makeMappingBody({
      turns: [
        { role: "user", text: "first question", time: 1 },
        { role: "assistant", text: "first answer", time: 2 },
        { role: "user", text: "需要如何配置", time: 3 },
        { role: "assistant", text: "截图里的提示已经说明原因", time: 4 },
      ],
    });

    const item = makeIntercept({ resp_body: body });
    const msgs = messagesFromIntercept(item);

    expect(msgs).toHaveLength(4);
    expect(msgs[0]).toEqual({ role: "user", text: "first question" });
    expect(msgs[1]).toEqual({ role: "assistant", text: "first answer" });
    expect(msgs[2]).toEqual({ role: "user", text: "需要如何配置" });
    expect(msgs[3]).toEqual({ role: "assistant", text: "截图里的提示已经说明原因" });
  });

  it("skips system nodes and only returns user/assistant messages", () => {
    const systemNode = {
      id: "system1",
      parent: null,
      children: ["node1"],
      message: {
        author: { role: "system" },
        create_time: 0,
        content: { content_type: "text", parts: ["You are helpful."] },
      },
    };
    const userNode = {
      id: "node1",
      parent: "system1",
      children: ["node2"],
      message: {
        author: { role: "user" },
        create_time: 1,
        content: { content_type: "text", parts: ["hello"] },
      },
    };
    const assistantNode = {
      id: "node2",
      parent: "node1",
      children: [],
      message: {
        author: { role: "assistant" },
        create_time: 2,
        content: { content_type: "text", parts: ["hi there"] },
      },
    };

    const body = JSON.stringify({
      mapping: { system1: systemNode, node1: userNode, node2: assistantNode },
      current_node: "node2",
    });

    const msgs = messagesFromIntercept(makeIntercept({ resp_body: body }));
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe("user");
    expect(msgs[1].role).toBe("assistant");
  });

  it("returns empty array when current_node is missing from mapping", () => {
    const body = JSON.stringify({
      mapping: { node1: { id: "node1", parent: null, children: [], message: null } },
      current_node: "nonexistent",
    });
    const msgs = messagesFromIntercept(makeIntercept({ resp_body: body }));
    expect(msgs).toHaveLength(0);
  });

  it("returns single pair for a 1-turn conversation (backward compat)", () => {
    const body = makeMappingBody({
      turns: [
        { role: "user", text: "hi", time: 1 },
        { role: "assistant", text: "hello", time: 2 },
      ],
    });
    const msgs = messagesFromIntercept(makeIntercept({ resp_body: body }));
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toEqual({ role: "user", text: "hi" });
    expect(msgs[1]).toEqual({ role: "assistant", text: "hello" });
  });
});

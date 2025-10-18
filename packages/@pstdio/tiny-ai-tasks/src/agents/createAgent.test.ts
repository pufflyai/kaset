import { describe, expect, it, vi } from "vitest";
import { task } from "../runtime";
import { Tool } from "../tools/Tool";
import { createAgent, type MessageHistory } from "./createAgent";

import type { AssistantMessage } from "../utils/messageTypes";

describe("createAgent", () => {
  it("runs a simple tool call end-to-end", async () => {
    const llmImpl = vi.fn(async function* () {
      const msg: AssistantMessage = {
        role: "assistant",
        content: "",
        tool_calls: [{ id: "1", type: "function", function: { name: "demo", arguments: '{"foo":1}' } }],
      };
      yield msg;
      return msg;
    });

    const llm = task("llm", llmImpl);

    const fn = vi.fn(async ({ foo }: any) => ({
      messages: [{ role: "tool", tool_call_id: "1", content: JSON.stringify({ foo }) }],
    }));

    const tool = Tool(fn as any, {
      name: "demo",
      parameters: { type: "object", properties: { foo: { type: "number" } } },
    });

    const agent = createAgent({ llm, tools: [tool] });

    const initial: MessageHistory = [{ role: "user", content: "hi" }];
    const emitted: MessageHistory = [];

    for await (const [msgs] of agent(initial)) {
      if (msgs) emitted.push(...msgs);
    }

    const final: MessageHistory = [...initial, ...emitted];

    expect(llmImpl).toHaveBeenCalled();
    expect(fn).toHaveBeenCalled();

    // Ensure only new messages were streamed (no user message repeated)
    expect(emitted.every((m) => m.role !== "user")).toBe(true);

    expect(final[0]).toMatchObject({ role: "user" });
    expect(final.some((m) => m.role === "tool" && (m as any).tool_call_id === "1")).toBe(true);
  });

  it("runs multiple tool calls in parallel", async () => {
    const llmImpl = vi.fn(async function* () {
      const msg: AssistantMessage = {
        role: "assistant",
        content: "",
        tool_calls: [
          { id: "1", type: "function", function: { name: "slow", arguments: "{}" } },
          { id: "2", type: "function", function: { name: "fast", arguments: "{}" } },
        ],
      };
      yield msg;
      return msg;
    });

    const llm = task("llm", llmImpl);

    const completions: Record<string, number> = {};

    const slow = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      completions.slow = Date.now();
      return {
        messages: [{ role: "tool", tool_call_id: "1", content: JSON.stringify({ success: true }) }],
      };
    });

    const fast = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      completions.fast = Date.now();
      return {
        messages: [{ role: "tool", tool_call_id: "2", content: JSON.stringify({ success: true }) }],
      };
    });

    const agent = createAgent({
      llm,
      tools: [
        Tool(slow as any, { name: "slow", parameters: { type: "object" } }),
        Tool(fast as any, { name: "fast", parameters: { type: "object" } }),
      ],
      maxTurns: 1,
    });

    const initial: MessageHistory = [{ role: "user", content: "hi" }];

    const start = Date.now();
    for await (const _ of agent(initial)) {
      // exhaust iterator
    }
    const duration = Date.now() - start;

    expect(slow).toHaveBeenCalledTimes(1);
    expect(fast).toHaveBeenCalledTimes(1);

    expect(completions.fast).toBeLessThan(completions.slow);

    // Sequential execution would take >= 60ms; ensure we finish faster than that.
    expect(duration).toBeLessThan(60);
  });
});

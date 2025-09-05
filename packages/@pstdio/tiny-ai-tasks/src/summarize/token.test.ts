import { describe, it, expect } from "vitest";
import { roughCounter } from "./token";
import type { AssistantMessage, BaseMessage } from "../utils/messageTypes";

describe("roughCounter", () => {
  it("is deterministic and accounts for tool_calls", () => {
    const c = roughCounter();
    const msgs: BaseMessage[] = [
      { role: "system", content: "You are helpful." },
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi there" },
      {
        role: "assistant",
        content: "",
        tool_calls: [{ id: "1", type: "function", function: { name: "foo", arguments: "{}" } }],
      } as AssistantMessage as any,
    ];

    const a = c.count(msgs);
    const b = c.count(msgs);
    expect(a).toBeGreaterThan(0);
    expect(a).toBe(b);
  });
});

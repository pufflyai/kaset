import { describe, it, expect } from "vitest";
import type { MessageHistory } from "../agents/createAgent";
import { mergeStreamingMessages } from "./mergeStreaming";

describe("mergeStreamingMessages", () => {
  it("returns history when no new messages", () => {
    const history: MessageHistory = [
      { role: "system", content: "s" },
      { role: "user", content: "u" },
    ];

    const merged = mergeStreamingMessages(history, []);
    expect(merged).toEqual(history);
  });

  it("appends tool messages", () => {
    const history: MessageHistory = [{ role: "user", content: "q" }];
    const newMsgs: MessageHistory = [{ role: "tool", content: "result" as any } as any];

    const merged = mergeStreamingMessages(history, newMsgs);
    expect(merged).toEqual([...history, ...newMsgs]);
  });

  it("collapses streaming assistant snapshots by replacing last assistant", () => {
    const history: MessageHistory = [
      { role: "system", content: "s" },
      { role: "user", content: "u" },
      { role: "assistant", content: "Hello" },
    ];

    const updated: MessageHistory = [{ role: "assistant", content: "Hello, world" }];
    const merged = mergeStreamingMessages(history, updated);

    expect(merged).toEqual([
      { role: "system", content: "s" },
      { role: "user", content: "u" },
      { role: "assistant", content: "Hello, world" },
    ]);
  });

  it("handles mixed assistant + tool chunks correctly", () => {
    const history: MessageHistory = [
      { role: "user", content: "q" },
      { role: "assistant", content: "Thinking" },
    ];
    const newMsgs: MessageHistory = [
      { role: "assistant", content: "Thinking with plan" },
      { role: "tool", content: "ok" as any } as any,
    ];

    const merged = mergeStreamingMessages(history, newMsgs);
    expect(merged).toEqual([
      { role: "user", content: "q" },
      { role: "assistant", content: "Thinking with plan" },
      { role: "tool", content: "ok" as any } as any,
    ]);
  });
});

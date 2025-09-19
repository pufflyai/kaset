import { describe, expect, it } from "vitest";
import { sanitizeConversation } from "./sanitizeConversation";
import type { BaseMessage } from "../utils/messageTypes";

describe("sanitizeConversation", () => {
  it("returns the same array when no system messages exist", () => {
    const messages: BaseMessage[] = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi" },
    ];

    const sanitized = sanitizeConversation(messages);

    expect(sanitized).toEqual(messages);
  });

  it("merges system messages into a single message at the front", () => {
    const messages: BaseMessage[] = [
      { role: "user", content: "Intro" },
      { role: "system", content: "One" },
      { role: "assistant", content: "Ack" },
      { role: "system", content: "Two" },
      { role: "user", content: "Question" },
    ];

    const sanitized = sanitizeConversation(messages);

    expect(sanitized[0]).toEqual({ role: "system", content: "One\n\nTwo" });
    expect(sanitized.slice(1)).toEqual([
      { role: "user", content: "Intro" },
      { role: "assistant", content: "Ack" },
      { role: "user", content: "Question" },
    ]);
  });

  it("handles empty or null system content", () => {
    const messages: BaseMessage[] = [
      { role: "system", content: null },
      { role: "system", content: "Follow instructions" },
      { role: "user", content: "Hi" },
    ];

    const sanitized = sanitizeConversation(messages);

    expect(sanitized[0]).toEqual({ role: "system", content: "Follow instructions" });
    expect(sanitized.slice(1)).toEqual([{ role: "user", content: "Hi" }]);
  });
});

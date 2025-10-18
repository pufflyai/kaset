import { afterEach, describe, expect, it, vi } from "vitest";
import { decorateWithThought, withClosedThoughts } from "./thinkingDecorator";
import type { UIConversation } from "./types";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("decorateWithThought", () => {
  it("adds a streaming hidden thought message to the conversation", () => {
    const now = 1_234_000;
    const dateSpy = vi.spyOn(Date, "now").mockReturnValue(now);

    const initial: UIConversation = [
      {
        id: "user-1",
        role: "user",
        parts: [{ type: "text", text: "Hello" }],
      },
    ];

    const { messages, thought } = decorateWithThought(initial, () => "thought-1");

    expect(dateSpy).toHaveBeenCalledTimes(1);
    expect(messages).toHaveLength(2);

    const thinkingMessage = messages[1];

    expect(thinkingMessage).toMatchObject({
      id: "thought-1",
      role: "developer",
      meta: { hidden: true, tags: ["thinking"], startedAt: now },
      parts: [{ type: "reasoning", text: "Thinking...", state: "streaming" }],
    });

    expect(thought).toMatchObject({
      id: "thought-1",
      startedAt: now,
      isClosed: false,
    });
  });
});

describe("withClosedThoughts", () => {
  it("closes the thinking message with a duration summary", () => {
    const dateSpy = vi.spyOn(Date, "now");
    dateSpy.mockReturnValueOnce(10_000);

    const { messages, thought } = decorateWithThought([], () => "thought-2");

    dateSpy.mockReturnValueOnce(12_200);
    const closedConversation = withClosedThoughts(messages, thought);

    expect(dateSpy).toHaveBeenCalledTimes(2);

    const closedMessage = closedConversation.find((message) => message.id === "thought-2");
    expect(closedMessage).toBeDefined();

    expect(closedMessage?.parts).toEqual([{ type: "reasoning", text: "Thought for 2 seconds", state: "done" }]);

    expect(closedMessage?.meta).toMatchObject({
      hidden: true,
      tags: ["thinking"],
      startedAt: 10_000,
      finishedAt: 12_200,
      durationMs: 2_200,
    });

    const closedAgain = withClosedThoughts(closedConversation, thought);
    const cachedMessage = closedAgain.find((message) => message.id === "thought-2");

    expect(dateSpy).toHaveBeenCalledTimes(2);
    expect(cachedMessage).toBe(closedMessage);
  });

  it("returns the original conversation when the thought message is missing", () => {
    const emptyConversation: UIConversation = [
      {
        id: "assistant-1",
        role: "assistant",
        parts: [{ type: "text", text: "Nothing to see" }],
      },
    ];

    const { thought } = decorateWithThought([], () => "thought-3");

    const result = thought.close(emptyConversation);
    expect(result).toBe(emptyConversation);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssistantMessage, ToolMessage } from "@pstdio/tiny-ai-tasks";
import type { UIConversation } from "./types";

const shortUIDMock = vi.fn<() => string>();

vi.mock("@pstdio/prompt-utils", () => ({
  shortUID: shortUIDMock,
}));

const createStream = (chunks: Array<AssistantMessage | AssistantMessage[] | ToolMessage>) => ({
  async *[Symbol.asyncIterator]() {
    for (const chunk of chunks) {
      yield [chunk, undefined, undefined];
    }
  },
});

const snapshot = (messages: UIConversation) => JSON.parse(JSON.stringify(messages)) as UIConversation;

describe("toConversationUI", () => {
  beforeEach(() => {
    vi.resetModules();
    shortUIDMock.mockReset();
    let counter = 0;
    shortUIDMock.mockImplementation(() => {
      counter += 1;
      return `uid-${counter}`;
    });
  });

  it("streams assistant text and finalizes with usage", async () => {
    const { toConversationUI } = await import("./toConversationUI");

    const assistant: AssistantMessage = {
      role: "assistant",
      content: "Hello Kaset",
      usage: {
        prompt_tokens: 3,
        completion_tokens: 5,
        total_tokens: 8,
      },
    };

    const stream = createStream([assistant]);
    const snapshots: UIConversation[] = [];

    for await (const ui of toConversationUI(stream as any)) {
      snapshots.push(snapshot(ui));
    }

    expect(snapshots).toHaveLength(2);

    const initial = snapshots[0][0];
    expect(initial.id).toBe("uid-1");
    expect(initial.parts[0]).toEqual({ type: "text", text: "Hello Kaset", state: "streaming" });
    expect(initial.meta?.usage).toEqual({ promptTokens: 3, completionTokens: 5, totalTokens: 8 });

    const finalized = snapshots[1][0];
    const finalizedPart = finalized.parts[0];

    if (finalizedPart.type !== "text") throw new Error("expected text part");

    expect(finalizedPart.state).toBe("done");
    expect(finalized.meta?.usage).toEqual({ promptTokens: 3, completionTokens: 5, totalTokens: 8 });
  });

  it("tracks tool invocation lifecycle", async () => {
    const { toConversationUI } = await import("./toConversationUI");

    const assistant: AssistantMessage = {
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: "call-1",
          function: {
            name: "fetchData",
            arguments: '{"query":"kaset"}',
          },
        },
      ],
    };

    const tool: ToolMessage = {
      role: "tool",
      tool_call_id: "call-1",
      content: '{"data":{"value":42}}',
    };

    const stream = createStream([assistant, tool]);
    const snapshots: UIConversation[] = [];

    for await (const ui of toConversationUI(stream as any)) {
      snapshots.push(snapshot(ui));
    }

    expect(snapshots).toHaveLength(3);

    const inputInvocation = snapshots[0][0].parts[0];

    if (inputInvocation.type !== "tool-invocation") throw new Error("expected tool invocation part");

    expect(inputInvocation.toolInvocation).toEqual({
      type: "tool-fetchData",
      toolCallId: "call-1",
      state: "input-available",
      input: { query: "kaset" },
    });

    const outputInvocation = snapshots[1][0].parts[0];

    if (outputInvocation.type !== "tool-invocation") throw new Error("expected tool invocation part");

    expect(outputInvocation.toolInvocation).toEqual({
      type: "tool-fetchData",
      toolCallId: "call-1",
      state: "output-available",
      input: { query: "kaset" },
      providerExecuted: true,
      output: { value: 42 },
    });

    expect(snapshots[2]).toEqual(snapshots[1]);
  });

  it("surfaces tool errors with helpful text", async () => {
    const { toConversationUI } = await import("./toConversationUI");

    const assistant: AssistantMessage = {
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: "call-2",
          function: {
            name: "fetchData",
            arguments: '{"query":"kaset"}',
          },
        },
      ],
    };

    const tool: ToolMessage = {
      role: "tool",
      tool_call_id: "call-2",
      content: '{"success":false,"error":{"message":"boom"}}',
    };

    const stream = createStream([assistant, tool]);
    const snapshots: UIConversation[] = [];

    for await (const ui of toConversationUI(stream as any)) {
      snapshots.push(snapshot(ui));
    }

    const errorInvocation = snapshots[1][0].parts[0];
    if (errorInvocation.type !== "tool-invocation") throw new Error("expected tool invocation part");
    const invocation = errorInvocation.toolInvocation;
    expect(invocation).toMatchObject({
      type: "tool-fetchData",
      toolCallId: "call-2",
      state: "output-error",
      input: { query: "kaset" },
      providerExecuted: true,
    });
    if (!("state" in invocation)) throw new Error("expected tool invocation state");
    if (invocation.state !== "output-error") throw new Error("expected output-error state");
    expect(invocation.errorText).toContain('"message": "boom"');
    expect(invocation.rawInput).toEqual({
      success: false,
      error: { message: "boom" },
    });
  });
});

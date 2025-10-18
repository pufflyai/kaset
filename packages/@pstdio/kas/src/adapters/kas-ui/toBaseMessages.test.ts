import { describe, expect, it } from "vitest";
import { coerceJSONString, getLastUserText, isToolOnlyAssistantMessage, toBaseMessages } from "./toBaseMessages";
import type { ToolInvocation, UIConversation, UIMessage } from "./types";

function createTextMessage(id: string, role: UIMessage["role"], text: string): UIMessage {
  return {
    id,
    role,
    parts: [
      {
        type: "text",
        text,
      },
    ],
  };
}

function createToolInvocationMessage(id: string, invocation: ToolInvocation): UIMessage {
  return {
    id,
    role: "assistant",
    parts: [
      {
        type: "tool-invocation",
        toolInvocation: invocation,
      },
    ],
  };
}

describe("getLastUserText", () => {
  it("returns the most recent non-empty user text", () => {
    const conversation: UIConversation = [
      createTextMessage("assistant-1", "assistant", "Helper"),
      createTextMessage("user-1", "user", "First user line"),
      {
        id: "user-2",
        role: "user",
        parts: [
          { type: "text", text: " Second user line " },
          { type: "text", text: "Another chunk" },
          { type: "reasoning", text: "ignored" },
        ],
      },
    ];

    expect(getLastUserText(conversation)).toBe("Second user line\n\nAnother chunk");
  });

  it("returns undefined when no user text exists", () => {
    const conversation: UIConversation = [
      { id: "sys", role: "system", parts: [] },
      { id: "assistant", role: "assistant", parts: [] },
    ];

    expect(getLastUserText(conversation)).toBeUndefined();
  });
});

describe("isToolOnlyAssistantMessage", () => {
  it("detects assistant messages that only contain tool invocations", () => {
    const message = createToolInvocationMessage("tool-1", {
      type: "tool-example",
      toolCallId: "call-1",
      state: "input-available",
      input: {},
    });

    expect(isToolOnlyAssistantMessage(message)).toBe(true);
  });

  it("rejects assistant messages with non-tool parts", () => {
    const message = {
      id: "assistant-with-text",
      role: "assistant",
      parts: [
        { type: "tool-invocation", toolInvocation: { type: "tool-example", toolCallId: "call-1" } as ToolInvocation },
        { type: "text", text: "Not tool only" },
      ],
    } satisfies UIMessage;

    expect(isToolOnlyAssistantMessage(message)).toBe(false);
  });
});

describe("coerceJSONString", () => {
  it("returns valid JSON strings unchanged", () => {
    const json = '{"foo":1}';

    expect(coerceJSONString(json)).toBe(json);
  });

  it("stringifies non-JSON strings and objects", () => {
    expect(coerceJSONString("plain text")).toBe(JSON.stringify("plain text"));
    expect(coerceJSONString({ a: 1 })).toBe(JSON.stringify({ a: 1 }));
  });

  it("falls back to stringifying values that cannot be stringified directly", () => {
    const symbolValue = Symbol("demo");

    expect(coerceJSONString(symbolValue)).toBe(JSON.stringify(String(symbolValue)));
  });
});

describe("toBaseMessages", () => {
  it("converts user and assistant text messages", () => {
    const conversation: UIConversation = [
      createTextMessage("user-1", "user", "  Hello  "),
      createTextMessage("assistant-1", "assistant", "Hi there"),
      { id: "developer-1", role: "developer", parts: [{ type: "text", text: "ignored" }] },
    ];

    const history = toBaseMessages(conversation);

    expect(history).toEqual([
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ]);
  });

  it("includes system messages even when metadata is present", () => {
    const conversation: UIConversation = [
      {
        id: "system-1",
        role: "system",
        meta: { tags: ["bootstrap"], source: "agents.md" },
        parts: [{ type: "text", text: "System setup" }],
      },
      createTextMessage("user-1", "user", "test"),
    ];

    expect(toBaseMessages(conversation)).toEqual([
      { role: "system", content: "System setup" },
      { role: "user", content: "test" },
    ]);
  });

  it("groups tool-only assistant messages and emits tool results", () => {
    const readInvocation: ToolInvocation = {
      type: "tool-opfs_read_file",
      toolCallId: "tool-call-1",
      state: "output-available",
      input: { path: "/tmp/file.txt" },
      output: { content: "hello" },
    };

    const echoInvocation: ToolInvocation = {
      type: "tool-echo",
      toolCallId: "tool-call-2",
      state: "output-error",
      input: { message: "hi" },
      errorText: "Echo failed",
    };

    const conversation: UIConversation = [
      createTextMessage("user-1", "user", "Use a tool"),
      createToolInvocationMessage("assistant-tool-1", readInvocation),
      createToolInvocationMessage("assistant-tool-2", echoInvocation),
      createTextMessage("assistant-2", "assistant", "Tool run complete"),
    ];

    const history = toBaseMessages(conversation);

    expect(history[0]).toEqual({ role: "user", content: "Use a tool" });

    expect(history[1]).toMatchObject({
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: "tool-call-1",
          function: {
            name: "opfs_read_file",
            arguments: JSON.stringify(readInvocation.input),
          },
          type: "function",
        },
        {
          id: "tool-call-2",
          function: {
            name: "echo",
            arguments: JSON.stringify(echoInvocation.input),
          },
          type: "function",
        },
      ],
    });

    expect(JSON.parse((history[2] as any).content)).toEqual({
      success: true,
      data: readInvocation.output,
    });
    expect((history[2] as any).role).toBe("tool");
    expect((history[2] as any).tool_call_id).toBe("tool-call-1");

    expect(JSON.parse((history[3] as any).content)).toEqual({
      success: false,
      error: echoInvocation.errorText,
    });
    expect((history[3] as any).role).toBe("tool");
    expect((history[3] as any).tool_call_id).toBe("tool-call-2");

    expect(history[4]).toEqual({ role: "assistant", content: "Tool run complete" });
  });

  it("skips empty text messages", () => {
    const conversation: UIConversation = [
      {
        id: "user-1",
        role: "user",
        parts: [{ type: "text", text: "   " }],
      },
      {
        id: "assistant-1",
        role: "assistant",
        parts: [{ type: "text", text: "\n\n" }],
      },
    ];

    expect(toBaseMessages(conversation)).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import type { BaseMessage } from "@pstdio/tiny-ai-tasks";
import { toUIMessages } from "./toUIMessages";
import type { ToolInvocation, ToolInvocationUIPart, UIConversation, UIMessage } from "./types";

type TestMessage = Omit<BaseMessage, "content"> & {
  content?: any;
  [key: string]: any;
};

function ensureToolInvocationPart(part: UIMessage["parts"][number]): ToolInvocationUIPart {
  if (part.type !== "tool-invocation") {
    throw new Error(`Expected tool invocation part, received ${part.type}`);
  }

  return part;
}

type OutputAvailableInvocation = Extract<ToolInvocation, { state: "output-available" }> & {
  providerExecuted?: boolean;
};
type OutputErrorInvocation = Extract<ToolInvocation, { state: "output-error" }> & {
  providerExecuted?: boolean;
};

function assertOutputAvailableInvocation(invocation: ToolInvocation): asserts invocation is OutputAvailableInvocation {
  if (!("state" in invocation)) throw new Error("Tool invocation is missing state");
  if (invocation.state !== "output-available") {
    throw new Error(`Expected output-available state, received ${invocation.state ?? "unknown"}`);
  }
}

function assertOutputErrorInvocation(invocation: ToolInvocation): asserts invocation is OutputErrorInvocation {
  if (!("state" in invocation)) throw new Error("Tool invocation is missing state");
  if (invocation.state !== "output-error") {
    throw new Error(`Expected output-error state, received ${invocation.state ?? "unknown"}`);
  }
}

describe("toUIMessages", () => {
  it("converts basic user and assistant messages", () => {
    const messages: TestMessage[] = [
      { role: "user", content: "  Hello world  " },
      { role: "assistant", content: "Hi there" },
    ];

    const conversation = toUIMessages(messages as BaseMessage[]);

    expect(conversation).toHaveLength(2);

    const user = conversation[0];
    const assistant = conversation[1];

    expect(user).toMatchObject({
      id: "message-1",
      role: "user",
      parts: [{ type: "text", text: "Hello world" }],
    });

    expect(assistant).toMatchObject({
      id: "message-2",
      role: "assistant",
      parts: [{ type: "text", text: "Hi there" }],
    });
  });

  it("hydrates tool invocation state from tool messages", () => {
    const toolCall = {
      id: "call-1",
      function: { name: "opfs_ls", arguments: '{"path":"/tmp"}' },
    };

    const messages: TestMessage[] = [
      {
        role: "assistant",
        content: null,
        tool_calls: [toolCall],
      },
      {
        role: "tool",
        tool_call_id: "call-1",
        content: JSON.stringify({ success: true, data: { entries: ["a.txt"] } }),
      },
    ];

    const conversation = toUIMessages(messages as BaseMessage[]);

    expect(conversation).toHaveLength(1);
    const assistant = conversation[0];
    expect(assistant.role).toBe("assistant");
    expect(assistant.parts).toHaveLength(1);

    const invocationPart = ensureToolInvocationPart(assistant.parts[0]);
    const invocation = invocationPart.toolInvocation;

    expect(invocation).toMatchObject({
      type: "tool-opfs_ls",
      toolCallId: "call-1",
      state: "output-available",
      providerExecuted: true,
    });

    assertOutputAvailableInvocation(invocation);

    expect(invocation.input).toEqual({ path: "/tmp" });
    expect(invocation.output).toEqual({ entries: ["a.txt"] });
    expect(invocation.providerExecuted).toBe(true);
  });

  it("creates a fallback assistant message when tool output arrives first", () => {
    const messages: TestMessage[] = [
      {
        role: "tool",
        tool_call_id: "missing-call",
        name: "echo",
        content: JSON.stringify({ success: false, error: { message: "boom" } }),
      },
    ];

    const conversation = toUIMessages(messages as BaseMessage[]);

    expect(conversation).toHaveLength(1);

    const assistant = conversation[0];
    expect(assistant.role).toBe("assistant");
    expect(assistant.parts).toHaveLength(1);

    const invocationPart = ensureToolInvocationPart(assistant.parts[0]);
    const invocation = invocationPart.toolInvocation;

    expect(invocation.toolCallId).toBe("missing-call");
    expect(invocation.type).toBe("tool-echo");

    assertOutputErrorInvocation(invocation);

    expect(invocation.state).toBe("output-error");
    expect(invocation.providerExecuted).toBe(true);
    expect(invocation.errorText).toContain("boom");
  });

  it("copies metadata, attachments, reasoning, and usage details", () => {
    const reasoning = [{ text: "thinking…" }, { content: "done" }];

    const messages: TestMessage[] = [
      {
        role: "assistant",
        id: "msg-1",
        content: [{ text: " line 1 " }, { text: "line 2" }],
        streaming: true,
        attachments: [{ contentType: "text/plain", name: "log.txt", size: 12, url: "/log.txt" }],
        meta: { hidden: true, tags: ["trace"], usage: { promptTokens: 1 } },
        usage: { prompt_tokens: 10, completion_tokens: 5 },
        reasoning,
      },
    ];

    const conversation: UIConversation = toUIMessages(messages as BaseMessage[]);

    expect(conversation).toHaveLength(1);
    const assistant = conversation[0];

    expect(assistant).toMatchObject({
      id: "msg-1",
      streaming: true,
      attachments: [{ contentType: "text/plain", name: "log.txt", size: 12, url: "/log.txt" }],
      meta: {
        hidden: true,
        tags: ["trace"],
        usage: { promptTokens: 10, completionTokens: 5 },
      },
    });

    expect(assistant.parts).toEqual([
      { type: "text", text: "line 1" },
      { type: "text", text: "line 2" },
      { type: "reasoning", text: "thinking…" },
      { type: "reasoning", text: "done" },
    ]);
  });
});

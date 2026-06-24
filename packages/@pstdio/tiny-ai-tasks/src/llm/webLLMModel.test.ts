import { describe, expect, it, vi } from "vitest";
import { MemorySaver } from "../runtime";
import { Tool } from "../tools/Tool";
import type { AssistantMessage } from "../utils/messageTypes";
import { webLLMModel } from "./webLLMModel";

const makeEngine = (create: ReturnType<typeof vi.fn>) => ({
  chat: { completions: { create } },
});

describe("webLLMModel", () => {
  it("streams content from an injected engine", async () => {
    const stream = async function* () {
      yield { choices: [{ delta: { role: "assistant" } }] } as any;
      yield { choices: [{ delta: { content: "he" } }] } as any;
      yield { choices: [{ delta: { content: "llo" } }] } as any;
    };
    const create = vi.fn().mockResolvedValue(stream());

    const model = webLLMModel({ model: "gemma", engine: makeEngine(create) });
    const saver = new MemorySaver();
    const outputs: Array<AssistantMessage | undefined> = [];
    for await (const [msg] of model([], { runId: "1", checkpointer: saver })) {
      outputs.push(msg as AssistantMessage);
    }

    expect(outputs.map((o) => o?.content)).toEqual(["", "he", "hello"]);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ stream: true }));
  });

  it("accumulates tool call deltas and captures usage", async () => {
    const stream = async function* () {
      yield {
        choices: [{ delta: { tool_calls: [{ index: 0, id: "1", function: { name: "foo", arguments: "{" } }] } }],
      } as any;
      yield { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: "}" } }] } }] } as any;
      yield { choices: [{ delta: {} }], usage: { total_tokens: 7 } } as any;
    };
    const create = vi.fn().mockResolvedValue(stream());

    const model = webLLMModel({ model: "gemma", engine: makeEngine(create) });
    const saver = new MemorySaver();
    let final: AssistantMessage | undefined;
    for await (const [msg] of model([], { runId: "2", checkpointer: saver })) {
      final = msg as AssistantMessage;
    }

    expect(final?.tool_calls).toEqual([{ id: "1", type: "function", function: { name: "foo", arguments: "{}" } }]);
    expect(final?.usage).toEqual({ total_tokens: 7 });
  });

  it("injects tools into the prompt instead of passing WebLLM's gated tools param", async () => {
    const stream = async function* () {
      yield { choices: [{ delta: { content: "ok" } }] } as any;
    };
    const create = vi.fn().mockResolvedValue(stream());

    const model = webLLMModel({ model: "gemma", engine: makeEngine(create) });
    const tool = Tool(async () => ({}), {
      name: "demo",
      parameters: { type: "object", properties: {} },
    });

    for await (const _ of model({ messages: [{ role: "user", content: "hi" }], tools: [tool] })) {
      // consume generator
    }

    const callArg = create.mock.calls[0][0];
    // Never pass the allowlist-gated `tools` param.
    expect(callArg.tools).toBeUndefined();
    // The tools are described in an injected system message instead.
    expect(callArg.messages[0].role).toBe("system");
    expect(callArg.messages[0].content).toContain('"demo"');
  });

  it("parses a streamed <tool_call> block into structured tool_calls", async () => {
    const stream = async function* () {
      yield { choices: [{ delta: { content: '<tool_call>{"name":"demo","' } }] } as any;
      yield { choices: [{ delta: { content: 'arguments":{"x":1}}</tool_call>' } }] } as any;
    };
    const create = vi.fn().mockResolvedValue(stream());

    const model = webLLMModel({ model: "gemma", engine: makeEngine(create) });
    const tool = Tool(async () => ({}), {
      name: "demo",
      parameters: { type: "object", properties: { x: { type: "number" } } },
    });

    let final: AssistantMessage | undefined;
    for await (const [msg] of model({ messages: [{ role: "user", content: "go" }], tools: [tool] })) {
      final = msg as AssistantMessage;
    }

    expect(final?.tool_calls).toHaveLength(1);
    expect(final?.tool_calls?.[0]).toMatchObject({
      type: "function",
      function: { name: "demo", arguments: '{"x":1}' },
    });
    expect(final?.tool_calls?.[0].id).toMatch(/^call_\d+_0$/);
    expect(final?.content).toBe("");
  });

  it("never streams raw tool-call markup in intermediate snapshots", async () => {
    const stream = async function* () {
      yield { choices: [{ delta: { content: "Let me check " } }] } as any;
      yield { choices: [{ delta: { content: '<tool_call>{"name":"demo",' } }] } as any;
      yield { choices: [{ delta: { content: '"arguments":{}}</tool_call>' } }] } as any;
    };
    const create = vi.fn().mockResolvedValue(stream());

    const model = webLLMModel({ model: "gemma", engine: makeEngine(create) });
    const tool = Tool(async () => ({}), { name: "demo", parameters: { type: "object", properties: {} } });

    const contents: string[] = [];
    for await (const [msg] of model({ messages: [{ role: "user", content: "go" }], tools: [tool] })) {
      const c = (msg as AssistantMessage)?.content;
      if (typeof c === "string") contents.push(c);
    }

    expect(contents.every((c) => !c.includes("<tool_call"))).toBe(true);
  });

  it("moves a lone non-leading system message to the front", async () => {
    const stream = async function* () {
      yield { choices: [{ delta: { content: "ok" } }] } as any;
    };
    const create = vi.fn().mockResolvedValue(stream());

    const model = webLLMModel({ model: "gemma", engine: makeEngine(create) });

    for await (const _ of model([
      { role: "user", content: "hi" },
      { role: "system", content: "be brief" },
    ])) {
      // consume
    }

    const sent = create.mock.calls[0][0].messages;
    expect(sent[0]).toEqual({ role: "system", content: "be brief" });
    expect(sent[1]).toEqual({ role: "user", content: "hi" });
  });
});

import type { InterruptObject, Snapshot } from "@pstdio/tiny-tasks";
import { MemorySaver } from "../runtime";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssistantMessage, BaseMessage } from "../utils/messageTypes";
import { createLLMTask } from "./createLLMTask";
import { Tool } from "../tools/Tool";

const { OpenAI: MockedOpenAI } = vi.hoisted(() => {
  return {
    OpenAI: vi.fn(),
  };
});
vi.mock("openai", () => ({ default: MockedOpenAI }));

describe("createLLMTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("streams partial content", async () => {
    const create = vi.fn();
    const stream = async function* () {
      yield { choices: [{ delta: { role: "assistant" } }] } as any;
      yield { choices: [{ delta: { content: "he" } }] } as any;
      yield { choices: [{ delta: { content: "llo" } }] } as any;
      yield { choices: [{ delta: {} }] } as any;
    };
    MockedOpenAI.mockImplementation(() => ({
      chat: { completions: { create: create.mockResolvedValue(stream()) } },
    }));

    const task = createLLMTask({ model: "gpt", apiKey: "k" });
    const saver = new MemorySaver();
    const outputs: Array<[AssistantMessage | undefined, Snapshot | undefined, InterruptObject | undefined]> = [];
    for await (const t of task([], { runId: "1", checkpointer: saver })) {
      outputs.push(t);
    }

    expect(outputs.map((o) => o[0]?.content)).toEqual(["", "he", "hello", "hello"]);
    expect(outputs.at(-1)?.[1]).toBeDefined();
  });

  it("accumulates tool call deltas", async () => {
    const create = vi.fn();
    const stream = async function* () {
      yield {
        choices: [{ delta: { tool_calls: [{ index: 0, id: "1", function: { name: "foo", arguments: "{" } }] } }],
      } as any;
      yield { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: "}" } }] } }] } as any;
      yield { choices: [{ delta: {} }] } as any;
    };
    MockedOpenAI.mockImplementation(() => ({
      chat: { completions: { create: create.mockResolvedValue(stream()) } },
    }));

    const task = createLLMTask({ model: "gpt", apiKey: "k" });
    const saver = new MemorySaver();
    let final: AssistantMessage | undefined;
    for await (const [msg] of task([], { runId: "2", checkpointer: saver })) {
      final = msg as AssistantMessage;
    }

    expect(final?.tool_calls).toEqual([{ id: "1", type: "function", function: { name: "foo", arguments: "{}" } }]);
  });
});

describe("createLLMTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a task with reasoning capabilities", async () => {
    const create = vi.fn();
    const stream = async function* () {
      yield { choices: [{ delta: { role: "assistant" } }] } as any;
      yield { choices: [{ delta: { content: "I need to think..." } }] } as any;
      yield { choices: [{ delta: { content: " carefully about this." } }] } as any;
    };
    MockedOpenAI.mockImplementation(() => ({
      chat: { completions: { create: create.mockResolvedValue(stream()) } },
    }));

    const task = createLLMTask({
      model: "gpt-4o",
      apiKey: "test-key",
      baseUrl: "https://api.openai.com",
      temperature: 0.7,
      reasoning: { effort: "high" },
    });

    const saver = new MemorySaver();
    let final: AssistantMessage | undefined;
    for await (const [msg] of task([{ role: "user", content: "Hello" }], {
      runId: "reasoning-test",
      checkpointer: saver,
    })) {
      final = msg as AssistantMessage;
    }

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o",
        temperature: 0.7,
        reasoning_effort: "high",
        stream: true,
      }),
    );
    expect(final?.content).toBe("I need to think... carefully about this.");
  });

  it("falls back to createLLMTask behavior for backward compatibility", async () => {
    const create = vi.fn();
    const stream = async function* () {
      yield { choices: [{ delta: { role: "assistant" } }] } as any;
      yield { choices: [{ delta: { content: "Hello world" } }] } as any;
    };
    MockedOpenAI.mockImplementation(() => ({
      chat: { completions: { create: create.mockResolvedValue(stream()) } },
    }));

    const task = createLLMTask({
      model: "gpt-5-mini",
      apiKey: "test-key",
    });

    const saver = new MemorySaver();
    let final: AssistantMessage | undefined;
    for await (const [msg] of task([{ role: "user", content: "Hello" }], {
      runId: "compat-test",
      checkpointer: saver,
    })) {
      final = msg as AssistantMessage;
    }

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-5-mini",
        stream: true,
      }),
    );
    expect(final?.content).toBe("Hello world");
  });

  it("concatenates system prompts before calling the provider", async () => {
    const create = vi.fn();
    const stream = async function* () {
      yield { choices: [{ delta: {} }] } as any;
    };
    MockedOpenAI.mockImplementation(() => ({
      chat: { completions: { create: create.mockResolvedValue(stream()) } },
    }));

    const task = createLLMTask({
      model: "gpt-4o",
      apiKey: "test-key",
    });

    const messages: BaseMessage[] = [
      { role: "user", content: "Hi" },
      { role: "system", content: "You are helpful." },
      { role: "assistant", content: "Sure" },
      { role: "system", content: "Always cite sources." },
    ];

    const saver = new MemorySaver();
    for await (const _ of task(messages, { runId: "system-merge", checkpointer: saver })) {
      // consume generator
    }

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          { role: "system", content: "You are helpful.\n\nAlways cite sources." },
          { role: "user", content: "Hi" },
          { role: "assistant", content: "Sure" },
        ],
      }),
    );
  });

  it("accepts router-style input with Tool[] and forwards OpenAI tool defs", async () => {
    const create = vi.fn();
    const stream = async function* () {
      yield { choices: [{ delta: {} }] } as any;
    };

    MockedOpenAI.mockImplementation(() => ({
      chat: { completions: { create: create.mockResolvedValue(stream()) } },
    }));

    const router = createLLMTask({ model: "gpt-5-mini", apiKey: "k" });

    const tool = Tool(async () => ({}), {
      name: "demo",
      parameters: { type: "object", properties: {} },
    });

    for await (const _ of router({ messages: [], tools: [tool] })) {
      // consume generator
    }

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: [
          {
            type: "function",
            function: { name: "demo", parameters: { type: "object", properties: {} } },
          },
        ],
      }),
    );
  });
});

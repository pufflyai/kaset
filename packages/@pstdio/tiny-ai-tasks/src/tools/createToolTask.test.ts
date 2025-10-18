import { MemorySaver } from "../runtime";
import type { Snapshot } from "@pstdio/tiny-tasks";
import { describe, expect, it, vi } from "vitest";
import { createToolTask, ToolResult } from "./createToolTask";
import { Tool } from "./Tool";
import { toolNotFound, invalidToolCall } from "../utils/errors";
import { ToolCall } from "../utils/messageTypes";

describe("createToolTask", () => {
  it("routes call to matching tool", async () => {
    const tool = Tool(
      async (params: any, cfg) => {
        const res: ToolResult = {
          messages: [{ role: "tool", tool_call_id: cfg.toolCall?.id ?? "", content: "ok" }],
          data: params,
        };
        return res;
      },
      { name: "demo", parameters: { type: "object", properties: {} } },
    );

    const task = createToolTask([tool]);
    const call: ToolCall = {
      id: "1",
      type: "function",
      function: { name: "demo", arguments: '{"foo":1}' },
    };
    const saver = new MemorySaver();
    const outputs: Array<[ToolResult | undefined, Snapshot | undefined, unknown]> = [];

    for await (const t of task(call, { runId: "r1", checkpointer: saver })) {
      outputs.push(t);
    }

    const [finalResult, finalSnap] = outputs.at(-1)!;
    expect(finalResult!.data).toEqual({ foo: 1 });
    expect(finalSnap).toBeDefined();
  });

  it("returns toolNotFound error when tool is missing", async () => {
    const task = createToolTask([]);
    const call: ToolCall = {
      id: "x",
      type: "function",
      function: { name: "none", arguments: "{}" },
    };
    const saver = new MemorySaver();
    const outputs: Array<[ToolResult | undefined, Snapshot | undefined, unknown]> = [];
    for await (const t of task(call, { runId: "r2", checkpointer: saver })) {
      outputs.push(t);
    }
    const [result, snap] = outputs.at(-1)!;
    expect(result!.error).toBeInstanceOf(Error);
    expect((result!.error as Error).message).toBe(toolNotFound("none").message);
    expect(snap).toBeDefined();
  });

  it("returns invalidToolCall error for invalid json", async () => {
    const tool = Tool(async () => ({ messages: [] }), {
      name: "demo",
      parameters: { type: "object", properties: {} },
    });
    const task = createToolTask([tool]);
    const call: ToolCall = {
      id: "1",
      type: "function",
      function: { name: "demo", arguments: "{invalid" },
    };
    const outputs: Array<[ToolResult | undefined, Snapshot | undefined, unknown]> = [];
    for await (const t of task(call, { runId: "r3", checkpointer: new MemorySaver() })) {
      outputs.push(t);
    }
    const [result] = outputs.at(-1)!;
    expect(result!.error).toBeInstanceOf(Error);
    expect((result!.error as Error).message).toBe(invalidToolCall("demo").message);
  });

  it("wraps data-only tool returns into ToolResult messages", async () => {
    const t = Tool(async ({ x }: any) => ({ ok: true, x }), {
      name: "t",
      parameters: { type: "object", properties: { x: { type: "number" } } },
    });

    const rt = createToolTask([t]);
    const call: ToolCall = {
      id: "1",
      type: "function",
      function: { name: "t", arguments: '{"x":1}' },
    } as any;

    let final: ToolResult | undefined;
    for await (const [out] of rt(call)) final = out;

    expect(final!.messages[0].tool_call_id).toBe("1");

    const messageContent = final!.messages[0].content;
    if (typeof messageContent !== "string") throw new Error("Expected string tool message content");

    expect(JSON.parse(messageContent).data).toEqual({ ok: true, x: 1 });
  });

  it("passes the arguments object through to the tool", async () => {
    const fn = vi.fn(async (args: any) => args);
    const t = Tool(fn as any, {
      name: "news",
      parameters: { type: "object", properties: { topic: { type: "string" } } },
    });

    const rt = createToolTask([t]);
    const call: ToolCall = {
      id: "1",
      type: "function",
      function: { name: "news", arguments: '{"topic":"tech"}' },
    } as any;

    for await (const _ of rt(call)) {
      // consume iterator
    }

    expect(fn).toHaveBeenCalledWith({ topic: "tech" }, expect.anything());
  });
});

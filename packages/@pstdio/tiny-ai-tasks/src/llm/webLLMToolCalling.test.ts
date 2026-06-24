import { describe, expect, it } from "vitest";
import { buildToolCallingSystemPrompt, injectToolCallingPrompt, parseToolCalls } from "./webLLMToolCalling";

const toolDefs = [{ type: "function", function: { name: "demo", parameters: { type: "object", properties: {} } } }];

describe("injectToolCallingPrompt", () => {
  it("appends instructions to an existing system message", () => {
    const messages = injectToolCallingPrompt(
      [
        { role: "system", content: "Base prompt." },
        { role: "user", content: "hi" },
      ],
      toolDefs,
    );

    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("Base prompt.");
    expect(messages[0].content).toContain("<tools>");
    expect(messages[0].content).toContain('"demo"');
    expect(messages[1]).toEqual({ role: "user", content: "hi" });
  });

  it("prepends a system message when none exists", () => {
    const messages = injectToolCallingPrompt([{ role: "user", content: "hi" }], toolDefs);

    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain(buildToolCallingSystemPrompt(toolDefs).slice(0, 20));
  });
});

describe("parseToolCalls", () => {
  it("extracts a tool call and strips it from the content", () => {
    const text = 'Let me check.\n<tool_call>{"name": "opfs_ls", "arguments": {"path": "/"}}</tool_call>';
    const { content, toolCalls } = parseToolCalls(text, "42");

    expect(content).toBe("Let me check.");
    expect(toolCalls).toEqual([
      { id: "call_42_0", type: "function", function: { name: "opfs_ls", arguments: '{"path":"/"}' } },
    ]);
  });

  it("parses multiple tool calls", () => {
    const text =
      '<tool_call>{"name": "a", "arguments": {}}</tool_call><tool_call>{"name": "b", "arguments": {"x": 1}}</tool_call>';
    const { toolCalls } = parseToolCalls(text, "7");

    expect(toolCalls.map((c) => c.function.name)).toEqual(["a", "b"]);
    expect(toolCalls[1].function.arguments).toBe('{"x":1}');
  });

  it("returns plain text unchanged when there is no tool call", () => {
    const { content, toolCalls } = parseToolCalls("Hello there!", "1");

    expect(content).toBe("Hello there!");
    expect(toolCalls).toEqual([]);
  });

  it("ignores malformed tool-call blocks", () => {
    const { toolCalls } = parseToolCalls("<tool_call>not json</tool_call>", "1");
    expect(toolCalls).toEqual([]);
  });
});

import { describe, expect, it, vi } from "vitest";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { createMcpTool } from "./createMCPTool";

type NormalizedResult = {
  success: boolean;
  message?: string;
  structuredContent?: unknown;
  content?: unknown;
};

function createClientMock(resolvedValue: unknown) {
  const callTool = vi.fn().mockResolvedValue(resolvedValue);
  const client = { callTool } as unknown as Client;

  return { client, callTool };
}

function asNormalized(result: unknown) {
  return result as NormalizedResult;
}

describe("createMcpTool", () => {
  it("exposes the MCP tool definition", () => {
    const { client } = createClientMock({});
    const remote = {
      name: "search",
      description: "Finds documents",
      inputSchema: { type: "object", properties: { query: { type: "string" } } },
    };

    const tool = createMcpTool(client, remote);

    expect(tool.definition).toEqual({
      name: "search",
      description: "Finds documents",
      parameters: remote.inputSchema,
    });
  });

  it("calls client.callTool and normalizes a successful response", async () => {
    const structuredContent = { hits: 2 };
    const response = {
      message: "  done  ",
      structuredContent,
      content: [{ type: "text", text: "Done." }],
    };
    const { client, callTool } = createClientMock(response);
    const tool = createMcpTool(client, { name: "search" });

    const result = asNormalized(await tool.run({ query: "docs" }, {} as any));

    expect(callTool).toHaveBeenCalledWith({ name: "search", arguments: { query: "docs" } });
    expect(result.success).toBe(true);
    expect(result.message).toBe("done");
    expect(result.structuredContent).toBe(structuredContent);
    expect(result.content).toBe(response.content);
  });

  it("marks errors as unsuccessful and extracts messages from content entries", async () => {
    const content = [{ type: "text", text: "  failed to run " }, { type: "text", text: "see logs" }, { type: "image" }];
    const { client } = createClientMock({ isError: true, content });
    const tool = createMcpTool(client, { name: "sync" });

    const result = asNormalized(await tool.run({}, {} as any));

    expect(result.success).toBe(false);
    expect(result.message).toBe("failed to run\nsee logs");
    expect(result.content).toBe(content);
  });

  it("returns undefined message when response does not include message content", async () => {
    const { client } = createClientMock({});
    const tool = createMcpTool(client, { name: "noop" });

    const result = asNormalized(await tool.run({}, {} as any));

    expect(result.success).toBe(true);
    expect(result.message).toBeUndefined();
  });
});

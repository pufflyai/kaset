import { describe, it, expect } from "vitest";
import { Tool } from "./Tool";
import { toOpenAITools } from "./toOpenAITools";

describe("toOpenAITools", () => {
  it("converts tool definitions to OpenAI format", async () => {
    const schema = {
      name: "demo",
      description: "Demo tool",
      parameters: { type: "object", properties: {} },
    };
    const run = async () => ({ success: true });
    const t = Tool(run, schema);
    const result = toOpenAITools([t]);
    expect(result).toEqual([{ type: "function", function: schema }]);
  });
});

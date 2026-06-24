import { webLLMModel } from "@pstdio/tiny-ai-tasks";
import { describe, expect, it, vi } from "vitest";
import { createKasAgent } from "./agent";

describe("createKasAgent", () => {
  it("throws when no model is provided", () => {
    // @ts-expect-error - exercising the runtime guard
    expect(() => createKasAgent({})).toThrow("Missing model");
  });

  it("runs the provided model end-to-end", async () => {
    const stream = async function* () {
      yield { choices: [{ delta: { content: "hi" } }] } as any;
      yield { choices: [{ delta: { content: " there" } }] } as any;
    };
    const create = vi.fn().mockResolvedValue(stream());

    const model = webLLMModel({ model: "gemma", engine: { chat: { completions: { create } } } });
    const agent = createKasAgent({ model });

    const emitted: any[] = [];
    for await (const [msgs] of agent([{ role: "user", content: "hello" }])) {
      if (msgs) emitted.push(...msgs);
    }

    const assistant = emitted.filter((m) => m.role === "assistant").at(-1);
    expect(assistant?.content).toBe("hi there");
    expect(create).toHaveBeenCalledTimes(1);
  });
});

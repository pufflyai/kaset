import { describe, it, expect, beforeEach, vi } from "vitest";
import OpenAI from "openai";
import { MemorySaver } from "../runtime";
import { truncateToBudget, createSummarizer } from "./summarizeHistory";
import { roughCounter } from "./token";
import type { ExtendedMessage } from "../messages/bus";
import { createLLMTask } from "../llm/createLLMTask";
import { messageContentToString } from "../utils/messageTypes";

vi.mock("openai", () => ({ default: vi.fn() }));
const MockedOpenAI: any = OpenAI;

describe("truncateToBudget", () => {
  it("drops oldest deterministically while keeping leading system messages", () => {
    const history: ExtendedMessage[] = [
      { role: "system", content: "sys" },
      { role: "user", content: "u1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "u2" },
      { role: "assistant", content: "a2" },
      { role: "user", content: "u3" },
      { role: "assistant", content: "a3" },
    ];
    const budget = roughCounter().count([history[0], history[5], history[6]]);
    const truncated = truncateToBudget(history, { budget, counter: roughCounter() });

    expect(truncated).toEqual([history[0], history[5], history[6]]);
  });
});

describe("createSummarizer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("summarizes older chunk into one developer message and tags it when markSummary is true", async () => {
    const create = vi.fn();

    const streamSummary = async function* () {
      yield { choices: [{ delta: { role: "assistant" } }] } as any;
      yield { choices: [{ delta: { content: "SUM" } }] } as any;
      yield { choices: [{ delta: {} }] } as any;
    };

    create.mockResolvedValueOnce(streamSummary());
    MockedOpenAI.mockImplementation(() => ({ chat: { completions: { create } } }));

    const callLLM = createLLMTask({ model: "gpt", apiKey: "k" });

    const history: ExtendedMessage[] = [
      { role: "system", content: "sys" },
      { role: "user", content: "u1 long long long" },
      { role: "assistant", content: "a1 long long long" },
      { role: "user", content: "u2 long long long" },
      { role: "assistant", content: "a2 long long long" },
    ];
    const summaryEstimate = roughCounter().count([{ role: "developer", content: "SUM" }] as ExtendedMessage[]);
    const total = roughCounter().count(history);
    const drop = roughCounter().count([history[1]]);
    const tinyBudget = total - drop + summaryEstimate + 1;
    const summarizer = createSummarizer(callLLM);

    let compacted: ExtendedMessage[] | undefined;
    for await (const [out] of summarizer(
      { history, opts: { budget: tinyBudget, markSummary: true } },
      { runId: "sum1", checkpointer: new MemorySaver() },
    )) {
      compacted = out as ExtendedMessage[];
    }
    expect(create).toHaveBeenCalledTimes(1);
    expect(compacted?.[0].role).toBe("system");
    const hasSummary = compacted?.some((m) => {
      if (m.role !== "developer") return false;
      const text = messageContentToString(m.content);
      return text.includes("SUM") && !!m.meta?.summary;
    });
    expect(hasSummary).toBe(true);
  });
});

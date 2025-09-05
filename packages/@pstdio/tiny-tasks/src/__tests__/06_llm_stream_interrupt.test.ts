import { describe, expect, test } from "vitest";
import { createRuntime } from "../index";

const { task, MemorySaver } = createRuntime();

type TokenParts = {
  before: string[];
  after: string[];
};

const tokenStore = new Map<string, TokenParts>();

function getStore(runId: string): TokenParts {
  let entry = tokenStore.get(runId);
  if (!entry) {
    entry = { before: [], after: [] };
    tokenStore.set(runId, entry);
  }
  return entry;
}

function randomToken() {
  return Math.random().toString(36).slice(2, 5);
}

async function* streamTokens(runId: string, part: keyof TokenParts, count: number) {
  const store = getStore(runId);
  let tokens = store[part];
  if (tokens.length === 0) {
    tokens = Array.from({ length: count }, randomToken);
    store[part] = tokens;
  }
  for (const t of tokens) {
    await Promise.resolve();
    yield t;
  }
}

const checkpointer = new MemorySaver();
const runOpts = { runId: "run_llm_stream", checkpointer };

describe("example 06", () => {
  test("handles streamed interrupt and resume", async () => {
    const llmCall = task("llm_call", async function* (_q: unknown, ctx) {
      for await (const t of streamTokens(runOpts.runId, "before", 5)) {
        yield t;
      }
      const answer = ctx.interrupt<{ data: { question: string } }, string>({
        data: { question: "confirm?" },
      });
      yield answer;
      for await (const t of streamTokens(runOpts.runId, "after", 4)) {
        yield t;
      }
      return "finished";
    });

    const parts0: unknown[] = [];
    const ints0: unknown[] = [];
    for await (const [p, , i] of llmCall("proceed", runOpts)) {
      if (p) parts0.push(p);
      if (i) ints0.push(i);
    }
    expect(ints0).toEqual([{ data: { question: "confirm?" } }]);
    const stored = getStore(runOpts.runId);
    expect(parts0).toEqual(stored.before);

    const parts1: unknown[] = [];
    for await (const [p] of llmCall.resume("yes", runOpts)) {
      if (p) parts1.push(p);
    }
    expect(parts1).toEqual(["yes", ...stored.after]);
  });
});

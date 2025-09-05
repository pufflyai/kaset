import { createRuntime } from "../src/index";

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

export const llmCall = task("llm_call", async function* (_q: unknown, ctx) {
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

async function run() {
  for await (const [part, , int] of llmCall("proceed", runOpts)) {
    if (part) console.log("partial →", part);
    if (int) console.log("interrupt →", int);
  }
  console.log("resuming...");
  for await (const [part] of llmCall.resume("yes", runOpts)) {
    if (part) console.log("resume →", part);
  }
}

run();

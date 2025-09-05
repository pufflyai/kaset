import { createRuntime } from "../src/index";

const { task, MemorySaver } = createRuntime();

const checkpointer = new MemorySaver();
const runOpts = { runId: "run_nested_stream", checkpointer };

const doSomething = task("do_something", async function* (q: string) {
  yield `processing ${q}`;
  yield `done: ${q}`;
});

const workflow = task("workflow", async function* (q: string) {
  const state: string[] = [];

  for await (const [msg] of doSomething(q)) {
    if (msg) state.push(msg as string);
    yield state;
  }

  yield [...state, "workflow done"];
});

async function run() {
  for await (const [partial] of workflow("task", runOpts)) {
    console.log("partial →", partial);
  }
}

run();

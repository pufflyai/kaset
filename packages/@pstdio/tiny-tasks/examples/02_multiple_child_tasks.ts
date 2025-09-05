import { createRuntime } from "../src/index";

const { task, MemorySaver } = createRuntime();

const checkpointer = new MemorySaver();
const runOpts = { runId: "run_nested_stream", checkpointer };

const doSomething1 = task("do_something_1", async function* (q: string) {
  yield `(do_something_1) processing ${q}: 1`;
  yield `(do_something_1) processing ${q}: 2`;
  return `(do_something_1) done: ${q}`;
});

const doSomething2 = task("do_something_2", async function* (q: string) {
  yield `(do_something_2) processing ${q}: 1`;
  yield `(do_something_2) processing ${q}: 2`;
  return `(do_something_2) done: ${q}`;
});

const workflow = task("workflow", async function* (q: string) {
  const messages = await Promise.all([doSomething1.invoke(q), doSomething2.invoke(q)]);
  yield [...messages, "workflow done"];
});

async function run() {
  for await (const [partial] of workflow("task", runOpts)) {
    console.log("partial →", partial);
  }
}

run();

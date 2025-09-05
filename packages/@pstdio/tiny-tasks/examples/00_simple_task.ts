import { createRuntime } from "../src/index";

const { task, MemorySaver } = createRuntime();

const checkpointer = new MemorySaver();
const runOpts = { runId: "run_simple_task", checkpointer };

const doSomething0 = task("do_something", async function* (q: string, _ctx) {
  yield `(do_something) processing ${q}: 1`;
});

for await (const [msg] of doSomething0("my_task", runOpts)) {
  console.log("msg →", msg);
}

const doSomething = task("do_something", async function* (q: string, _ctx) {
  yield `(do_something) processing ${q}: 1`;
  yield `(do_something) processing ${q}: 2`;
  yield `(do_something) processing ${q}: 3`;
  yield `(do_something) done: ${q}`;
});

for await (const [msg] of doSomething("my_task", runOpts)) {
  console.log("msg →", msg);
}

const doSomething2 = task("do_something", async function* (q: string, _ctx) {
  yield `(do_something) processing ${q}: 5`;
  yield `(do_something) processing ${q}: 6`;
  yield `(do_something) processing ${q}: 7`;
  yield `(do_something) done: ${q}`;
});

for await (const [msg] of doSomething2("my_task", runOpts)) {
  console.log("msg →", msg);
}

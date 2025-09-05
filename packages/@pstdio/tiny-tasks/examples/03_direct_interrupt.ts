import { createRuntime } from "../src/index";

const { task, MemorySaver } = createRuntime();
const checkpointer = new MemorySaver();
const runOpts = { runId: "run_nested_stream", checkpointer };

const doSomething = task("do_something_1", async function* (q: string, ctx) {
  yield `(do_something_1) processing ${q}: 1`;
  yield `(do_something_1) processing ${q}: 2`;

  const foo = ctx.interrupt({ data: { message: "stop!" } });
  yield `(do_something_1) resuming with: ${foo}`;

  const foo2 = ctx.interrupt({ data: { message: "stop again!" } });
  yield `(do_something_1) resuming again with: ${foo2}`;

  yield `(do_something_1) done: ${foo}`;
});

for await (const [partial, _, interrupt] of doSomething("task", runOpts)) {
  if (partial) console.log("partial →", partial);
  if (interrupt) console.log("interrupt →", interrupt);
}

console.log("awaiting resume...");
for await (const [partial] of doSomething.resume("resume!", runOpts)) {
  console.log("partial →", partial);
}

console.log("awaiting second resume...");
for await (const [partial] of doSomething.resume("resume!", runOpts)) {
  console.log("partial →", partial);
}

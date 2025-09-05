import { createRuntime } from "../index";

const { task, MemorySaver } = createRuntime();

const checkpointer = new MemorySaver();
const runOpts = { runId: "run_nested_stream", checkpointer };

const doSomething = task("do_something", async function* (q: string, ctx) {
  yield `processing ${q}`;
  const foo = ctx.interrupt({ data: { message: "stop!" } });
  yield `done: ${q} ${foo}`;
});

const workflow = task("workflow", async function* (q: string) {
  const state: string[] = [];

  for await (const [msg] of doSomething(q)) {
    if (msg) {
      state.push(msg as string);
      yield state;
    }
  }

  yield [...state, "workflow done"];
});

async function run() {
  for await (const [partial, _, interrupt] of workflow("task_1", runOpts)) {
    if (partial) {
      console.log("partial →", partial);
    }

    if (interrupt) {
      console.log("interrupt →", interrupt);
    }
  }

  console.log("resuming...");

  for await (const [partial] of workflow.resume("task_2", runOpts)) {
    if (partial) {
      console.log("resume →", partial);
    }
  }
}

run();

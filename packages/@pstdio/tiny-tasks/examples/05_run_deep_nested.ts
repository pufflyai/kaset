import { createRuntime } from "../src/index";

const { task, MemorySaver } = createRuntime();

const checkpointer = new MemorySaver();
const runOpts = { runId: "run_nested_stream", checkpointer };

const inner = task("inner", async function* (q: string, ctx) {
  yield `(inner) processing ${q}`;
  const resumeVal = ctx.interrupt({ data: { message: "stop!" } });
  yield `(inner) done: ${q} ${resumeVal}`;
});

const doSomething = task("do_something", async function* (q: string) {
  for await (const [msg] of inner(q, runOpts)) {
    if (msg) yield msg as string;
  }
  yield `done: ${q}`;
});

const workflow = task<string, string[]>("workflow", async function* (q: string) {
  const state: string[] = [];

  for await (const [msg] of doSomething(q, runOpts)) {
    if (msg) state.push(msg as string);
    yield state;
  }

  return state;
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

  for await (const [partial] of workflow.resume("task_2", runOpts)) {
    if (partial) {
      console.log("resume →", partial);
    }
  }
}

run();

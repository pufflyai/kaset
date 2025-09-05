import { describe, test, expect } from "vitest";
import { createRuntime } from "../index";

const { task, MemorySaver } = createRuntime();

const checkpointer = new MemorySaver();
const runOpts = { runId: "run_nested_stream", checkpointer };

describe("example 04", () => {
  test("handles nested interrupts and resumes", async () => {
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
          yield state.slice();
        }
      }

      yield [...state, "workflow done"];
    });

    const parts0: unknown[] = [];
    const ints0: unknown[] = [];
    for await (const [p, , i] of workflow("task_1", runOpts)) {
      if (p) parts0.push(p);
      if (i) ints0.push(i);
    }
    expect(parts0).toEqual([["processing task_1"]]);
    expect(ints0).toEqual([{ data: { message: "stop!" } }]);

    const parts1: unknown[] = [];
    for await (const [p] of workflow.resume("task_2", runOpts)) {
      if (p) parts1.push(p);
    }
    expect(parts1).toEqual([
      ["processing task_1", "done: task_1 task_2"],
      ["processing task_1", "done: task_1 task_2", "workflow done"],
    ]);
  });
});

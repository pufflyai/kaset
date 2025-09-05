import { describe, test, expect } from "vitest";
import { createRuntime } from "../index";

const { task, MemorySaver } = createRuntime();

const checkpointer = new MemorySaver();
const runOpts = { runId: "run_nested_stream", checkpointer };

describe("example 01", () => {
  test("runs nested tasks", async () => {
    const doSomething = task("do_something", async function* (q: string) {
      yield `processing ${q}`;
      yield `done: ${q}`;
    });

    const workflow = task("workflow", async function* (q: string) {
      const state: string[] = [];

      for await (const [msg] of doSomething(q)) {
        if (msg) state.push(msg as string);
        yield state.slice();
      }

      return [...state, "workflow done"];
    });

    const states: unknown[] = [];
    for await (const [partial] of workflow("task", runOpts)) {
      if (partial) states.push(partial);
    }
    expect(states).toEqual([["processing task"], ["processing task", "done: task"]]);

    const result = await workflow.invoke("task", runOpts);
    expect(result).toEqual(["processing task", "done: task", "workflow done"]);
  });
});

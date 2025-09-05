import { describe, test, expect } from "vitest";
import { createRuntime } from "../index";

const { task, MemorySaver } = createRuntime();

const checkpointer = new MemorySaver();
const runOpts = { runId: "run_nested_stream", checkpointer };

describe("example 02", () => {
  test("runs multiple child tasks", async () => {
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

    // eslint-disable-next-line require-yield
    const workflow = task("workflow", async function* (q: string) {
      const messages = await Promise.all([doSomething1.invoke(q), doSomething2.invoke(q)]);
      return [...messages, "workflow done"];
    });

    const result = await workflow.invoke("task", runOpts);
    expect(result).toEqual(["(do_something_1) done: task", "(do_something_2) done: task", "workflow done"]);
  });
});

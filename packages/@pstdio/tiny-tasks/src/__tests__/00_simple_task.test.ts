import { describe, test, expect } from "vitest";
import { createRuntime } from "../index";

const { task, MemorySaver } = createRuntime();

const checkpointer = new MemorySaver();
const runOpts = { runId: "run_simple_task", checkpointer };

describe("example 00", () => {
  test("runs simple tasks", async () => {
    const doSomething0 = task("do_something", async function* (q: string) {
      yield `(do_something) processing ${q}: 1`;
    });

    const vals0: unknown[] = [];
    for await (const [msg] of doSomething0("my_task", runOpts)) {
      vals0.push(msg);
    }
    expect(vals0).toEqual(["(do_something) processing my_task: 1"]);

    const doSomething = task("do_something", async function* (q: string) {
      yield `(do_something) processing ${q}: 1`;
      yield `(do_something) processing ${q}: 2`;
      yield `(do_something) processing ${q}: 3`;
      yield `(do_something) done: ${q}`;
    });

    const vals1: unknown[] = [];
    for await (const [msg] of doSomething("my_task", runOpts)) {
      if (msg) vals1.push(msg);
    }
    expect(vals1).toEqual([
      "(do_something) processing my_task: 1",
      "(do_something) processing my_task: 2",
      "(do_something) processing my_task: 3",
      "(do_something) done: my_task",
    ]);

    const doSomething2 = task("do_something", async function* (q: string) {
      yield `(do_something) processing ${q}: 5`;
      yield `(do_something) processing ${q}: 6`;
      yield `(do_something) processing ${q}: 7`;
      yield `(do_something) done: ${q}`;
    });

    const vals2: unknown[] = [];
    for await (const [msg] of doSomething2("my_task", runOpts)) {
      if (msg) vals2.push(msg);
    }
    expect(vals2).toEqual([
      "(do_something) processing my_task: 5",
      "(do_something) processing my_task: 6",
      "(do_something) processing my_task: 7",
      "(do_something) done: my_task",
    ]);
  });
});

import { describe, test, expect } from "vitest";
import { createRuntime } from "../index";

const { task, MemorySaver } = createRuntime();

const checkpointer = new MemorySaver();
const runOpts = { runId: "run_nested_stream", checkpointer };

describe("example 03", () => {
  test("handles direct interrupts", async () => {
    const doSomething = task("do_something_1", async function* (q: string, ctx) {
      yield `(do_something_1) processing ${q}: 1`;
      yield `(do_something_1) processing ${q}: 2`;

      const foo = ctx.interrupt({ data: { message: "stop!" } });
      yield `(do_something_1) resuming with: ${foo}`;

      const foo2 = ctx.interrupt({ data: { message: "stop again!" } });
      yield `(do_something_1) resuming again with: ${foo2}`;

      yield `(do_something_1) done: ${foo}`;
    });

    const parts0: unknown[] = [];
    const ints0: unknown[] = [];
    for await (const [p, , i] of doSomething("task", runOpts)) {
      if (p) parts0.push(p);
      if (i) ints0.push(i);
    }
    expect(parts0).toEqual(["(do_something_1) processing task: 1", "(do_something_1) processing task: 2"]);
    expect(ints0).toEqual([{ data: { message: "stop!" } }]);

    const parts1: unknown[] = [];
    const ints1: unknown[] = [];
    for await (const [p, , i] of doSomething.resume("resume!", runOpts)) {
      if (p) parts1.push(p);
      if (i) ints1.push(i);
    }
    expect(parts1).toEqual(["(do_something_1) resuming with: resume!"]);
    expect(ints1).toEqual([{ data: { message: "stop again!" } }]);

    const parts2: unknown[] = [];
    for await (const [p] of doSomething.resume("resume!", runOpts)) {
      if (p) parts2.push(p);
    }
    expect(parts2).toEqual(["(do_something_1) resuming again with: resume!", "(do_something_1) done: resume!"]);
  });
});

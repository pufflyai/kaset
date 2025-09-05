import { describe, test, expect } from "vitest";
import { Pregel, MemorySaver, Command } from "./pregel.js";

describe("Pregel", () => {
  test("invoke and stream", async () => {
    const p = new Pregel(async function* (x: number) {
      yield x + 1;
      return x + 2;
    });
    const saver = new MemorySaver();
    const values: number[] = [];
    for await (const [v] of p.stream(1, { runId: "a", checkpointer: saver })) {
      if (typeof v === "number") values.push(v);
    }
    expect(values).toEqual([2]);
    const out = await p.invoke(1, { runId: "b", checkpointer: saver });
    expect(out).toBe(3);
  });

  test("interrupt and resume", async () => {
    const fn = async function* (_q: string, ctx: { interrupt: <I, R>(v: I) => R }) {
      const a = ctx.interrupt<string, string>("one");
      yield `after ${a}`;
      const b = ctx.interrupt<string, string>("two");
      return `done ${a} ${b}`;
    };
    const p = new Pregel(fn);
    const saver = new MemorySaver();

    const it1 = p.stream("x", { runId: "run", checkpointer: saver });
    const step1 = await it1.next();
    expect(step1.value[2]).toBe("one");

    const state1 = saver.load("run") as { resume: unknown[]; yieldIndex: number };
    expect(state1).toEqual({ input: "x", resume: [], yieldIndex: -1 });

    const it2 = p.stream(new Command("A"), { runId: "run", checkpointer: saver });
    const step2 = await it2.next();
    expect(step2.value[0]).toBe("after A");
    const step2b = await it2.next();
    expect(step2b.value[2]).toBe("two");

    const state2 = saver.load("run") as { resume: unknown[]; yieldIndex: number };
    expect(state2).toEqual({ input: "x", resume: ["A"], yieldIndex: 0 });

    const result = await p.invoke(new Command("B"), {
      runId: "run",
      checkpointer: saver,
    });
    expect(result).toBe("done A B");
  });

  test("invoke and stream without options", async () => {
    const p = new Pregel(async function* (x: number) {
      yield x + 1;
      return x + 2;
    });

    const values: number[] = [];
    for await (const [v] of p.stream(1)) {
      if (typeof v === "number") values.push(v);
    }
    expect(values).toEqual([2]);

    const out = await p.invoke(1);
    expect(out).toBe(3);
  });

  test("concurrent runs do not share state", async () => {
    const p = new Pregel(async function* (x: number) {
      await Promise.resolve();
      yield x;
      await Promise.resolve();
      return x + 1;
    });

    const results = await Promise.all([p.invoke(1), p.invoke(2), p.invoke(3)]);
    expect(results).toEqual([2, 3, 4]);
  });

  test("invoke throws on interrupt and closes generator", async () => {
    let finalized = false;

    const p = new Pregel(
      async function* (_x: number, ctx: { interrupt: <I, R>(v: I) => R }) {
        try {
          // Trigger an interrupt without providing a resume value
          ctx.interrupt("halt");
          // Unreachable, but keeps the generator shape realistic
          yield 0;
          return 1 as any;
        } finally {
          finalized = true;
        }
      },
    );

    await expect(p.invoke(42)).rejects.toThrowError(
      "Pregel interrupted: no output value available",
    );

    // Ensure the user generator saw finalization (no dangling work)
    expect(finalized).toBe(true);
  });
});

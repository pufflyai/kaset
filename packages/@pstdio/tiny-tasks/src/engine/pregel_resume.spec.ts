import { describe, expect, test } from "vitest";
import { createRuntime } from "../index";

/* ------------------------------------------------------------------ *
 * helper utilities
 * ------------------------------------------------------------------ */

const { task, MemorySaver } = createRuntime();

function mkRunOpts(runId: string, saver: any) {
  return { runId, checkpointer: saver };
}

/* ------------------------------------------------------------------ *
 * 1. Duplicate filtering (nested interrupt – regression for example\u202f07)
 * ------------------------------------------------------------------ */
describe("resume-skip-logic", () => {
  test("delivers every token exactly once across an interrupt", async () => {
    const saver = new MemorySaver();
    const innerOpts = mkRunOpts("inner1", saver);
    const outerOpts = mkRunOpts("outer1", saver);

    /* inner task streams 3 tokens, interrupts, then 2 more */
    const inner = task("inner", async function* (_input, ctx) {
      yield "t0";
      yield "t1";
      yield "t2";
      const r = ctx.interrupt<{ data: string }, string>({ data: "confirm?" });
      yield r;
      yield "t3";
      yield "t4";
      return "done";
    });

    /* outer task forwards tokens / interrupts 1-to-1 */
    const outer = task("outer", async function* (_input, ctx) {
      for await (const [tok, , int] of inner(undefined as any, innerOpts)) {
        if (tok) yield tok;
        if (int) yield ctx.interrupt(int as any);
      }
    });

    /* --- first run until interrupt -------------------------------- */
    const firstTokens: string[] = [];
    const ints: any[] = [];
    for await (const [t, , i] of outer(undefined, outerOpts)) {
      if (t) firstTokens.push(t as string);
      if (i) ints.push(i);
    }
    expect(firstTokens).toEqual(["t0", "t1", "t2"]);
    expect(ints).toEqual([{ data: "confirm?" }]);

    /* --- resume --------------------------------------------------- */
    const afterTokens: string[] = [];
    for await (const [t] of outer.resume("yes", outerOpts)) {
      if (t) afterTokens.push(t as string);
    }
    expect(afterTokens).toEqual(["yes", "t3", "t4"]);
  });
});

/* ------------------------------------------------------------------ *
 * 2. Multiple resumptions in the same run
 * ------------------------------------------------------------------ */
describe("multiple-interrupt-cycle", () => {
  test("state advances monotonically over two resumptions", async () => {
    const saver = new MemorySaver();
    const opts = mkRunOpts("multi", saver);

    const worker = task("worker", async function* (_input, ctx) {
      yield "A0";
      const r1 = ctx.interrupt<{ q: string }, string>({ q: "q1" });
      yield r1; // resume value 1
      yield "B0";
      const r2 = ctx.interrupt<{ q: string }, string>({ q: "q2" });
      yield r2; // resume value 2
      yield "C0";
      return "fin";
    });

    /* ---- run #1 -------------------------------------------------- */
    const p0: string[] = [];
    const i0: any[] = [];
    for await (const [t, , i] of worker(undefined, opts)) {
      if (t) p0.push(t as string);
      if (i) i0.push(i);
    }
    expect(p0).toEqual(["A0"]);
    expect(i0).toEqual([{ q: "q1" }]);

    /* ---- run #2 -------------------------------------------------- */
    const p1: string[] = [];
    const i1: any[] = [];
    for await (const [t, , i] of worker.resume("ans1", opts)) {
      if (t) p1.push(t as string);
      if (i) i1.push(i);
    }
    expect(p1).toEqual(["ans1", "B0"]);
    expect(i1).toEqual([{ q: "q2" }]);

    /* ---- run #3 -------------------------------------------------- */
    const p2: string[] = [];
    for await (const [t] of worker.resume("ans2", opts)) {
      if (t) p2.push(t as string);
    }
    expect(p2).toEqual(["ans2", "C0"]);
  });
});

/* ------------------------------------------------------------------ *
 * 3. Interrupt before first yield (checkpointYieldIndex = -1)
 * ------------------------------------------------------------------ */
describe("immediate-interrupt", () => {
  test("generator that interrupts before yielding anything", async () => {
    const saver = new MemorySaver();
    const opts = mkRunOpts("immediate", saver);

    const g = task("g", async function* (_input, ctx) {
      const input = ctx.interrupt<{ msg: string }, string>({ msg: "need-arg" });
      yield `got ${input}`;
      return "done";
    });

    const ints: any[] = [];
    for await (const [, , i] of g(undefined, opts)) {
      if (i) ints.push(i);
    }
    expect(ints).toEqual([{ msg: "need-arg" }]);

    const tokens: string[] = [];
    for await (const [t] of g.resume("arg-val", opts)) {
      if (t) tokens.push(t as string);
    }
    expect(tokens).toEqual(["got arg-val"]);
  });
});

/* ------------------------------------------------------------------ *
 * 4. Isolation of concurrent runs (AsyncLocalStorage)
 * ------------------------------------------------------------------ */
describe("concurrent-runs-isolation", () => {
  test("two runs in parallel never mix tokens or interrupts", async () => {
    const saver = new MemorySaver();
    const makeFlow = (_id: string, label: string) => {
      const { task: localTask } = createRuntime();
      return localTask(label, async function* (_input, ctx) {
        yield `${label}-t0`;
        const v = ctx.interrupt<{ ask: string }, string>({ ask: label });
        yield `${label}-${v}`;
        yield `${label}-t1`;
      });
    };

    const run = async (id: string) => {
      const parts: string[] = [];
      const ints: any[] = [];
      const flow = makeFlow(id, id);
      const opts = mkRunOpts(id, saver);

      for await (const [t, , i] of flow(undefined, opts)) {
        if (t) parts.push(t as string);
        if (i) ints.push(i);
      }
      for await (const [t] of flow.resume(`${id}-answer`, opts)) {
        if (t) parts.push(t as string);
      }
      return { parts, ints };
    };

    const [rA, rB] = await Promise.all([run("A"), run("B")]);

    expect(rA.ints).toEqual([{ ask: "A" }]);
    expect(rB.ints).toEqual([{ ask: "B" }]);

    /* parts must only contain their own labels */
    expect(rA.parts.every((p) => p.startsWith("A"))).toBe(true);
    expect(rB.parts.every((p) => p.startsWith("B"))).toBe(true);
  });
});

/* ------------------------------------------------------------------ *
 * 5. Checkpoint cleared on runtime error
 * ------------------------------------------------------------------ */
describe("checkpoint-cleanup", () => {
  test("checkpoint removed after unexpected error", async () => {
    const saver = new MemorySaver();
    const opts = mkRunOpts("crash", saver);

    const faulty = task("faulty", async function* () {
      yield "hello";
      throw new Error("boom");
    });

    /* tap the stream and catch the error */
    const iterator = faulty(undefined, opts);
    await iterator.next(); // yield "hello"
    await expect(iterator.next()).rejects.toThrow("boom");

    /* checkpoint must be gone now */
    await expect(faulty.resume("x", opts).next()).rejects.toThrow(/No checkpoint/);
    expect(saver.load("crash")).toBeUndefined();
  });
});

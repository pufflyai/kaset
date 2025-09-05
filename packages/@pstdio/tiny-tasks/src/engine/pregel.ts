import { Runtime, GraphInterrupt, type Scratchpad, type RuntimeCtx } from "./runtime";
import type { Snapshot } from "../types";

export abstract class Channel<Value> {
  abstract fromCheckpoint(value?: Value): this;
  abstract update(values: Value[]): boolean;
  abstract get(): Value;
  abstract checkpoint(): Value | undefined;
  consume(): boolean {
    return false;
  }
}

export class LastValue<Value> extends Channel<Value> {
  private value?: Value;
  lc_graph_name = "LastValue";

  fromCheckpoint(value?: Value) {
    const c = new LastValue<Value>();
    if (value !== undefined) c.value = value;
    return c as this;
  }
  update(values: Value[]): boolean {
    if (values.length === 0) return false;
    if (values.length !== 1) throw new Error("LastValue can only receive one value per step.");
    this.value = values[0];
    return true;
  }
  get(): Value {
    if (this.value === undefined) throw new Error("Channel is empty");
    return this.value;
  }
  checkpoint(): Value | undefined {
    return this.value;
  }
}

export class Command<R = unknown> {
  resume?: R;
  constructor(resume?: R) {
    this.resume = resume;
  }
}

export class MemorySaver<State = unknown> {
  private store = new Map<string, State>();
  load(runId: string): State | undefined {
    return this.store.get(runId);
  }
  save(runId: string, state: State | undefined) {
    if (state === undefined) this.store.delete(runId);
    else this.store.set(runId, state);
  }
}

export interface PregelOptions {
  runId?: string;
  checkpointer?: MemorySaver<any>;
}

function isAsyncGenerator(obj: any): obj is AsyncGenerator {
  return obj && typeof obj[Symbol.asyncIterator] === "function";
}

function asAsyncGenerator<I, O, Y>(
  fn: (i: I, ctx: RuntimeCtx) => AsyncGenerator<Y, O, unknown> | Promise<O>,
  input: I,
  ctx: RuntimeCtx,
): AsyncGenerator<Y, O, unknown> {
  const res = fn(input, ctx);
  if (isAsyncGenerator(res)) return res;

  // eslint-disable-next-line require-yield
  return (async function* () {
    const out = await res;
    return out;
  })();
}

export class Pregel<I, O, Y = unknown> {
  private fn: (input: I, ctx: RuntimeCtx) => AsyncGenerator<Y, O, unknown> | Promise<O>;
  private runtime: Runtime;

  constructor(fn: (input: I, ctx: RuntimeCtx) => AsyncGenerator<Y, O, unknown> | Promise<O>, runtime = new Runtime()) {
    this.fn = fn;
    this.runtime = runtime;
  }

  async invoke(input: I | Command, options: PregelOptions = {}): Promise<O> {
    const iterator = this.stream(input, options);

    let result = await iterator.next();

    // If an interrupt is yielded at any point, surface an error instead of
    // returning an undefined value cast to O.
    while (!result.done) {
      const tuple = result.value as [Y | undefined, Snapshot | undefined, unknown | undefined];
      const interrupt = tuple ? tuple[2] : undefined;

      if (interrupt !== undefined) {
        try {
          // Ensure the iterator is closed to avoid dangling work
          await iterator.return(undefined as any);
        } catch {
          // ignore cleanup errors
        }

        throw new Error("Pregel interrupted: no output value available");
      }

      result = await iterator.next();
    }

    return result.value as O;
  }

  async *stream(
    inputOrCommand: I | Command,
    options: PregelOptions = {},
  ): AsyncGenerator<[Y | undefined, Snapshot | undefined, unknown | undefined], O> {
    const runId = options.runId ?? "default";
    const saver = options.checkpointer;
    let checkpoint = saver?.load(runId) as { input: I; resume: unknown[]; yieldIndex: number } | undefined;

    let input: I;
    if (inputOrCommand instanceof Command) {
      if (!checkpoint) throw new Error("No checkpoint to resume from");
      input = checkpoint.input;
    } else {
      input = inputOrCommand;
      if (!checkpoint) checkpoint = { input, resume: [], yieldIndex: -1 };
    }

    const scratchpad: Scratchpad = {
      resume: checkpoint.resume.slice(),
      interruptCounter: -1,
      nullResume: inputOrCommand instanceof Command ? inputOrCommand.resume : undefined,
    };

    const checkpointYieldIndex = checkpoint.yieldIndex ?? -1;
    const initialResumeLen = scratchpad.resume.length;
    let yieldedAfterResume = false;
    let idx = -1;

    /* --- Parent->child resume handoff (mirrors Node’s getScratchpad() logic) --- */
    const caller = this.runtime.getCurrent();
    if (caller && caller !== scratchpad && caller.nullResume !== undefined) {
      scratchpad.nullResume = caller.nullResume;
      caller.resume.push(caller.nullResume);
      caller.nullResume = undefined;
      caller.interruptCounter += 1;
    }

    const ctx = this.runtime.makeCtx(scratchpad);
    const gen = asAsyncGenerator<I, O, Y>(this.fn, input, ctx);

    try {
      while (true) {
        const { value, done } = await this.runtime.withCurrent(scratchpad, () => gen.next());
        if (done) {
          saver?.save(runId, undefined);
          return value as O;
        }

        idx += 1;
        const resumeConsumed = scratchpad.resume.length > initialResumeLen;

        // Skip logic identical to Node version
        let shouldSkip = false;
        if (!resumeConsumed) {
          shouldSkip = idx <= checkpointYieldIndex;
        } else {
          shouldSkip = !yieldedAfterResume && idx === checkpointYieldIndex;
        }
        if (shouldSkip) continue;

        yieldedAfterResume = true;

        saver?.save(runId, {
          input,
          resume: scratchpad.resume.slice(),
          yieldIndex: idx,
        });

        yield [value, { resume: scratchpad.resume.slice() }, undefined];
      }
    } catch (err) {
      if (err instanceof GraphInterrupt) {
        saver?.save(runId, {
          input,
          resume: scratchpad.resume.slice(),
          yieldIndex: idx,
        });

        // Bubble to parent runtime if this stream was invoked by a parent at call time
        if (caller && caller !== scratchpad) {
          throw err;
        }

        yield [undefined, { resume: scratchpad.resume.slice() }, err.value];
        return undefined as unknown as O;
      }

      saver?.save(runId, undefined);
      throw err;
    }
  }
}

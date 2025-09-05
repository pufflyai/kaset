import { Channel, Command, LastValue, MemorySaver, Pregel } from "./engine/pregel";
import { GraphInterrupt, Runtime, type RuntimeCtx } from "./engine/runtime";
import type { Snapshot } from "./types";

export interface Task<Input, Output, Yield = unknown> {
  (
    input: Input,
    opts?: { runId?: string; checkpointer?: MemorySaver<any> },
  ): AsyncGenerator<[Yield | undefined, Snapshot | undefined, unknown | undefined], Output>;
  invoke(input: Input, opts?: { runId?: string; checkpointer?: MemorySaver<any> }): Promise<Output>;
  resume(
    resumeVal: unknown,
    opts?: { runId?: string; checkpointer?: MemorySaver<any> },
  ): AsyncGenerator<[Yield | undefined, Snapshot | undefined, unknown | undefined], Output>;
}

/**
 * Factory that yields a task creator bound to a shared Runtime.
 * Use ONE runtime per app/agent so nested tasks share the same handoff semantics.
 *
 */
export function createRuntime() {
  const runtime = new Runtime();

  function task<Input, Output, Yield = unknown>(
    _name: string,
    fn: (input: Input, ctx: RuntimeCtx) => AsyncGenerator<Yield, Output, unknown> | Promise<Output>,
  ): Task<Input, Output, Yield> {
    const engine = new Pregel<Input, Output, Yield>(fn, runtime);

    function wrapped(
      input: Input,
      opts?: { runId?: string; checkpointer?: MemorySaver<any> },
    ): AsyncGenerator<[Yield | undefined, Snapshot | undefined, unknown | undefined], Output> {
      return engine.stream(input, opts);
    }

    wrapped.invoke = (input: Input, opts?: { runId?: string; checkpointer?: MemorySaver<any> }) =>
      engine.invoke(input, opts);

    wrapped.resume = (
      resumeVal: unknown,
      opts?: { runId?: string; checkpointer?: MemorySaver<any> },
    ): AsyncGenerator<[Yield | undefined, Snapshot | undefined, unknown | undefined], Output> => {
      return engine.stream(new Command(resumeVal), opts);
    };

    return wrapped;
  }

  return {
    task,
    MemorySaver,
    Command,
    Channel,
    LastValue,
    GraphInterrupt,
  };
}

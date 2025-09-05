import type { Snapshot } from "../types";

export interface Scratchpad {
  resume: unknown[];
  interruptCounter: number;
  nullResume: unknown | undefined;
}

export class GraphInterrupt extends Error {
  value: unknown;
  constructor(value: unknown) {
    super("GraphInterrupt");
    this.value = value;
  }
}

export interface RuntimeCtx {
  interrupt<I = unknown, R = unknown>(value: I): R;
}

/**
 * Minimal runtime that:
 *  - provides a ctx.interrupt bound to a scratchpad (no ambient async context needed)
 *  - temporarily exposes the current scratchpad while the user's generator step runs
 *    so child tasks can inherit the parent's pending nullResume (same as Node’s handoff)
 */
export class Runtime {
  private current?: Scratchpad;

  getCurrent(): Scratchpad | undefined {
    return this.current;
  }

  /** Run fn while making `scratchpad` the current parent. */
  withCurrent<T>(scratchpad: Scratchpad, fn: () => Promise<T> | T): Promise<T> | T {
    const prev = this.current;
    this.current = scratchpad;
    try {
      const r = fn();
      if (r && typeof (r as any).then === "function") {
        return (r as Promise<T>).finally(() => {
          this.current = prev;
        });
      }
      this.current = prev;
      return r as T;
    } catch (e) {
      this.current = prev;
      throw e;
    }
  }

  /** Make a context object bound to a scratchpad, to be passed into the task fn. */
  makeCtx(scratchpad: Scratchpad): RuntimeCtx {
    return {
      interrupt: <I = unknown, R = unknown>(value: I): R => {
        scratchpad.interruptCounter += 1;
        const idx = scratchpad.interruptCounter;

        if (idx < scratchpad.resume.length) {
          return scratchpad.resume[idx] as R;
        }

        if (scratchpad.nullResume !== undefined) {
          const v = scratchpad.nullResume;
          scratchpad.nullResume = undefined;
          scratchpad.resume.push(v);
          return v as R;
        }

        throw new GraphInterrupt(value);
      },
    };
  }
}

/* Re-export for convenience in browser build */
export type { Snapshot };

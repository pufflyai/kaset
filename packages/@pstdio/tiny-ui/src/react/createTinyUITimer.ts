type RunWithTiming<T> = () => T | Promise<T>;

export function createTinyUITimer(label: string) {
  if (typeof performance === "undefined") {
    return {
      async withTiming<T>(_: string, run: RunWithTiming<T>) {
        return run();
      },
    };
  }

  const prefix = `[TinyUI:${label}]`;

  const logDuration = (step: string, start: number) => {
    const duration = performance.now() - start;
    console.log(`${prefix} ${step} ${duration.toFixed(2)}ms`);
  };

  const mark = (step: string) => {
    const start = performance.now();

    return () => {
      logDuration(step, start);
    };
  };

  async function withTiming<T>(step: string, run: RunWithTiming<T>) {
    const stop = mark(step);

    try {
      return await run();
    } finally {
      stop();
    }
  }

  return { withTiming, mark };
}

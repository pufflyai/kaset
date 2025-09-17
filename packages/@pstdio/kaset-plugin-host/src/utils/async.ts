export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

type MaybePromise<T> = T | Promise<T>;

export const withBudget = async <T>(fn: () => MaybePromise<T>, budgetMs: number, signal?: AbortSignal): Promise<T> => {
  if (budgetMs <= 0) {
    return await fn();
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  let abortHandler: (() => void) | undefined;
  let aborted = false;

  const timerPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError("Operation timed out"));
    }, budgetMs);
  });

  const abortPromise = signal
    ? new Promise<never>((_, reject) => {
        if (signal.aborted) {
          aborted = true;
          reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
          return;
        }
        abortHandler = () => {
          aborted = true;
          reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
        };
        signal.addEventListener("abort", abortHandler!, { once: true });
      })
    : undefined;

  try {
    const racers = [Promise.resolve(fn()), timerPromise];
    if (abortPromise) racers.push(abortPromise);
    const result = await Promise.race(racers as Promise<T>[]);
    return result;
  } catch (error) {
    if (aborted && error == null) {
      throw new DOMException("Aborted", "AbortError");
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
    if (abortHandler && signal) {
      signal.removeEventListener("abort", abortHandler);
    }
  }
};

export const sequential = async <T>(tasks: Array<() => MaybePromise<T>>): Promise<T[]> => {
  const out: T[] = [];
  for (const task of tasks) {
    out.push(await task());
  }
  return out;
};

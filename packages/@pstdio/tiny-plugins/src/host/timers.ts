function createAbortError(message: string) {
  try {
    return new DOMException(message, "AbortError");
  } catch {
    const error = new Error(message);
    (error as Error & { name: string }).name = "AbortError";
    return error;
  }
}

export async function runWithTimeout<T>(
  fn: () => Promise<T> | T,
  timeoutMs: number,
  abortSignal?: AbortSignal,
): Promise<T> {
  if (abortSignal?.aborted) {
    throw createAbortError("Operation aborted");
  }

  const runPromise = Promise.resolve().then(fn);

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return runPromise;
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let abortListener: (() => void) | undefined;

  return await Promise.race([
    runPromise.finally(() => {
      if (timeoutId) clearTimeout(timeoutId);
      if (abortListener && abortSignal) {
        abortSignal.removeEventListener("abort", abortListener);
      }
    }),
    new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error("Operation timed out"));
      }, timeoutMs);

      if (abortSignal) {
        abortListener = () => {
          reject(createAbortError("Operation aborted"));
        };
        abortSignal.addEventListener("abort", abortListener, { once: true });
      }
    }),
  ]);
}

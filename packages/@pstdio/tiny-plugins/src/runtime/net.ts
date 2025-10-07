export function createNet() {
  const fetchImpl = typeof fetch === "function" ? fetch.bind(globalThis) : undefined;
  return {
    fetch(url: string, init?: RequestInit) {
      if (!fetchImpl) {
        throw new Error("global fetch is not available in this environment");
      }
      return fetchImpl(url, init);
    },
  } satisfies {
    fetch(url: string, init?: RequestInit): Promise<Response>;
  };
}

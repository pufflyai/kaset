import type { Lockfile } from "./import-map.js";

type CompileMetrics = {
  total: number;
  cacheHits: number;
  totalMs: number;
};

type StatsState = {
  compiles: CompileMetrics;
  iframes: number;
  cache: { bundles: number };
};

type PersistentState = {
  lockfile: Lockfile | null;
  stats: StatsState;
};

const createDefaultStats = (): StatsState => ({
  compiles: { total: 0, cacheHits: 0, totalMs: 0 },
  iframes: 0,
  cache: { bundles: 0 },
});

const state: PersistentState = {
  lockfile: null,
  stats: createDefaultStats(),
};

export const setLockfile = (lockfile: Lockfile | null) => {
  state.lockfile = lockfile ? { ...lockfile } : null;
};

export const getLockfile = () => state.lockfile;

export const recordCompile = (durationMs: number, fromCache: boolean) => {
  state.stats.compiles.total += 1;
  state.stats.compiles.totalMs += Math.max(durationMs, 0);

  if (fromCache) state.stats.compiles.cacheHits += 1;
};

export const setIframeCount = (count: number) => {
  state.stats.iframes = Math.max(count, 0);
};

export const setBundleCount = (count: number) => {
  state.stats.cache.bundles = Math.max(count, 0);
};

export const getStats = () => {
  const { compiles, iframes, cache } = state.stats;
  const avgMs = compiles.total === 0 ? 0 : compiles.totalMs / compiles.total;

  return {
    compiles: { total: compiles.total, cacheHits: compiles.cacheHits, avgMs },
    iframes,
    cache: { bundles: cache.bundles },
  };
};

export const resetStats = () => {
  state.stats = createDefaultStats();
};

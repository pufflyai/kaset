export { compile } from "./esbuild/compile";
export type { CompileResult, BuildWithEsbuildOptions } from "./esbuild/types";

export { getCachedBundle, setCachedCompileResult, clearCachedCompileResult } from "./cache/cache-manifest";

export {
  registerVirtualSnapshot,
  unregisterVirtualSnapshot,
  readSnapshot,
  type VirtualSnapshot,
  type ProjectSnapshot,
} from "./core/snapshot";

export {
  registerSources,
  updateSource,
  removeSource,
  listSources,
  getSource,
  type SourceConfig,
  type SourceId,
} from "./core/sources";

export { resolveBasePath, setBasePath, resetBasePath, getBasePath } from "./core/base-path";

export { getLockfile, getStats, resetStats, setLockfile } from "./core/idb";

export { buildImportMap, type ImportMap, type Lockfile } from "./core/import-map";

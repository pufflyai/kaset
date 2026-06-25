export { clearCachedCompileResult, getCachedBundle, setCachedCompileResult } from "./cache/cache-manifest";
export { CACHE_NAME, getManifestUrl, getRuntimeHtmlPath, getVirtualPrefix } from "./constants";
export { getBasePath, resetBasePath, resolveBasePath, setBasePath } from "./core/base-path";
export { getLockfile, getStats, resetStats, setLockfile } from "./core/idb";
export { buildImportMap, type ImportMap, type Lockfile } from "./core/import-map";
export {
  type ProjectSnapshot,
  readSnapshot,
  registerVirtualSnapshot,
  unregisterVirtualSnapshot,
  type VirtualSnapshot,
} from "./core/snapshot";
export {
  getSource,
  listSources,
  registerSources,
  removeSource,
  type SourceConfig,
  type SourceId,
  updateSource,
} from "./core/sources";
export { compile } from "./esbuild/compile";
export { DEFAULT_ESBUILD_WASM_URL } from "./esbuild/wasm-url";
export { ensureVirtualFetchFallback, isServiceWorkerControlled } from "./runtime/fetch-fallback";
export { type InlineStyleEntry, type PreparedRuntimeAssets, prepareRuntimeAssets } from "./runtime/prepare-runtime";
export type { BuildWithEsbuildOptions, CompileResult } from "./types";

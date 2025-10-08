export { TinyUI } from "./react/tiny-ui";

export type { TinyUIHandle, TinyUIProps } from "./react/tiny-ui";

export type { TinyUIStatus } from "./react/types";

export { registerVirtualSnapshot, unregisterVirtualSnapshot, type ProjectSnapshot } from "./core/snapshot";

export { getLockfile, getStats, resetStats, setLockfile } from "./core/idb";

export { buildImportMap, type ImportMap, type Lockfile } from "./core/import-map";

export { CACHE_NAME } from "./constant";

export { loadSnapshot } from "./fs/loadSnapshot";

export { createTinyHost } from "./comms/host";

export type { VirtualSnapshot } from "./core/snapshot";

export { createIframeOps } from "./runtime/createIframeOps";

export { createWorkspaceFs } from "./runtime/createWorkspaceFs";

export type { CreateIframeOpsOptions } from "./runtime/createIframeOps";

export type { TinyUiOpsRequest, TinyUiOpsHandler, WorkspaceFs } from "./runtime/types";

export { compile } from "./esbuild/compile";

export {
  getCachedBundle,
  setCachedCompileResult,
  clearCachedCompileResult,
} from "./core/cache-manifest";

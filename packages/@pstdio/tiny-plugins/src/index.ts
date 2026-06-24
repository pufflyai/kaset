export { createToolsForCommands } from "./adapters/tiny-ai-tasks";
export { mergeDependencies as mergeManifestDependencies } from "./core/dependencies";
export { createHost } from "./core/host";
export { createSettingsAccessor } from "./core/settings";
export type { PluginFilesChange, PluginFilesListener } from "./core/subscriptions";
export { subscribeToPluginFiles } from "./core/subscriptions";
export type {
  CommandDefinition,
  FsScope,
  HostApi,
  HostApiMethod,
  HostApiParams,
  HostApiResult,
  HostOptions,
  Manifest,
  PluginChangePayload,
  PluginMetadata,
  StatusUpdate,
} from "./core/types";
export { HOST_API_METHODS, isHostApiMethod } from "./core/types";
export {
  buildRelativePath,
  createZipBlob,
  createZipFromDirectories,
  deletePluginDirectories,
  downloadDirectory,
  downloadPluginBundle,
  downloadPluginData,
  downloadPluginSource,
  joinZipPath,
  listDirectoryEntries,
  pluginDownloadHelpers,
  sanitizeFileSegment,
  triggerBlobDownload,
} from "./helpers/plugin-downloads";
export { markTransferables } from "./helpers/transferables";

export { usePluginHost } from "./react/usePluginHost";
export { usePlugins } from "./react/usePlugins";
export {
  createPluginHostRuntime,
  getPluginSurfaces,
  type PluginCommand,
  type PluginFilesEvent,
  type PluginHostRuntime,
  type PluginHostRuntimeOptions,
  type PluginSettingsSchema,
  type PluginSurfaces,
  type PluginSurfacesEntry,
  type PluginSurfacesSnapshot,
} from "./runtime/pluginHostRuntime";

export const HOST_API_VERSION = "v1";

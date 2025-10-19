export { createHost } from "./core/host";
export type {
  CommandDefinition,
  HostApi,
  HostOptions,
  Manifest,
  PluginChangePayload,
  PluginMetadata,
  StatusUpdate,
} from "./core/types";

export { subscribeToPluginFiles } from "./core/subscriptions";
export type { PluginFilesChange, PluginFilesListener } from "./core/subscriptions";
export { usePlugins } from "./react/usePlugins";

export { createToolsForCommands } from "./adapters/tiny-ai-tasks";
export { mergeDependencies as mergeManifestDependencies } from "./core/dependencies";
export { createSettingsAccessor } from "./core/settings";

export { usePluginHost } from "./react/usePluginHost";
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

export const HOST_API_VERSION = "v1";

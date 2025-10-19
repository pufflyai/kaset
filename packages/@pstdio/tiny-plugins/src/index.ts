export { createHost } from "./core/host";
export type {
  HostOptions,
  PluginMetadata,
  Manifest,
  HostApi,
  CommandDefinition,
  PluginChangePayload,
  StatusUpdate,
} from "./core/types";

export { usePlugins } from "./react/usePlugins";

export { createToolsForCommands } from "./adapters/tiny-ai-tasks";
export {
  createUiOpsAdapter,
  type UiOpsHandler,
  type UiOpsRequest,
  type CreateUiOpsAdapterOptions,
} from "./adapters/ui-ops-adapter";
export { createActionApi } from "./ui-bridge/actionApi";
export { createSettingsAccessor } from "./settingsAccessor";
export { mergeDependencies as mergeManifestDependencies } from "./core/dependencies";
export { getPluginSurfaces, type PluginSurfacesRaw } from "./core/surfaces";

export const HOST_API_VERSION = "1.0.0";

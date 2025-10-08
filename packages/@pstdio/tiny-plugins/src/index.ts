export { createToolsForCommands } from "./adapters/tiny-ai-tasks";
export { createPluginHost, HOST_API_VERSION } from "./host/host";
export type { HostOptions, PluginHost } from "./host/types";
export { mergeManifestDependencies } from "./model/dependencies";
export type { MergeDependenciesOptions, MergeDependenciesOwner } from "./model/dependencies";
export type {
  CommandDefinition,
  DependenciesMap,
  HostUIConfig,
  HostUIDesktopConfig,
  HostUIWindowConfig,
  JSONSchema,
  Manifest,
  PluginMetadata,
  RegisteredCommand,
} from "./model/manifest";
export type { CommandHandler, Plugin, PluginContext, PluginModule } from "./model/plugin";

export { createPluginHost, HOST_API_VERSION } from "./host/host";
export type { HostOptions, PluginHost } from "./host/types";
export { createToolsForCommands } from "./adapters/tiny-ai-tasks";
export type {
  Manifest,
  HostUIConfig,
  CommandDefinition,
  RegisteredCommand,
  PluginMetadata,
  JSONSchema,
} from "./model/manifest";
export type { Plugin, PluginModule, PluginContext, CommandHandler } from "./model/plugin";

export { createPluginHost, HOST_API_VERSION } from "./host/plugin-host";
export type { HostConfig, PluginHost } from "./host/types";
export type {
  PluginContext,
  RegisteredCommand,
  UIAdapter,
  UIHostApi,
  FSApi,
  SettingsApi,
  Logger,
  EventsApi,
  NotificationLevel,
} from "./host/context";
export type { Manifest, ActivationEvent, Permissions, JSONSchema } from "./model/manifest";
export type { Plugin, PluginModule } from "./model/plugin";

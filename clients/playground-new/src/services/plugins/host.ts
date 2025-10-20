import { toaster } from "@/components/ui/toaster";
import { PLUGIN_DATA_ROOT, PLUGIN_ROOT } from "@/constant";
import { createPluginHostRuntime } from "@pstdio/tiny-plugins";

export type {
  PluginCommand,
  PluginFilesEvent,
  PluginHostRuntime,
  PluginSettingsSchema,
  PluginSurfacesSnapshot,
} from "@pstdio/tiny-plugins";

export const host = createPluginHostRuntime({
  hostApiVersion: "v1",
  root: PLUGIN_ROOT,
  dataRoot: PLUGIN_DATA_ROOT,
  watch: true,
  notify(level, message) {
    const type = level === "error" ? "error" : level === "warn" ? "warning" : "info";
    toaster.create({ type, title: message, duration: 2000 });
  },
});

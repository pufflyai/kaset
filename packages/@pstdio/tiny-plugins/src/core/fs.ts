import { createScopedFs, type ScopedFs } from "@pstdio/opfs-utils";

function joinRoot(root: string, pluginId: string) {
  return [root, pluginId].filter(Boolean).join("/");
}

export function createPluginFs(root: string, pluginId: string): ScopedFs {
  return createScopedFs(joinRoot(root, pluginId));
}

export function createPluginDataFs(root: string, pluginId: string): ScopedFs {
  return createScopedFs(joinRoot(root, pluginId));
}

import { createScopedFs, type ScopedFs } from "@pstdio/opfs-utils";

function join(root: string, segment: string) {
  const cleanRoot = root.replace(/^\/+|\/+$/g, "");
  const cleanSegment = segment.replace(/^\/+|\/+$/g, "");
  if (!cleanRoot) return cleanSegment;
  if (!cleanSegment) return cleanRoot;
  return `${cleanRoot}/${cleanSegment}`;
}

export function createPluginFs(root: string, pluginId: string): ScopedFs {
  return createScopedFs(join(root, pluginId));
}

export function createPluginDataFs(dataRoot: string, pluginId: string): ScopedFs {
  return createScopedFs(join(dataRoot, pluginId));
}

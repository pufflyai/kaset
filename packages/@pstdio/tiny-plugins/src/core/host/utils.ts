import { mergeDependencies } from "../dependencies";
import type { HostState } from "./internalTypes";
import type { Manifest, PluginMetadata } from "../types";

export function pluginRootPath(root: string, pluginId: string) {
  return [root, pluginId].join("/");
}

export function collectMetadata(states: Map<string, HostState>): PluginMetadata[] {
  return [...states.entries()]
    .map(([id, s]) => ({ id, name: s.manifest?.name, version: s.manifest?.version }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function shouldEmitPluginsChange(
  prev?: Pick<HostState, "manifest">,
  next?: Pick<HostState, "manifest">,
): boolean {
  if (!prev && next) return true;
  if (prev && !next) return true;
  const prevManifest = prev?.manifest ?? null;
  const nextManifest = next?.manifest ?? null;
  if (!prevManifest && !nextManifest) return false;
  if (!prevManifest || !nextManifest) return true;
  return prevManifest.name !== nextManifest.name || prevManifest.version !== nextManifest.version;
}

export function getPluginDependencies(states: Map<string, HostState>) {
  return mergeDependencies(
    [...states.values()].map((s) => ({
      id: s.manifest?.id,
      dependencies: (s.manifest as Manifest | null)?.dependencies,
    })),
  );
}

import type { Manifest } from "./types";

export type PluginSurfacesRaw = Record<string, unknown>;

export function getPluginSurfaces(manifest: Manifest | null | undefined): PluginSurfacesRaw {
  const raw = manifest?.surfaces;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  return raw as PluginSurfacesRaw;
}

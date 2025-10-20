import type { Manifest } from "./types";

export function mergeDependencies(
  manifests: Array<{ id?: string; dependencies?: Manifest["dependencies"] }>,
  onConflict?: (
    dependency: string,
    previous: { pluginId?: string; url: string },
    next: { pluginId?: string; url: string },
  ) => void,
) {
  const result: Record<string, string> = {};
  const owners = new Map<string, { pluginId?: string; url: string }>();

  for (const manifest of manifests) {
    if (!manifest) continue;
    const { id, dependencies } = manifest;
    if (!dependencies) continue;

    for (const [name, url] of Object.entries(dependencies)) {
      if (typeof url !== "string" || !url.trim()) continue;
      const existing = result[name];
      if (existing === undefined) {
        result[name] = url;
        owners.set(name, { pluginId: id, url });
        continue;
      }

      if (existing === url) continue;

      const previous = owners.get(name) ?? { pluginId: undefined, url: existing };
      const next = { pluginId: id, url };
      onConflict?.(name, previous, next);
      result[name] = url;
      owners.set(name, next);
    }
  }

  return result;
}

import type { Manifest } from "./manifest";

export interface MergeDependenciesOwner {
  pluginId?: string;
  url: string;
}

export interface MergeDependenciesOptions {
  onConflict?: (dependency: string, previous: MergeDependenciesOwner, next: MergeDependenciesOwner) => void;
}

export function mergeManifestDependencies(
  manifests: Iterable<Pick<Manifest, "id" | "dependencies">>,
  options: MergeDependenciesOptions = {},
) {
  const result: Record<string, string> = {};
  const owners = new Map<string, MergeDependenciesOwner>();

  for (const manifest of manifests) {
    if (!manifest) continue;

    const { id, dependencies } = manifest;

    if (!dependencies || typeof dependencies !== "object") continue;

    for (const [dependency, url] of Object.entries(dependencies)) {
      if (typeof url !== "string" || url.trim() === "") continue;

      const existingUrl = result[dependency];

      if (existingUrl === undefined) {
        result[dependency] = url;
        owners.set(dependency, { pluginId: id, url });
        continue;
      }

      if (existingUrl === url) continue;

      const previous = owners.get(dependency) ?? { pluginId: undefined, url: existingUrl };
      const next = { pluginId: id, url };

      options.onConflict?.(dependency, previous, next);

      result[dependency] = url;
      owners.set(dependency, next);
    }
  }

  return result;
}

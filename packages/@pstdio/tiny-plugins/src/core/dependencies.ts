import type { Manifest } from "./types";

interface DependencySource {
  id?: Manifest["id"];
  dependencies?: Manifest["dependencies"];
}

export function mergeDependencies(entries: DependencySource[]): Record<string, string> {
  const result: Record<string, string> = {};

  for (const entry of entries) {
    if (!entry?.dependencies) continue;
    for (const [name, value] of Object.entries(entry.dependencies)) {
      if (typeof value !== "string" || !value.trim()) continue;
      result[name] = value;
    }
  }

  return result;
}

import type { SourceConfig } from "../host/sources.js";

export interface ProjectSnapshot {
  id: string;
  root: string;
  entryRelative: string;
  files: Record<string, string>;
  digests: Record<string, string>;
  tsconfig?: string | null;
}

interface VirtualSnapshot {
  files: Record<string, string>;
  entry?: string;
  tsconfig?: string | null;
}

const virtualSnapshots = new Map<string, VirtualSnapshot>();

const ensureLeadingSlash = (value: string) => (value.startsWith("/") ? value : `/${value}`);

const ensureRelativeToRoot = (root: string, path: string) => {
  const normalizedRoot = root.endsWith("/") ? root.slice(0, -1) : root;
  if (path.startsWith(normalizedRoot)) {
    const relative = path.slice(normalizedRoot.length);
    return ensureLeadingSlash(relative || "/index.tsx");
  }

  return ensureLeadingSlash(path);
};

const digest = async (input: string) => {
  if (
    typeof crypto !== "undefined" &&
    "subtle" in crypto &&
    typeof crypto.subtle.digest === "function" &&
    typeof TextEncoder !== "undefined"
  ) {
    const data = new TextEncoder().encode(input);
    const buffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buffer))
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
  }

  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }

  return `placeholder-${Math.abs(hash)}`;
};

const resolveEntryRelative = (config: SourceConfig, override?: string) => {
  if (override) {
    return ensureRelativeToRoot(config.root, override);
  }

  const normalizedRoot = config.root.endsWith("/") ? config.root.slice(0, -1) : config.root;
  const entryPath = config.entry ?? `${normalizedRoot}/index.tsx`;
  const relative = entryPath.startsWith(normalizedRoot) ? entryPath.slice(normalizedRoot.length) : entryPath;

  return ensureLeadingSlash(relative || "/index.tsx");
};

export const registerVirtualSnapshot = (root: string, snapshot: VirtualSnapshot) => {
  virtualSnapshots.set(root, snapshot);
};

export const unregisterVirtualSnapshot = (root: string) => {
  virtualSnapshots.delete(root);
};

const buildVirtualSnapshot = async (config: SourceConfig, virtual: VirtualSnapshot): Promise<ProjectSnapshot> => {
  const entryRelative = resolveEntryRelative(config, virtual.entry);
  const files: Record<string, string> = {};
  const digests: Record<string, string> = {};

  await Promise.all(
    Object.entries(virtual.files).map(async ([path, contents]) => {
      const relative = ensureRelativeToRoot(config.root, path);
      files[relative] = contents;
      digests[relative] = await digest(contents);
    }),
  );

  if (!files[entryRelative]) {
    throw new Error(`Virtual snapshot for ${config.id} is missing entry file ${entryRelative}`);
  }

  return {
    id: config.id,
    root: config.root,
    entryRelative,
    files,
    digests,
    tsconfig: virtual.tsconfig ?? null,
  };
};

export const readSnapshot = async (config: SourceConfig): Promise<ProjectSnapshot> => {
  const virtual = virtualSnapshots.get(config.root);
  if (!virtual) {
    throw new Error(`Snapshot not registered for source ${config.id}`);
  }

  return buildVirtualSnapshot(config, virtual);
};

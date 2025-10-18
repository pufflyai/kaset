import { ensureLeadingSlash } from "../utils";
import { hashText } from "./hash";
import type { SourceConfig } from "./sources";

export interface ProjectSnapshot {
  id: string;
  root: string;
  entryRelative: string;
  files: Record<string, string>;
  digests: Record<string, string>;
  tsconfig?: string | null;
}

export interface VirtualSnapshot {
  files: Record<string, string>;
  entry?: string;
  tsconfig?: string | null;
}

/**
 * In-memory store of host-provided snapshots. A snapshot captures the current OPFS-backed file
 * tree for a project root (files plus the designated entry file and optional tsconfig). Host
 * integrations feed those captured contents through `registerVirtualSnapshot`, and this module
 * focuses on transforming that data into a consistent shape for the compiler.
 */
const virtualSnapshots = new Map<string, VirtualSnapshot>();

const ensureRelativeToRoot = (root: string, path: string) => {
  const normalizedRoot = root.endsWith("/") ? root.slice(0, -1) : root;
  if (path.startsWith(normalizedRoot)) {
    const relative = path.slice(normalizedRoot.length);
    return ensureLeadingSlash(relative || "/index.tsx");
  }

  return ensureLeadingSlash(path);
};

const digest = (input: string) => hashText(input);

const resolveEntryRelative = (config: SourceConfig, override?: string) => {
  if (override) {
    return ensureRelativeToRoot(config.root, override);
  }

  const normalizedRoot = config.root.endsWith("/") ? config.root.slice(0, -1) : config.root;
  const entryPath = config.entry ?? `${normalizedRoot}/index.tsx`;
  const relative = entryPath.startsWith(normalizedRoot) ? entryPath.slice(normalizedRoot.length) : entryPath;

  return ensureLeadingSlash(relative || "/index.tsx");
};

/**
 * Store the latest OPFS-backed view for a source root. Callers usually gather file contents via
 * `@pstdio/opfs-utils` (for example, `clients/playground-new/src/services/plugins/tiny-ui-window.tsx`)
 * and then hand them to this helper.
 */
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

import { ls, watchDirectory, type ChangeRecord, type DirectoryWatcherCleanup } from "@pstdio/opfs-utils";

const IGNORED = [/\.settings\.json$/i, /\.keep$/i];

export async function listFiles(root: string): Promise<string[]> {
  try {
    const entries = await ls(root, { maxDepth: Infinity, kinds: ["file"], dirsFirst: false });
    return entries.map((entry) => entry.path).sort();
  } catch {
    return [];
  }
}

export async function watchPluginDir(
  root: string,
  onChange: (changes: ChangeRecord[]) => void,
): Promise<DirectoryWatcherCleanup> {
  return watchDirectory(
    root,
    (changes) => {
      const filtered = changes.filter((change) => {
        const path = change.path.join("/");
        return !IGNORED.some((pattern) => pattern.test(path));
      });
      if (filtered.length) onChange(filtered);
    },
    { recursive: true, emitInitial: false },
  );
}

export type { ChangeRecord };

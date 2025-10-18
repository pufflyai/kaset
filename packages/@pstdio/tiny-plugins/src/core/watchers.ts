import { ls, watchDirectory, type ChangeRecord, type LsEntry } from "@pstdio/opfs-utils";

const IGNORED = [/\\.settings\\.json$/i, /(^|\/)\.tmp\b/i];

export async function listFiles(rootPath: string): Promise<string[]> {
  try {
    const entries = await ls(rootPath, { maxDepth: Infinity, kinds: ["file"], showHidden: true });
    return entries.map((entry: LsEntry) => entry.path).sort();
  } catch (error) {
    console.warn(`[tiny-plugins] failed to list files for ${rootPath}: ${(error as Error).message}`);
    return [];
  }
}

export async function watchPluginDir(
  rootPath: string,
  onChange: (changes: ChangeRecord[]) => void,
): Promise<() => void | Promise<void>> {
  const cleanup = await watchDirectory(
    rootPath,
    (changes: ChangeRecord[]) => {
      const filtered = changes.filter((change) => {
        const path = change.path.join("/");
        return !IGNORED.some((pattern) => pattern.test(path));
      });
      if (!filtered.length) return;
      onChange(filtered);
    },
    { recursive: true, emitInitial: false },
  );

  return () => {
    void cleanup();
  };
}

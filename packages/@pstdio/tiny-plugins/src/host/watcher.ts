import { watchDirectory, type ChangeRecord, type DirectoryWatcherCleanup } from "@pstdio/opfs-utils";

const IGNORED_FILES = [/\.settings\.json$/i, /\.keep$/i];

export type Dispose = () => void | Promise<void>;

export async function watchPluginsRoot(
  root: string,
  onPluginTouched: (pluginId: string) => void,
): Promise<DirectoryWatcherCleanup> {
  return watchDirectory(
    root,
    (changes) => {
      const seen = new Set<string>();
      for (const change of changes) {
        if (change.path.length !== 1) continue;
        const [pluginId] = change.path;
        if (pluginId) seen.add(pluginId);
      }
      for (const id of seen) onPluginTouched(id);
    },
    { recursive: true, emitInitial: false },
  );
}

export interface PluginFileWatcherOptions {
  root: string;
  pluginId: string;
  debounceMs?: number;
  onChange(pluginId: string, changes: ChangeRecord[]): void;
}

export async function watchPluginFiles(options: PluginFileWatcherOptions): Promise<Dispose> {
  const { root, pluginId, debounceMs = 150, onChange } = options;
  const pluginRoot = [root, pluginId].filter(Boolean).join('/');

  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: ChangeRecord[] = [];

  const flush = () => {
    if (!pending.length) return;
    const batch = pending;
    pending = [];
    onChange(pluginId, batch);
  };

  const scheduleFlush = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      flush();
    }, debounceMs);
  };

  const cleanup = await watchDirectory(
    pluginRoot,
    (changes) => {
      const filtered = changes.filter((change) => {
        const path = change.path.join("/");
        return !IGNORED_FILES.some((pattern) => pattern.test(path));
      });

      if (!filtered.length) return;
      pending.push(...filtered);
      scheduleFlush();
    },
    { recursive: true, emitInitial: false },
  );

  return () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    void cleanup();
  };
}

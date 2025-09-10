import {
  getDirectoryHandle,
  listCommits,
  watchDirectory,
  type DirectoryWatcherCleanup,
  type CommitEntry,
  type GitContext,
} from "@pstdio/opfs-utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface UseCommitHistoryOptions {
  limit?: number;
  ref?: string;
  /**
   * Optional OPFS path to the repository root.
   * When provided, we watch `.git` under this directory for changes and refresh the log.
   * If omitted or watch is unsupported, we fall back to polling.
   */
  watchRepoPath?: string;
  /** Polling interval in ms (used as a fallback or alongside watch). Default: 2000 */
  pollMs?: number;
}

export function useCommitHistory(ctx: GitContext | null | undefined, options: UseCommitHistoryOptions = {}) {
  const { limit = 20, ref, pollMs = 2000, watchRepoPath } = options;

  const [commits, setCommits] = useState<CommitEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const ctxMemo = useMemo(() => ctx, [ctx]);
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    if (!ctxMemo || busyRef.current) return;
    busyRef.current = true;
    setLoading(true);
    try {
      const list = await listCommits(ctxMemo, { limit, ref });
      setCommits(list);
      setError(undefined);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
      busyRef.current = false;
    }
  }, [ctxMemo, limit, ref]);

  useEffect(() => {
    let stopWatch: DirectoryWatcherCleanup | null = null;
    let timer: any = null;
    let cancelled = false;

    const startWatch = async () => {
      if (!watchRepoPath) return;
      try {
        const repoDir = await getDirectoryHandle(watchRepoPath);
        // Only observe the .git subtree to reduce noise.
        stopWatch = await watchDirectory(
          repoDir,
          () => {
            if (!cancelled) load();
          },
          {
            recursive: true,
            ignore: (path) => path[0] !== ".git",
          },
        );
      } catch {
        // Ignore watcher failures (not available or path missing); polling covers us.
        stopWatch = null;
      }
    };

    const startPolling = () => {
      timer = setInterval(() => load(), pollMs);
    };

    load();
    startWatch();
    startPolling();

    return () => {
      cancelled = true;
      stopWatch?.();
      if (timer) clearInterval(timer);
    };
  }, [watchRepoPath, pollMs, load]);

  return { commits, loading, error, refresh: load } as const;
}

import {
  listAllCommits,
  listCommits,
  watchDirectory,
  type CommitEntry,
  type DirectoryWatcherCleanup,
  type GitContext,
} from "@pstdio/opfs-utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface UseCommitHistoryOptions {
  limit?: number;
  ref?: string;
  /** When true, list commits across all branches (and tags). Default: false */
  acrossAll?: boolean;
  /** Per-ref traversal depth when using `acrossAll`. Default: 200 */
  perRefDepth?: number;
  /** Include tags when using `acrossAll`. Default: true */
  includeTags?: boolean;
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
  const { limit = 20, ref, acrossAll = false, perRefDepth, includeTags, pollMs = 2000, watchRepoPath } = options;

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
      const rows = acrossAll
        ? await listAllCommits(ctxMemo, { limit, perRefDepth, includeTags })
        : await listCommits(ctxMemo, { limit, ref });

      setCommits(rows as CommitEntry[]);
      setError(undefined);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
      busyRef.current = false;
    }
  }, [ctxMemo, limit, ref, acrossAll, perRefDepth, includeTags]);

  useEffect(() => {
    let stopWatch: DirectoryWatcherCleanup | null = null;
    let timer: any = null;
    let cancelled = false;

    const startWatch = async () => {
      if (!watchRepoPath) return;
      try {
        // Only observe the .git subtree to reduce noise.
        stopWatch = await watchDirectory(
          watchRepoPath,
          () => {
            if (!cancelled) load();
          },
          {
            recursive: true,
            ignore: (path) => path[0] !== ".git",
          },
        );
      } catch {
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

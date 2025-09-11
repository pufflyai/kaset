import { TimelineFromJSON, type TimelineDoc, type TitleSegment } from "@/components/ui/timeline";
import { PROJECTS_ROOT } from "@/constant";
import { useWorkspaceStore } from "@/state/WorkspaceProvider";
import { Box, Stack, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ensureRepo, listCommits, type CommitEntry, type GitContext, ensureDirExists } from "@pstdio/opfs-utils";

function toAbs(path: string) {
  const clean = path.replace(/\\/g, "/").replace(/^\/+/, "");
  return "/" + clean;
}

export function CommitHistory() {
  const selectedProject = useWorkspaceStore((s) => s.selectedProjectId || "todo");

  const rootDirRel = `${PROJECTS_ROOT}/${selectedProject}`;
  const repoDir = useMemo(() => toAbs(rootDirRel), [rootDirRel]);

  const [commits, setCommits] = useState<CommitEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ctx: GitContext = useMemo(() => ({ dir: repoDir }), [repoDir]);

  const loadCommits = useCallback(async () => {
    try {
      setError(null);

      // Ensure the project directory exists and repo is initialized (main by default)
      await ensureDirExists(repoDir, true);
      await ensureRepo(ctx);

      // Prefer commits on 'main'. If missing/unborn, try HEAD; if still missing, treat as empty.
      let list: CommitEntry[] | null = null;
      try {
        list = await listCommits(ctx, { limit: 50, ref: "main" });
      } catch (eMain: any) {
        try {
          list = await listCommits(ctx, { limit: 50 });
        } catch (eHead: any) {
          const msg = (eHead?.message || String(eHead)).toLowerCase();
          const isNotFound =
            eHead?.name === "NotFoundError" ||
            msg.includes("could not find") ||
            msg.includes("head") ||
            msg.includes("ref");
          if (isNotFound) {
            list = [];
          } else {
            throw eHead;
          }
        }
      }

      setCommits(list || []);
    } catch (e: any) {
      // Log to console but keep UI friendly
      console.log("Failed to load commit history:", e);
      setError(e?.message || String(e));
      setCommits([]);
    }
  }, [ctx, repoDir]);

  useEffect(() => {
    void loadCommits();
  }, [loadCommits]);

  const data: TimelineDoc = useMemo(() => {
    const items = (commits || []).map((c) => {
      const when = c.isoDate ? new Date(c.isoDate).toLocaleString() : "";
      const title: TitleSegment[] = [{ kind: "text", text: (c.message || "").split(/\r?\n/)[0] ?? "", bold: true }];
      const meta: string[] = [];
      if (c.author) meta.push(c.author);
      if (when) meta.push(when);
      title.push({ kind: "text", text: meta.length ? ` — ${meta.join(" • ")}` : "", muted: true });

      // No blocks by default; this keeps the list compact. Could add details later.
      return {
        id: c.oid,
        indicator: { type: "icon", icon: "file" } as const,
        title,
      };
    });
    return { items };
  }, [commits]);

  const onOpenFile = (filePath: string) => {
    const rootDir = rootDirRel;
    const path = filePath?.startsWith(rootDir) ? filePath : `${rootDir}/${filePath}`;

    useWorkspaceStore.setState(
      (state) => {
        state.filePath = path;
        state.selectedTab = "code";
      },
      false,
      "commit-history/open-file",
    );
  };

  const isEmpty = (commits && commits.length === 0) || (!commits && !error);

  return (
    <Stack gap="sm" height="100%">
      <Box flex="1" overflowY="auto">
        {error ? (
          <Box padding="sm">
            <Text color="fg.secondary">{error}</Text>
          </Box>
        ) : commits == null ? (
          <Box padding="sm">
            <Text color="fg.secondary">Loading commit history…</Text>
          </Box>
        ) : isEmpty ? (
          <Box padding="sm">
            <Text color="fg.secondary">No commits on main yet. Make a commit to see history.</Text>
          </Box>
        ) : (
          <TimelineFromJSON data={data} onOpenFile={onOpenFile} />
        )}
      </Box>
    </Stack>
  );
}

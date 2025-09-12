import { PROJECTS_ROOT } from "@/constant";
import { useWorkspaceStore } from "@/state/WorkspaceProvider";
import { Box, Button, CloseButton, Dialog, HStack, Stack, Text } from "@chakra-ui/react";
import {
  ensureDirExists,
  ensureRepo,
  getRepoStatus,
  getHeadState,
  listAllCommits,
  previewCommit,
  resolveOid,
  commitAll,
  continueFromCommit,
  type CommitEntry,
  type GitContext,
} from "@pstdio/opfs-utils";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [currentOid, setCurrentOid] = useState<string | null>(null);
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingCheckoutOid, setPendingCheckoutOid] = useState<string | null>(null);

  const ctx: GitContext = useMemo(() => ({ dir: repoDir }), [repoDir]);

  const loadCommits = useCallback(async () => {
    try {
      setError(null);

      // Ensure the project directory exists and repo is initialized (main by default)
      await ensureDirExists(repoDir, true);
      await ensureRepo(ctx);

      const [list, headOid] = await Promise.all([
        listAllCommits(ctx, { perRefDepth: 200, includeTags: true, limit: 200 }),
        resolveOid(ctx, "HEAD").catch(() => null),
      ]);

      setCommits(list as unknown as CommitEntry[]);
      setCurrentOid(headOid);
    } catch (e: any) {
      console.log("Failed to load commit history:", e);
      setError(e?.message || String(e));
      setCommits([]);
    }
  }, [ctx, repoDir]);

  useEffect(() => {
    void loadCommits();
  }, [loadCommits]);

  const proceedCheckout = useCallback(
    async (oid: string) => {
      try {
        setCheckingOut(oid);
        await ensureDirExists(repoDir, true);
        await ensureRepo(ctx);
        await previewCommit(ctx, oid);
        await loadCommits();
      } catch (e: any) {
        console.log("Checkout failed:", e);
        setError(e?.message || String(e));
      } finally {
        setCheckingOut(null);
      }
    },
    [ctx, repoDir, loadCommits],
  );

  const onCheckoutCommit = useCallback(
    async (oid: string) => {
      try {
        setError(null);
        await ensureDirExists(repoDir, true);
        await ensureRepo(ctx);

        const s = await getRepoStatus(ctx);
        const hasChanges =
          s.added.length > 0 || s.modified.length > 0 || s.deleted.length > 0 || s.untracked.length > 0;

        if (hasChanges) {
          setPendingCheckoutOid(oid);
          setSavePromptOpen(true);
          return;
        }

        await proceedCheckout(oid);
      } catch (e: any) {
        console.log("Pre-checkout failed:", e);
        setError(e?.message || String(e));
      }
    },
    [ctx, repoDir, proceedCheckout],
  );

  const confirmSaveThenCheckout = useCallback(async () => {
    if (!pendingCheckoutOid) return;
    setSaving(true);
    try {
      // Ensure repo exists
      await ensureDirExists(repoDir, true);
      await ensureRepo(ctx);

      // Capture head state once; if detached, commit first to avoid discarding changes
      const head = await getHeadState(ctx);

      let targetBranch: string | undefined = undefined;
      if (!head.detached && head.currentBranch) targetBranch = head.currentBranch;

      // Commit current changes
      const res = await commitAll(ctx, {
        message: "chore: User updates",
        author: { name: "user", email: "user@kaset.dev" },
        ...(targetBranch ? { branch: targetBranch } : {}),
      });

      // If we were detached, attach to a continuation branch at the new commit without losing changes
      if (head.detached && res.oid) {
        const base = head.headOid || (await resolveOid(ctx, "HEAD"));
        const contBranch = `continue/${String(base).slice(0, 7)}`;
        await continueFromCommit(ctx, { to: res.oid, branch: contBranch, force: true, refuseUpdateExisting: false });
      }

      await proceedCheckout(pendingCheckoutOid);
    } catch (e: any) {
      console.log("Save changes failed:", e);
      setError(e?.message || String(e));
    } finally {
      setSaving(false);
      setSavePromptOpen(false);
      setPendingCheckoutOid(null);
    }
  }, [ctx, repoDir, pendingCheckoutOid, proceedCheckout]);

  const items = useMemo(() => commits || [], [commits]);

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
          <Stack>
            {items.map((c) => {
              const when = c.isoDate ? new Date(c.isoDate).toLocaleString() : "";
              const title = (c.message || "").split(/\r?\n/)[0] ?? "";
              const meta: string[] = [];

              if (c.author) meta.push(c.author);
              if (when) meta.push(when);

              const isCurrent = currentOid === c.oid;

              return (
                <Box
                  key={c.oid}
                  role="button"
                  tabIndex={0}
                  cursor={checkingOut ? "progress" : "pointer"}
                  borderWidth="1px"
                  borderColor={isCurrent ? "border.secondary" : "transparent"}
                  rounded="md"
                  padding="sm"
                  _hover={{ background: "background.secondary" }}
                  onClick={() => (checkingOut ? null : onCheckoutCommit(c.oid))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onCheckoutCommit(c.oid);
                  }}
                >
                  <Text fontWeight="medium">{title}</Text>
                  <HStack gap="xs" align="center" mt="1">
                    <Text color="fg.secondary">{meta.length ? `— ${meta.join(" • ")}` : ""}</Text>
                    {isCurrent ? <Text color="foreground.primary">• Current</Text> : null}
                  </HStack>
                </Box>
              );
            })}
          </Stack>
        )}
      </Box>

      {/* Save changes modal */}
      <Dialog.Root open={savePromptOpen} onOpenChange={(e) => setSavePromptOpen(e.open)}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Text textStyle="heading/M">Save changes</Text>
              <Dialog.CloseTrigger>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body>
              <Text color="fg.secondary">You have unsaved changes. Create a new version before switching?</Text>
            </Dialog.Body>
            <Dialog.Footer>
              <HStack gap="xs">
                <Button
                  onClick={() => {
                    if (saving) return;
                    const oid = pendingCheckoutOid;
                    setSavePromptOpen(false);
                    setPendingCheckoutOid(null);
                    if (oid) void proceedCheckout(oid);
                  }}
                  disabled={saving}
                >
                  Don't save
                </Button>
                <Button onClick={confirmSaveThenCheckout} loading={saving} variant="solid">
                  Save changes
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Stack>
  );
}

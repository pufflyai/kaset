import { useCallback, useEffect, useState } from "react";

import {
  ensureRepoReady,
  fetchCommitList,
  hasUncommittedChanges,
  previewCommitOid,
  saveAllChanges,
  type CommitEntry,
} from "@/services/git/history";

interface UseCommitHistoryResult {
  commits: CommitEntry[] | null;
  error: string | null;
  checkingOut: string | null;
  currentOid: string | null;
  savePromptOpen: boolean;
  saving: boolean;

  setSavePromptOpen: (open: boolean) => void;

  onCheckoutCommit: (oid: string) => Promise<void>;
  confirmSaveThenCheckout: () => Promise<void>;
  skipSaveAndCheckout: () => Promise<void>;
}

export function useCommitHistory(repoDir: string): UseCommitHistoryResult {
  const [commits, setCommits] = useState<CommitEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [currentOid, setCurrentOid] = useState<string | null>(null);
  const [savePromptOpen, setSavePromptOpenState] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingCheckoutOid, setPendingCheckoutOid] = useState<string | null>(null);

  const setSavePromptOpen = (open: boolean) => setSavePromptOpenState(open);

  const loadCommits = useCallback(async () => {
    try {
      setError(null);

      const ctx = await ensureRepoReady(repoDir);
      const { commits, headOid } = await fetchCommitList(ctx);

      setCommits(commits);
      setCurrentOid(headOid);
    } catch (e: any) {
      console.log("Failed to load commit history:", e);
      setError(e?.message || String(e));
      setCommits([]);
    }
  }, [repoDir]);

  useEffect(() => {
    void loadCommits();
  }, [loadCommits]);

  const proceedCheckout = useCallback(
    async (oid: string) => {
      try {
        setCheckingOut(oid);

        const ctx = await ensureRepoReady(repoDir);
        await previewCommitOid(ctx, oid);

        await loadCommits();
      } catch (e: any) {
        console.log("Checkout failed:", e);
        setError(e?.message || String(e));
      } finally {
        setCheckingOut(null);
      }
    },
    [repoDir, loadCommits],
  );

  const onCheckoutCommit = useCallback(
    async (oid: string) => {
      try {
        setError(null);

        const ctx = await ensureRepoReady(repoDir);
        const hasChanges = await hasUncommittedChanges(ctx);

        if (hasChanges) {
          setPendingCheckoutOid(oid);
          setSavePromptOpenState(true);
          return;
        }

        await proceedCheckout(oid);
      } catch (e: any) {
        console.log("Pre-checkout failed:", e);
        setError(e?.message || String(e));
      }
    },
    [repoDir, proceedCheckout],
  );

  const confirmSaveThenCheckout = useCallback(async () => {
    if (!pendingCheckoutOid) return;

    setSaving(true);
    try {
      const ctx = await ensureRepoReady(repoDir);

      await saveAllChanges(ctx);
      await proceedCheckout(pendingCheckoutOid);
    } catch (e: any) {
      console.log("Save changes failed:", e);
      setError(e?.message || String(e));
    } finally {
      setSaving(false);
      setSavePromptOpenState(false);
      setPendingCheckoutOid(null);
    }
  }, [repoDir, pendingCheckoutOid, proceedCheckout]);

  const skipSaveAndCheckout = useCallback(async () => {
    if (saving) return;

    const oid = pendingCheckoutOid;
    setSavePromptOpenState(false);
    setPendingCheckoutOid(null);

    if (oid) await proceedCheckout(oid);
  }, [saving, pendingCheckoutOid, proceedCheckout]);

  return {
    commits,
    error,
    checkingOut,
    currentOid,
    savePromptOpen,
    saving,
    setSavePromptOpen,
    onCheckoutCommit,
    confirmSaveThenCheckout,
    skipSaveAndCheckout,
  };
}

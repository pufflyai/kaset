import { useCallback, useEffect, useMemo, useState } from "react";
import { getFs } from "../../src/adapter/fs";
import {
  commitAll,
  ensureRepo,
  getRepoStatus,
  listCommits,
  revertToCommit,
  checkoutAtCommit,
  getHeadState,
  attachHeadToBranch,
  type CommitEntry,
  type GitContext,
} from "../../src/git/git";
import { getDirHandle } from "../helpers";
import { Button, Label, MonoBlock, Row, Section, TextArea, TextInput } from "./ui";

function short(oid: string, n = 7) {
  return oid?.slice(0, n) || "";
}

export function GitPanel({ baseDir, onStatus }: { baseDir: string; onStatus: (s: string) => void }) {
  const [dirPath, setDirPath] = useState<string | null>(null);
  const [ctx, setCtx] = useState<GitContext | null>(null);

  const [authorName, setAuthorName] = useState("Playground User");
  const [authorEmail, setAuthorEmail] = useState("playground@example.com");
  const [message, setMessage] = useState("chore: playground commit");

  const [statusText, setStatusText] = useState<string>("");
  const [stagedText, setStagedText] = useState<string>("");
  const [commits, setCommits] = useState<CommitEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revertRef, setRevertRef] = useState<string>("HEAD~1");
  const [pathsInput, setPathsInput] = useState<string>("");
  const [headDetached, setHeadDetached] = useState<boolean>(false);
  const [headBranch, setHeadBranch] = useState<string>("");
  const [headShort, setHeadShort] = useState<string>("");
  const [attachBranch, setAttachBranch] = useState<string>("main");

  const refreshHead = useCallback(async () => {
    if (!ctx) return;
    try {
      const h = await getHeadState(ctx);
      setHeadDetached(Boolean(h.detached));
      setHeadBranch(h.currentBranch || "");
      setHeadShort(h.headOid ? short(h.headOid) : "");
    } catch {
      // ignore
    }
  }, [ctx]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const fs = await getFs();
        const dir = await getDirHandle(baseDir, true);

        if (cancelled) return;
        setDirPath(dir);
        setCtx({ dir });
        setError(null);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [baseDir]);

  const ensure = useCallback(async () => {
    if (!ctx) return;
    setLoading(true);
    try {
      const info = await ensureRepo(ctx, { name: authorName, email: authorEmail });
      const branch = info.currentBranch || "main";
      onStatus(`Git repo ready at ${dirPath} (branch: ${branch}).`);
      setStatusText(`Repo ${info.created ? "initialized" : "found"}. Branch: ${branch}.`);
      setError(null);
      await refreshHead();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [ctx, authorName, authorEmail, dirPath, onStatus, refreshHead]);

  const doCommitAll = useCallback(async () => {
    if (!ctx) return;
    setLoading(true);
    try {
      const res = await commitAll(ctx, {
        message: message.trim(),
        author: { name: authorName.trim(), email: authorEmail.trim() },
      });

      setStatusText(res.summary);
      onStatus(res.summary);
      setError(null);

      // Refresh commits after commit
      const list = await listCommits(ctx, { limit: 30 });
      setCommits(list);

      // Refresh staged view so it doesn't show outdated entries
      const s = await getRepoStatus(ctx);
      const rows: string[] = [];
      const stagedAdded = (s as any).stagedAdded as string[] | undefined;
      const stagedModified = (s as any).stagedModified as string[] | undefined;
      const stagedDeleted = (s as any).stagedDeleted as string[] | undefined;

      if (stagedAdded?.length) for (const p of stagedAdded) rows.push(`A ${p}`);
      if (stagedModified?.length) for (const p of stagedModified) rows.push(`M ${p}`);
      if (stagedDeleted?.length) for (const p of stagedDeleted) rows.push(`D ${p}`);

      setStagedText(rows.length ? rows.join("\n") : "<nothing staged>");
      await refreshHead();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [ctx, message, authorName, authorEmail, onStatus, refreshHead]);

  const refreshCommits = useCallback(async () => {
    if (!ctx) return;
    setLoading(true);
    try {
      // Ensure repo exists so listCommits succeeds
      await ensureRepo(ctx);
      const list = await listCommits(ctx, { limit: 50 });
      setCommits(list);
      setError(null);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [ctx]);

  const refreshStatus = useCallback(async () => {
    if (!ctx) return;
    setLoading(true);
    try {
      await ensureRepo(ctx);
      const s = await getRepoStatus(ctx);
      const parts = [
        s.added.length ? `added: ${s.added.length}` : "",
        s.modified.length ? `modified: ${s.modified.length}` : "",
        s.deleted.length ? `deleted: ${s.deleted.length}` : "",
        s.untracked.length ? `untracked: ${s.untracked.length}` : "",
      ].filter(Boolean);
      const line = parts.length ? `Status — ${parts.join(", ")}` : "Status — clean";
      setStatusText(line);
      onStatus(line);

      // Compose a per-file staged list for visibility
      const rows: string[] = [];
      const stagedAdded = (s as any).stagedAdded as string[] | undefined;
      const stagedModified = (s as any).stagedModified as string[] | undefined;
      const stagedDeleted = (s as any).stagedDeleted as string[] | undefined;

      if (stagedAdded?.length) for (const p of stagedAdded) rows.push(`A ${p}`);
      if (stagedModified?.length) for (const p of stagedModified) rows.push(`M ${p}`);
      if (stagedDeleted?.length) for (const p of stagedDeleted) rows.push(`D ${p}`);

      setStagedText(rows.length ? rows.join("\n") : "<nothing staged>");
      setError(null);
      await refreshHead();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [ctx, onStatus, refreshHead]);

  const doRevert = useCallback(
    async (mode: "hard" | "detached") => {
      if (!ctx) return;
      const to = (revertRef || "").trim() || "HEAD";
      setLoading(true);
      try {
        const res = await revertToCommit(ctx, { to, mode, force: true });

        setStatusText(res.summary);
        onStatus(res.summary);
        setError(null);

        // Refresh commits after revert
        const list = await listCommits(ctx, { limit: 50 });
        setCommits(list);

        // Refresh staged/working status view
        const s = await getRepoStatus(ctx);
        const rows: string[] = [];
        const stagedAdded = (s as any).stagedAdded as string[] | undefined;
        const stagedModified = (s as any).stagedModified as string[] | undefined;
        const stagedDeleted = (s as any).stagedDeleted as string[] | undefined;
        if (stagedAdded?.length) for (const p of stagedAdded) rows.push(`A ${p}`);
        if (stagedModified?.length) for (const p of stagedModified) rows.push(`M ${p}`);
        if (stagedDeleted?.length) for (const p of stagedDeleted) rows.push(`D ${p}`);
        setStagedText(rows.length ? rows.join("\n") : "<nothing staged>");
        await refreshHead();
      } catch (e: any) {
        setError(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    },
    [ctx, revertRef, onStatus, refreshHead],
  );

  const doCheckoutFromCommit = useCallback(async () => {
    if (!ctx) return;
    const at = (revertRef || "").trim() || "HEAD";
    const paths = pathsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    setLoading(true);
    try {
      const res = await checkoutAtCommit(ctx, { at, paths: paths.length ? paths : undefined, force: true });
      setStatusText(res.summary);
      onStatus(res.summary);

      // Refresh status & staged changes
      const s = await getRepoStatus(ctx);
      const rows: string[] = [];
      const stagedAdded = (s as any).stagedAdded as string[] | undefined;
      const stagedModified = (s as any).stagedModified as string[] | undefined;
      const stagedDeleted = (s as any).stagedDeleted as string[] | undefined;
      if (stagedAdded?.length) for (const p of stagedAdded) rows.push(`A ${p}`);
      if (stagedModified?.length) for (const p of stagedModified) rows.push(`M ${p}`);
      if (stagedDeleted?.length) for (const p of stagedDeleted) rows.push(`D ${p}`);
      setStagedText(rows.length ? rows.join("\n") : "<nothing staged>");
      await refreshHead();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [ctx, revertRef, pathsInput, onStatus, refreshHead]);

  const doAttachHead = useCallback(async () => {
    if (!ctx) return;
    const branch = (attachBranch || "").trim();
    if (!branch) return;
    setLoading(true);
    try {
      const res = await attachHeadToBranch(ctx, branch, { createIfMissing: true, force: true });
      setStatusText(res.summary);
      onStatus(res.summary);
      await refreshHead();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [ctx, attachBranch, onStatus, refreshHead]);

  const commitsDisplay = useMemo(() => {
    if (!commits?.length) return "<no commits>";
    const rows = commits.map((c) => {
      const firstLine = (c.message || "").split(/\r?\n/)[0] ?? "";
      const date = c.isoDate ? new Date(c.isoDate).toLocaleString() : "";
      const who = c.author ? ` — ${c.author}` : "";
      return `${short(c.oid)} ${firstLine}${who}${date ? ` (${date})` : ""}`;
    });
    return rows.join("\n");
  }, [commits]);

  return (
    <Section title="Git">
      <div style={{ color: "#6b7280", marginBottom: 8 }}>Use isomorphic-git over OPFS to commit and view history.</div>

      <Row>
        <TextInput label="Repo directory" value={dirPath || ""} readOnly width={320} />
        <Button onClick={ensure} disabled={!ctx || loading}>
          Ensure repo
        </Button>
        <Button onClick={refreshStatus} disabled={!ctx || loading}>
          Check status
        </Button>
        <Button onClick={refreshCommits} disabled={!ctx || loading}>
          Refresh commits
        </Button>
      </Row>

      <div style={{ marginTop: 10 }}>
        <Row>
          <TextInput
            label="Author name"
            value={authorName}
            onChange={(e) => setAuthorName(e.currentTarget.value)}
            width={220}
          />
          <TextInput
            label="Author email"
            value={authorEmail}
            onChange={(e) => setAuthorEmail(e.currentTarget.value)}
            width={240}
          />
        </Row>
      </div>

      <div style={{ marginTop: 10 }}>
        <TextArea
          label="Commit message"
          value={message}
          onChange={(e) => setMessage(e.currentTarget.value)}
          height={80}
        />
      </div>

      <div style={{ marginTop: 8 }}>
        <Button onClick={doCommitAll} disabled={!ctx || loading}>
          Commit all changes
        </Button>
      </div>

      <div style={{ marginTop: 16 }}>
        <Row>
          <TextInput
            label="Revert to commit (ref/oid)"
            placeholder="e.g. HEAD~1 or 1a2b3c4"
            value={revertRef}
            onChange={(e) => setRevertRef(e.currentTarget.value)}
            width={280}
          />
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <Button onClick={() => doRevert("hard")} disabled={!ctx || loading}>
              Revert (hard)
            </Button>
            <Button onClick={() => doRevert("detached")} disabled={!ctx || loading}>
              Checkout (detached)
            </Button>
            <Button onClick={doCheckoutFromCommit} disabled={!ctx || loading}>
              Checkout from commit
            </Button>
          </div>
        </Row>
        <Row>
          <TextInput
            label="Paths (comma-separated, optional)"
            placeholder="e.g. src, README.md"
            value={pathsInput}
            onChange={(e) => setPathsInput(e.currentTarget.value)}
            width={320}
          />
        </Row>
      </div>

      <div style={{ marginTop: 16 }}>
        <Row>
          <TextInput
            label="Attach HEAD to branch"
            value={attachBranch}
            onChange={(e) => setAttachBranch(e.currentTarget.value)}
            width={220}
          />
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <Button onClick={doAttachHead} disabled={!ctx || loading}>
              Attach HEAD
            </Button>
          </div>
        </Row>
        <div style={{ marginTop: 6, color: "#374151" }}>
          HEAD:{" "}
          {headDetached ? (
            <span>
              detached{headShort ? ` @ ${headShort}` : ""}
              {headBranch ? ` (last branch: ${headBranch})` : ""}
            </span>
          ) : (
            <span>on {headBranch || "<unknown>"}</span>
          )}
        </div>
      </div>

      {statusText ? <div style={{ marginTop: 10, color: "#374151" }}>{statusText}</div> : null}

      <div style={{ marginTop: 8 }}>
        <Label>Staged changes</Label>
        <MonoBlock height={120}>{stagedText || "<nothing staged>"}</MonoBlock>
      </div>

      {error ? <div style={{ marginTop: 8, color: "#991b1b" }}>{error}</div> : null}

      <div style={{ marginTop: 10 }}>
        <MonoBlock height={180}>{commitsDisplay}</MonoBlock>
      </div>
    </Section>
  );
}

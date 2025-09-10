import { useCallback, useEffect, useMemo, useState } from "react";
import { getFs } from "../../src/adapter/fs";
import {
  commitAll,
  ensureRepo,
  getRepoStatus,
  listCommits,
  type CommitEntry,
  type GitContext,
} from "../../src/git/git";
import { getDirHandle } from "../helpers";
import { Button, MonoBlock, Row, Section, TextArea, TextInput } from "./ui";

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
  const [commits, setCommits] = useState<CommitEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [ctx, authorName, authorEmail, dirPath, onStatus]);

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
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [ctx, message, authorName, authorEmail, onStatus]);

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
      setError(null);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [ctx, onStatus]);

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

      {statusText ? <div style={{ marginTop: 10, color: "#374151" }}>{statusText}</div> : null}

      {error ? <div style={{ marginTop: 8, color: "#991b1b" }}>{error}</div> : null}

      <div style={{ marginTop: 10 }}>
        <MonoBlock height={180}>{commitsDisplay}</MonoBlock>
      </div>
    </Section>
  );
}

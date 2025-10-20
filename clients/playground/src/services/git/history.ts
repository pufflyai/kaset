import {
  commitAll,
  continueFromCommit,
  ensureDirExists,
  ensureRepo,
  getHeadState,
  getRepoStatus,
  listAllCommits,
  previewCommit,
  resolveOid,
  type CommitEntry,
  type GitContext,
} from "@pstdio/opfs-utils";

export type { CommitEntry, GitContext } from "@pstdio/opfs-utils";

export async function ensureRepoReady(repoDir: string) {
  const ctx: GitContext = { dir: repoDir };

  await ensureDirExists(repoDir, true);
  await ensureRepo(ctx);

  return ctx;
}

export async function fetchCommitList(ctx: GitContext) {
  const [list, headOid] = await Promise.all([
    listAllCommits(ctx, { perRefDepth: 200, includeTags: true, limit: 200 }),
    resolveOid(ctx, "HEAD").catch(() => null),
  ]);

  return {
    commits: list as CommitEntry[],
    headOid,
  };
}

export async function hasUncommittedChanges(ctx: GitContext) {
  const s = await getRepoStatus(ctx);

  const hasChanges = s.added.length > 0 || s.modified.length > 0 || s.deleted.length > 0 || s.untracked.length > 0;

  return hasChanges;
}

export async function previewCommitOid(ctx: GitContext, oid: string) {
  await previewCommit(ctx, oid);
}

interface SaveOptions {
  message?: string;
  author?: { name: string; email: string };
}

export async function saveAllChanges(ctx: GitContext, options: SaveOptions = {}) {
  const message = options.message || "chore: User updates";
  const author = options.author || { name: "user", email: "user@kaset.dev" };

  const head = await getHeadState(ctx);

  let targetBranch: string | undefined = undefined;
  if (!head.detached && head.currentBranch) targetBranch = head.currentBranch;

  const res = await commitAll(ctx, {
    message,
    author,
    ...(targetBranch ? { branch: targetBranch } : {}),
  });

  if (head.detached && res.oid) {
    const base = head.headOid || (await resolveOid(ctx, "HEAD"));
    const contBranch = `continue/${String(base).slice(0, 7)}`;

    await continueFromCommit(ctx, {
      to: res.oid,
      branch: contBranch,
      force: true,
      refuseUpdateExisting: false,
    });
  }

  return res;
}

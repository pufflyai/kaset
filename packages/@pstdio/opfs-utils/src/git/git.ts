import type { fs } from "@zenfs/core";
import type * as IsomorphicGit from "isomorphic-git";

export type GitContext = {
  git: typeof IsomorphicGit;
  fs: typeof fs;
  dir: string; // repo root path
};

export type EnsureRepoOptions = {
  /** Default branch to create if repo is initialized. Default: "main". */
  defaultBranch?: string;
  /** Optional user.name to store in config (useful in Node). */
  name?: string;
  /** Optional user.email to store in config (useful in Node). */
  email?: string;
};

export type CommitAuthor = { name: string; email: string };

export type CommitAllOptions = {
  /** Commit message (required). */
  message: string;
  /** Commit author (required). */
  author: CommitAuthor;
  /** Branch to commit to; defaults to current branch (or "main" if unset). */
  branch?: string;
  /** If true, don't actually write a commit; just return what would happen. */
  dryRun?: boolean;
};

export type CommitAllResult = {
  oid: string | null;
  added: string[];
  modified: string[];
  deleted: string[];
  summary: string;
  dryRun?: boolean;
};

export type RepoStatus = {
  added: string[];
  modified: string[];
  deleted: string[];
  untracked: string[];
};

export type ListCommitsOptions = {
  /** Max number of commits to return. Default: 20. */
  limit?: number;
  /** Branch/ref to read from. Default: current branch or "HEAD". */
  ref?: string;
};

export type CommitEntry = {
  oid: string;
  message: string;
  author?: string;
  email?: string;
  isoDate?: string;
  parents: string[];
};

/**
 * Ensure a repo exists; create it if needed. Sets user.name / user.email if provided.
 */
export async function ensureRepo(ctx: GitContext, opts: EnsureRepoOptions = {}) {
  const { git, fs, dir } = ctx;
  const defaultBranch = opts.defaultBranch ?? "main";

  let created = false;

  // Detect whether we're inside a git repo.
  // If resolveRef('HEAD') throws and currentBranch also fails, initialize.
  let current: string | void;
  try {
    current = await git.currentBranch({ fs, dir, fullname: false });
  } catch {
    current = undefined as unknown as void;
  }

  if (!current) {
    try {
      await git.resolveRef({ fs, dir, ref: "HEAD" });
      // We can resolve HEAD (repo exists) but currentBranch may still be null (e.g., unborn HEAD).
      current = await git.currentBranch({ fs, dir, fullname: false });
    } catch {
      await git.init({ fs, dir, defaultBranch });
      created = true;
      current = defaultBranch;
    }
  }

  if (opts.name) {
    try {
      await git.setConfig({ fs, dir, path: "user.name", value: opts.name });
    } catch {
      /* ignore config failures in restricted environments */
    }
  }

  if (opts.email) {
    try {
      await git.setConfig({ fs, dir, path: "user.email", value: opts.email });
    } catch {
      /* ignore config failures in restricted environments */
    }
  }

  const currentBranch = typeof current === "string" && current ? current : defaultBranch;
  return { created, currentBranch };
}

/**
 * Summarize the repo status using isomorphic-git's status matrix / status strings.
 * Groups files into added/modified/deleted/untracked for convenience.
 */
export async function getRepoStatus(ctx: GitContext) {
  const { git, fs, dir } = ctx;
  const matrix = await git.statusMatrix({ fs, dir });

  const added: string[] = [];
  const modified: string[] = [];
  const deleted: string[] = [];
  const untracked: string[] = [];

  // Interpret matrix rows: [filepath, HEAD, WORKDIR, STAGE]
  // - Untracked: HEAD=0, WORKDIR=2, STAGE=0
  // - Added (staged new): HEAD=0, STAGE in {2,3}
  // - Modified (relative to HEAD): WORKDIR=2 and HEAD=1
  // - Deleted (in working dir): HEAD=1, WORKDIR=0
  for (const row of matrix) {
    const [filepath, head, workdir, stage] = row as unknown as [string, 0 | 1, 0 | 1 | 2, 0 | 1 | 2 | 3];

    if (head === 0 && workdir === 2 && stage === 0) {
      untracked.push(filepath);
      continue;
    }

    if (head === 0 && (stage === 2 || stage === 3)) {
      added.push(filepath);
      continue;
    }

    if (head === 1 && workdir === 2) {
      modified.push(filepath);
      continue;
    }

    if (head === 1 && workdir === 0) {
      deleted.push(filepath);
      continue;
    }
  }

  return { added, modified, deleted, untracked };
}

/**
 * Stage all working-tree changes (added/modified/untracked & deletions) and commit.
 * Does nothing and returns oid=null when there are no changes.
 */
export async function commitAll(ctx: GitContext, options: CommitAllOptions): Promise<CommitAllResult> {
  const { git, fs, dir } = ctx;
  const { message, author, branch, dryRun } = options;

  if (!message?.trim()) {
    throw new Error("commitAll: commit message is required");
  }
  if (!author?.name || !author?.email) {
    throw new Error("commitAll: author { name, email } is required");
  }

  const ensured = await ensureRepo(ctx);
  const targetRef = branch ?? ensured.currentBranch ?? "main";

  const status = await getRepoStatus(ctx);
  const toAdd = [...status.added, ...status.modified, ...status.untracked];
  const toRemove = [...status.deleted];

  for (const f of toAdd) {
    if (dryRun) continue;
    await git.add({ fs, dir, filepath: f });
  }
  for (const f of toRemove) {
    if (dryRun) continue;
    await git.remove({ fs, dir, filepath: f });
  }

  if (toAdd.length === 0 && toRemove.length === 0) {
    return {
      oid: null,
      added: [],
      modified: [],
      deleted: [],
      summary: "No changes to commit.",
      dryRun,
    };
  }

  let oid: string | null = null;
  if (!dryRun) {
    oid = await git.commit({
      fs,
      dir,
      ref: targetRef, // commit to the single branch
      message,
      author,
      committer: author,
    });
  }

  const summary =
    (dryRun ? "[dry-run] " : "") +
    `Committed ${toAdd.length + toRemove.length} change(s)` +
    (toAdd.length ? ` (+${toAdd.length})` : "") +
    (toRemove.length ? ` (-${toRemove.length})` : "") +
    `.`;

  return { oid, added: toAdd, modified: status.modified, deleted: toRemove, summary, dryRun };
}

/**
 * Retrieve a compact list of recent commits from the given ref (default: current branch / HEAD).
 */
export async function listCommits(ctx: GitContext, opts: ListCommitsOptions = {}) {
  const { git, fs, dir } = ctx;
  const { limit = 20 } = opts;

  let ref = opts.ref;
  if (!ref) {
    ref = (await git.currentBranch({ fs, dir, fullname: false })) ?? "HEAD";
  }

  const entries = await git.log({ fs, dir, ref, depth: limit });
  return entries.map((e: any) => {
    const c = e.commit || {};
    const a = c.author || {};
    const co = c.committer || {};
    const ts = typeof co.timestamp === "number" ? new Date(co.timestamp * 1000).toISOString() : undefined;
    return {
      oid: e.oid,
      message: String(c.message || "").trim(),
      author: a.name,
      email: a.email,
      isoDate: ts,
      parents: Array.isArray(e.parents) ? e.parents : [],
    };
  });
}

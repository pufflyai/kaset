import * as isogit from "isomorphic-git";
import { getFs } from "../adapter/fs";

export type GitContext = {
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
  // Summary buckets (back-compat): may include both staged & unstaged
  added: string[];
  modified: string[];
  deleted: string[];
  untracked: string[];

  // Detailed buckets for staged/unstaged visibility
  stagedAdded?: string[];
  stagedModified?: string[];
  stagedDeleted?: string[];
  unstagedModified?: string[];
  unstagedDeleted?: string[];
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

export type RevertToCommitOptions = {
  /** Commit SHA (full or abbreviated) or ref name (e.g., 'main', 'HEAD~1'). */
  to: string;
  /**
   * How to move to the commit.
   * - 'hard' (default): move current branch to the commit and update workdir.
   * - 'detached': detach HEAD at the commit and update workdir.
   */
  mode?: "hard" | "detached";
  /** Overwrite local changes in the working directory. Default: true. */
  force?: boolean;
};

export type RevertToCommitResult = {
  oid: string;
  branch?: string;
  detached: boolean;
  summary: string;
};

export type CheckoutAtCommitOptions = {
  /** Commit SHA (full or abbreviated) or ref name to checkout from. */
  at: string;
  /** Optional list of paths to restore. If omitted, restores the entire working tree. */
  paths?: string[];
  /** Overwrite local changes in the working directory. Default: true. */
  force?: boolean;
};

export type CheckoutAtCommitResult = {
  oid: string;
  paths?: string[];
  summary: string;
};

export type HeadState = {
  currentBranch?: string;
  detached: boolean;
  headOid?: string;
};

export type AttachHeadOptions = {
  /** Create the branch pointing to current HEAD if it doesn't exist. Default: true. */
  createIfMissing?: boolean;
  /** Force checkout/overwrite local changes. Default: true. */
  force?: boolean;
};

/** Resolve any ref/abbrev SHA to a full OID. */
export async function resolveOid(ctx: GitContext, refOrSha: string): Promise<string> {
  const { dir } = ctx;
  const fs = await getFs();

  const s = String(refOrSha || "").trim();
  if (!s) throw new Error("resolveOid: ref/sha is required");

  try {
    return await isogit.resolveRef({ fs, dir, ref: s });
  } catch {
    const shaLike = /^[0-9a-fA-F]{4,40}$/.test(s);
    if (!shaLike) throw new Error(`resolveOid: cannot resolve ref '${refOrSha}'`);

    return s.length === 40 ? s : await isogit.expandOid({ fs, dir, oid: s });
  }
}

/**
 * Ensure a repo exists; create it if needed. Sets user.name / user.email if provided.
 */
export async function ensureRepo(ctx: GitContext, opts: EnsureRepoOptions = {}) {
  const { dir } = ctx;
  const defaultBranch = opts.defaultBranch ?? "main";
  const fs = await getFs();

  let created = false;

  // Detect whether we're inside a git repo.
  // If resolveRef('HEAD') throws and currentBranch also fails, initialize.
  let current: string | void;
  try {
    current = await isogit.currentBranch({ fs, dir, fullname: false });
  } catch {
    current = undefined as unknown as void;
  }

  if (!current) {
    try {
      await isogit.resolveRef({ fs, dir, ref: "HEAD" });
      // We can resolve HEAD (repo exists) but currentBranch may still be null (e.g., unborn HEAD).
      current = await isogit.currentBranch({ fs, dir, fullname: false });
    } catch {
      await isogit.init({ fs, dir, defaultBranch });
      created = true;
      current = defaultBranch;
    }
  }

  if (opts.name) {
    try {
      await isogit.setConfig({ fs, dir, path: "user.name", value: opts.name });
    } catch {
      /* ignore config failures in restricted environments */
    }
  }

  if (opts.email) {
    try {
      await isogit.setConfig({ fs, dir, path: "user.email", value: opts.email });
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
  const { dir } = ctx;

  const fs = await getFs();
  const matrix = await isogit.statusMatrix({ fs, dir });

  const added: string[] = [];
  const modified: string[] = [];
  const deleted: string[] = [];
  const untracked: string[] = [];

  const stagedAdded: string[] = [];
  const stagedModified: string[] = [];
  const stagedDeleted: string[] = [];
  const unstagedModified: string[] = [];
  const unstagedDeleted: string[] = [];

  // Interpret matrix rows: [filepath, HEAD, WORKDIR, STAGE]
  // - Untracked: HEAD=0, WORKDIR=2, STAGE=0
  // - Added (staged new): HEAD=0, STAGE in {2,3}
  // - Modified (relative to HEAD): WORKDIR=2 and HEAD=1
  // - Deleted (in working dir): HEAD=1, WORKDIR=0
  for (const row of matrix) {
    const [filepath, head, workdir, stage] = row as unknown as [string, 0 | 1, 0 | 1 | 2, 0 | 1 | 2 | 3];

    // Untracked: HEAD=0, WORKDIR=2, STAGE=0
    if (head === 0 && workdir === 2 && stage === 0) {
      untracked.push(filepath);
      continue;
    }

    // Staged additions: HEAD=0 and STAGE in {2,3}
    if (head === 0 && (stage === 2 || stage === 3)) {
      added.push(filepath);
      stagedAdded.push(filepath);
      continue;
    }

    // Modified (summary): any WORKDIR change over HEAD=1
    if (head === 1 && workdir === 2) {
      modified.push(filepath);

      // Staged vs unstaged modification distinction
      if (stage === 2) {
        stagedModified.push(filepath);
      } else if (stage === 1) {
        // Index matches HEAD, but working tree changed → unstaged
        unstagedModified.push(filepath);
      }

      continue;
    }

    // Deleted (summary): file missing in working dir compared to HEAD
    if (head === 1 && workdir === 0) {
      deleted.push(filepath);

      // Staged deletion: index no longer has the file
      if (stage === 0) {
        stagedDeleted.push(filepath);
      } else if (stage === 1) {
        // Index still has file → deletion not staged
        unstagedDeleted.push(filepath);
      }

      continue;
    }
  }

  return {
    added,
    modified,
    deleted,
    untracked,
    stagedAdded,
    stagedModified,
    stagedDeleted,
    unstagedModified,
    unstagedDeleted,
  };
}

/**
 * Stage all working-tree changes (added/modified/untracked & deletions) and commit.
 * Does nothing and returns oid=null when there are no changes.
 */
export async function commitAll(ctx: GitContext, options: CommitAllOptions): Promise<CommitAllResult> {
  const { dir } = ctx;
  const { message, author, branch, dryRun } = options;

  if (!message?.trim()) {
    throw new Error("commitAll: commit message is required");
  }

  if (!author?.name || !author?.email) {
    throw new Error("commitAll: author { name, email } is required");
  }

  const fs = await getFs();

  await ensureRepo(ctx);
  // Prefer committing to whatever HEAD currently points to to avoid HEAD/ref drift.
  // If a specific branch is requested, we'll checkout/update HEAD first.

  const status = await getRepoStatus(ctx);
  const toAdd = [...status.added, ...status.modified, ...status.untracked];
  const toRemove = [...status.deleted];

  for (const f of toAdd) {
    if (dryRun) continue;
    await isogit.add({ fs, dir, filepath: f });
  }

  for (const f of toRemove) {
    if (dryRun) continue;
    await isogit.remove({ fs, dir, filepath: f });
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
    // Align HEAD with desired branch if a branch was explicitly provided and differs
    // from current HEAD branch. This prevents staged status from lingering due to HEAD mismatch.
    try {
      const headBranch = await isogit.currentBranch({ fs, dir, fullname: false });
      if (branch && headBranch !== branch) {
        // Attempt lightweight branch switch without altering workdir contents.
        // Using writeRef keeps this fast and avoids a full checkout.
        await isogit.writeRef({ fs, dir, ref: "HEAD", value: `refs/heads/${branch}`, force: true, symbolic: true });
      }
    } catch {
      /* ignore branch alignment failures */
    }

    // Commit to HEAD (default) to ensure HEAD, index, and statusMatrix stay in sync.
    oid = await isogit.commit({
      fs,
      dir,
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
  const { dir } = ctx;
  const { limit = 20 } = opts;
  const fs = await getFs();

  let ref = opts.ref;
  if (!ref) {
    ref = (await isogit.currentBranch({ fs, dir, fullname: false })) ?? "HEAD";
  }

  const entries = await isogit.log({ fs, dir, ref, depth: limit });
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

export type ListAllCommitsOptions = {
  /** Max unique commits to return after de-dup. Omit for all collected. */
  limit?: number;
  /** Per-ref traversal depth. Default: 200. */
  perRefDepth?: number;
  /** Include tags in the traversal. Default: true. */
  includeTags?: boolean;
  /** Optional explicit refs to traverse (if provided, overrides branches/tags discovery). */
  refs?: string[];
};

export type CommitEntryWithRefs = CommitEntry & { refs: string[] };

/** List commits across all branches (and optionally tags), de-duplicated by OID. */
export async function listAllCommits(
  ctx: GitContext,
  opts: ListAllCommitsOptions = {},
): Promise<CommitEntryWithRefs[]> {
  const { dir } = ctx;
  const fs = await getFs();

  await ensureRepo(ctx);

  const perRefDepth = opts.perRefDepth ?? 200;

  let refs: string[] | undefined = opts.refs;
  if (!refs) {
    const branches = await isogit.listBranches({ fs, dir });
    const tags = (opts.includeTags ?? true) ? await isogit.listTags({ fs, dir }) : [];
    refs = [...branches, ...tags];
  }

  const map = new Map<string, CommitEntryWithRefs>();

  for (const ref of refs) {
    let entries: any[] = [];
    try {
      entries = await isogit.log({ fs, dir, ref, depth: perRefDepth });
    } catch {
      // Skip invalid or unreachable ref
      continue;
    }

    for (const e of entries) {
      const oid: string = e.oid;
      const c = e.commit || {};
      const a = c.author || {};
      const co = c.committer || {};
      const ts = typeof co.timestamp === "number" ? new Date(co.timestamp * 1000).toISOString() : undefined;
      const parents = Array.isArray(e.parents) ? e.parents : [];
      const msg = String(c.message || "").trim();

      const existing = map.get(oid);
      if (existing) {
        if (!existing.refs.includes(ref)) existing.refs.push(ref);
      } else {
        map.set(oid, {
          oid,
          message: msg,
          author: a.name,
          email: a.email,
          isoDate: ts,
          parents,
          refs: [ref],
        });
      }
    }
  }

  const all = Array.from(map.values());
  all.sort((a, b) => (b.isoDate || "").localeCompare(a.isoDate || ""));
  return typeof opts.limit === "number" ? all.slice(0, opts.limit) : all;
}

/**
 * Revert workdir to a previous commit.
 * - 'hard' (default): move the current branch ref to the target commit and checkout the branch.
 * - 'detached': set HEAD directly to the target commit (detached) and checkout files.
 */
export async function revertToCommit(ctx: GitContext, opts: RevertToCommitOptions): Promise<RevertToCommitResult> {
  const { dir } = ctx;
  const { to } = opts;
  const mode = opts.mode ?? "hard";
  const force = opts.force ?? true;

  if (!to || !String(to).trim()) throw new Error("revertToCommit: `to` is required");

  const fs = await getFs();

  // Resolve target OID from ref or abbreviated SHA.
  let targetOid = "";
  const maybeSha = String(to).trim();
  const isShaLike = /^[0-9a-fA-F]{4,40}$/.test(maybeSha);

  try {
    // Try resolving as a ref (e.g., 'main', 'HEAD~1').
    targetOid = await isogit.resolveRef({ fs, dir, ref: maybeSha });
  } catch {
    if (!isShaLike) {
      throw new Error(`revertToCommit: cannot resolve ref '${to}'`);
    }

    // Expand abbreviated OID if needed
    try {
      targetOid = maybeSha.length === 40 ? maybeSha : await isogit.expandOid({ fs, dir, oid: maybeSha });
    } catch {
      throw new Error(`revertToCommit: cannot resolve OID '${to}'`);
    }
  }

  // Ensure repo exists
  await ensureRepo(ctx);

  // Determine current branch for 'hard' mode
  let currentBranch = "";
  try {
    currentBranch = (await isogit.currentBranch({ fs, dir, fullname: false })) || "";
  } catch {
    currentBranch = "";
  }

  if (mode === "hard" && currentBranch) {
    // Move branch pointer to target commit (like `git reset --hard <oid>`) and checkout branch
    await isogit.writeRef({ fs, dir, ref: `refs/heads/${currentBranch}`, value: targetOid, force: true });
    // Ensure HEAD remains attached to the branch
    try {
      await isogit.writeRef({
        fs,
        dir,
        ref: "HEAD",
        value: `refs/heads/${currentBranch}`,
        force: true,
        symbolic: true,
      });
    } catch {
      /* ignore */
    }

    await isogit.checkout({ fs, dir, ref: currentBranch, force });

    const short = targetOid.slice(0, 7);
    return {
      oid: targetOid,
      branch: currentBranch,
      detached: false,
      summary: `Checked out ${short} on ${currentBranch} (hard)`,
    };
  }

  // Detached mode or branch-less repo: detach HEAD and checkout files at target commit
  await isogit.writeRef({ fs, dir, ref: "HEAD", value: targetOid, force: true });
  await isogit.checkout({ fs, dir, force });

  const short = targetOid.slice(0, 7);
  return {
    oid: targetOid,
    detached: true,
    summary: `Detached HEAD at ${short}`,
  };
}

/** Safe preview that always detaches at the target commit. */
export async function previewCommit(ctx: GitContext, to: string, force = true): Promise<RevertToCommitResult> {
  return revertToCommit(ctx, { to, mode: "detached", force });
}

/**
 * Checkout files from a specific commit/ref into the working directory without moving HEAD.
 * Equivalent to `git checkout <commit> -- <paths...>` (with `-- .` restoring everything).
 */
export async function checkoutAtCommit(
  ctx: GitContext,
  opts: CheckoutAtCommitOptions,
): Promise<CheckoutAtCommitResult> {
  const { dir } = ctx;
  const { at } = opts;
  const force = opts.force ?? true;
  const paths = opts.paths && opts.paths.length ? opts.paths : undefined;

  if (!at || !String(at).trim()) throw new Error("checkoutAtCommit: `at` is required");

  const fs = await getFs();

  // Resolve OID from ref or abbreviated SHA
  let targetOid = "";
  const maybe = String(at).trim();
  const isShaLike = /^[0-9a-fA-F]{4,40}$/.test(maybe);

  try {
    targetOid = await isogit.resolveRef({ fs, dir, ref: maybe });
  } catch {
    if (!isShaLike) {
      throw new Error(`checkoutAtCommit: cannot resolve ref '${at}'`);
    }

    try {
      targetOid = maybe.length === 40 ? maybe : await isogit.expandOid({ fs, dir, oid: maybe });
    } catch {
      throw new Error(`checkoutAtCommit: cannot resolve OID '${at}'`);
    }
  }

  await ensureRepo(ctx);

  // Restore files from the target tree into the working directory, but keep HEAD/branch unchanged.
  await isogit.checkout({ fs, dir, ref: targetOid, filepaths: paths, noUpdateHead: true, force });

  const short = targetOid.slice(0, 7);
  return {
    oid: targetOid,
    paths,
    summary: `Checked out ${paths ? paths.join(", ") : "all files"} from ${short}`,
  };
}

/**
 * Read whether HEAD is detached and what branch/oid it points at.
 */
export async function getHeadState(ctx: GitContext): Promise<HeadState> {
  const { dir } = ctx;
  const fs = await getFs();

  let currentBranch: string | undefined;
  try {
    const b = await isogit.currentBranch({ fs, dir, fullname: false, test: true });
    if (typeof b === "string" && b.length > 0) currentBranch = b;
  } catch {
    // ignore
  }

  if (currentBranch) {
    return { currentBranch, detached: false };
  }

  // Detached: resolve HEAD to oid for display
  try {
    const headOid = await isogit.resolveRef({ fs, dir, ref: "HEAD" });
    return { detached: true, headOid };
  } catch {
    return { detached: true };
  }
}

/**
 * Attach HEAD to a branch (reattach from detached state), optionally creating the branch.
 */
export async function attachHeadToBranch(
  ctx: GitContext,
  branch: string,
  options: AttachHeadOptions = {},
): Promise<{ branch: string; created?: boolean; summary: string }> {
  const { dir } = ctx;
  const { createIfMissing = true, force = true } = options;
  const fs = await getFs();

  if (!branch || !branch.trim()) throw new Error("attachHeadToBranch: `branch` is required");

  await ensureRepo(ctx);

  // Check if branch exists
  let branchExists = true;
  try {
    await isogit.resolveRef({ fs, dir, ref: `refs/heads/${branch}` });
  } catch {
    branchExists = false;
  }

  let created = false;
  if (!branchExists) {
    if (!createIfMissing) {
      throw new Error(`attachHeadToBranch: branch '${branch}' does not exist`);
    }
    // Create branch at current HEAD OID
    const headOid = await isogit.resolveRef({ fs, dir, ref: "HEAD" });
    await isogit.writeRef({ fs, dir, ref: `refs/heads/${branch}`, value: headOid, force: true });
    created = true;
  }

  // Make HEAD symbolic to the branch and checkout it to update workdir
  await isogit.writeRef({ fs, dir, ref: "HEAD", value: `refs/heads/${branch}`, force: true, symbolic: true });
  await isogit.checkout({ fs, dir, ref: branch, force });

  return {
    branch,
    created,
    summary: created ? `Created and attached HEAD to '${branch}'` : `Attached HEAD to '${branch}'`,
  };
}

export type ContinueFromCommitOptions = {
  /** Commit/ref to continue from. */
  to: string;
  /** Optional explicit new branch name (used only when not at a branch tip). Default: continue/<shortsha> */
  branch?: string;
  /** Overwrite local changes when switching. Default: true. */
  force?: boolean;
  /** If the branch already exists pointing elsewhere, throw instead of moving it. Default: true. */
  refuseUpdateExisting?: boolean;
};

/**
 * Smart "continue" behavior from a specific commit:
 * - If the target commit is the tip of an existing branch, (re)attach HEAD to that branch.
 * - Otherwise, create a new branch at the commit (default: continue/<shortsha>) and attach HEAD to it.
 * This avoids overriding existing commits while letting users seamlessly continue when at the latest commit.
 */
export async function continueFromCommit(
  ctx: GitContext,
  opts: ContinueFromCommitOptions,
): Promise<{ branch: string; oid: string; created: boolean; summary: string }> {
  const { dir } = ctx;
  const fs = await getFs();

  const force = opts.force ?? true;
  const refuseUpdateExisting = opts.refuseUpdateExisting ?? true;

  await ensureRepo(ctx);

  // Resolve the target commit OID
  const oid = await resolveOid(ctx, opts.to);
  const short = oid.slice(0, 7);

  // Discover branches and see if any points to this OID (tip match)
  const branches = await isogit.listBranches({ fs, dir });
  const tipMatches: string[] = [];
  for (const b of branches) {
    try {
      const tip = await isogit.resolveRef({ fs, dir, ref: `refs/heads/${b}` });
      if (tip === oid) tipMatches.push(b);
    } catch {
      // ignore invalid refs
    }
  }

  // If the commit is at the tip of any existing branch, attach HEAD to that branch
  if (tipMatches.length > 0) {
    // Prefer 'main' if present, else first match
    const chosen = tipMatches.includes("main") ? "main" : tipMatches[0];

    // Make HEAD symbolic to the branch and checkout to sync working tree
    await isogit.writeRef({ fs, dir, ref: "HEAD", value: `refs/heads/${chosen}`, force: true, symbolic: true });
    await isogit.checkout({ fs, dir, ref: chosen, force });

    return {
      branch: chosen,
      oid,
      created: false,
      summary: `Attached to '${chosen}' at ${short}`,
    };
  }

  // Otherwise, create a new continuation branch at the target commit
  const branch = opts.branch && opts.branch.trim().length ? opts.branch : `continue/${short}`;

  // Check if branch exists and where it points
  let exists = true;
  let existingTarget = "";
  try {
    existingTarget = await isogit.resolveRef({ fs, dir, ref: `refs/heads/${branch}` });
  } catch {
    exists = false;
  }

  let created = false;
  if (!exists) {
    await isogit.writeRef({ fs, dir, ref: `refs/heads/${branch}`, value: oid, force: true });
    created = true;
  } else if (existingTarget !== oid) {
    if (refuseUpdateExisting) {
      throw new Error(
        `continueFromCommit: branch '${branch}' exists at ${existingTarget.slice(0, 7)}; choose a different name`,
      );
    } else {
      await isogit.writeRef({ fs, dir, ref: `refs/heads/${branch}`, value: oid, force: true });
    }
  }

  // Attach HEAD to the branch and checkout to update workdir
  await isogit.writeRef({ fs, dir, ref: "HEAD", value: `refs/heads/${branch}`, force: true, symbolic: true });
  await isogit.checkout({ fs, dir, ref: branch, force });

  return {
    branch,
    oid,
    created,
    summary: `${created ? "Created" : "Attached to"} '${branch}' at ${short}`,
  };
}

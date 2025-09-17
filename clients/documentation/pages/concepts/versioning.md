---
title: Versioning in OPFS
---

# Versioning in OPFS

Kaset ships with a Git-compatible change log that lives entirely inside the browser. By pairing the Origin Private File System (OPFS) with [isomorphic-git](https://isomorphic-git.org/), every agent edit can be inspected, reviewed, reverted, and synchronized just like a traditional repository.

## Bootstrapping a repository

Create or open a repository before your agent starts making changes. `ensureRepo` idempotently initializes the `.git` metadata and sets defaults.

```ts
import { ensureRepo } from "@pstdio/opfs-utils";

const repo = { dir: "project" };

await ensureRepo(repo, {
  defaultBranch: "main",
  name: "Kaset Agent",
  email: "agent@example.com",
});
```

If the directory already contains Git metadata, `ensureRepo` simply returns the current branch. This makes it safe to call every time your app loads.

## Recording edits automatically

Most high-level utilities inside `@pstdio/opfs-utils` understand Git. For example, `patch` applies unified diffs **and** can stage the touched files so they appear in the status view. When the Kaset agent runtime calls `patch`, it injects the isomorphic-git context automatically. If you invoke `patch` directly, provide the same `{ git, fs, dir }` triple you use for other git helpers (you can grab `fs` via `getFs()` from the adapter module) to opt into auto-staging.

Whenever staging is enabled, agents see their changes in a `git status` equivalent, making it clear what is new, modified, or deleted before they commit.

## Committing and inspecting history

Use `commitAll`, `getRepoStatus`, and `listCommits` to turn staged changes into durable history:

```ts
import { commitAll, getRepoStatus, listCommits } from "@pstdio/opfs-utils";

const repo = { dir: "project" };

const status = await getRepoStatus(repo);
console.log(status.added, status.modified, status.deleted);

const commit = await commitAll(repo, {
  message: "feat: update welcome copy",
  author: { name: "You", email: "you@example.com" },
});

const history = await listCommits(repo, { limit: 5 });
console.log(history.map((entry) => `${entry.isoDate} ${entry.message}`));
```

Agents generally rely on `safeAutoCommit`, which wraps the above primitives. It records a commit after each successful task, so users can rewind the workspace or audit what happened.

## Reverting, branching, and previewing

When you need to undo or branch from a point in time, the same helpers expose safe operations:

- `revertToCommit({ dir }, { to, mode })` moves HEAD back while honoring staged work.
- `checkoutAtCommit({ dir }, { at, paths? })` lets you restore specific files without resetting everything.
- `attachHeadToBranch({ dir }, branch)` reconnects a detached HEAD to a named branch when you are ready to continue.
- `listAllCommits` and `previewCommit` provide rich context for UI timelines or review panes.

These APIs wrap the lower-level isomorphic-git commands and add guard rails for OPFS (forced checkouts are disabled by default, errors are standardized, and paths are normalized to your repo root).

import { applyPatch, parsePatch } from "diff";
import { stripAnsi } from "../shared";
import type * as IsomorphicGit from "isomorphic-git";
type StructuredPatch = any;

export interface FileOperationResult {
  success: boolean;
  output: string;
  details?: {
    created: string[];
    modified: string[];
    deleted: string[];
    renamed: Array<{ from: string; to: string }>;
    failed: Array<{ path: string; reason: string }>;
  };
}

export interface ApplyPatchOptions {
  /** OPFS directory under which the patch should be applied (usually your repo root) */
  root: FileSystemDirectoryHandle;

  /** Optional working subdirectory inside `root` (e.g., "packages/app") */
  workDir?: string;

  /** The unified diff content */
  diffContent: string;

  /**
   * Strip ANSI/VT escape sequences from diffContent before parsing.
   * Defaults to true, to make copy/pasted colored diffs parse cleanly.
   */
  sanitizeAnsiDiff?: boolean;

  /** Abort if needed */
  signal?: AbortSignal;

  /**
   * Optional isomorphic-git context to stage changes (`git add`/`remove`).
   * `fs` must refer to the same tree as OPFS paths (use an adapter or mirrored FS).
   */
  git?: {
    git: typeof IsomorphicGit;
    fs: any; // isomorphic-git compatible fs (e.g., LightningFS)
    dir: string; // repo root path for isomorphic-git
    stage?: boolean; // default true: auto-stage changed paths
  };
}

/**
 * Apply a unified diff to OPFS files, optionally staging with isomorphic-git.
 */
export async function applyPatchInOPFS(opts: ApplyPatchOptions): Promise<FileOperationResult> {
  const { root, workDir = "", diffContent, signal, git, sanitizeAnsiDiff = true } = opts;

  const cleanDiff = sanitizeAnsiDiff ? stripAnsi(diffContent) : diffContent;

  // Fast-path: treat a file-header-only diff (no hunks) as a no-op success.
  // Many tools (or user copy/paste) can produce diffs with only ---/+++ lines.
  // A unified diff requires at least one @@ hunk to describe changes.
  // We return success to indicate "nothing to do" instead of an error.
  const hasHeaders = /^(---|\+\+\+)\s/m.test(cleanDiff);
  const hasHunks = /^@@\s/m.test(cleanDiff);
  if (hasHeaders && !hasHunks) {
    return { success: true, output: "No changes in patch (no hunks)." };
  }

  // Parse the patch into per-file hunks
  let patches: StructuredPatch[];
  try {
    patches = parsePatch(cleanDiff);
  } catch (e) {
    // If we failed to parse but there are clearly no hunks, treat as no-op.
    if (hasHeaders && !hasHunks) {
      return { success: true, output: "No changes in patch (no hunks)." };
    }
    return { success: false, output: "Failed to parse patch: " + (e instanceof Error ? e.message : String(e)) };
  }
  if (!patches.length) {
    return { success: false, output: "No file hunks found in patch." };
  }

  const created: string[] = [];
  const modified: string[] = [];
  const deleted: string[] = [];
  const renamed: Array<{ from: string; to: string }> = [];
  const failed: Array<{ path: string; reason: string }> = [];

  // Utility to stage changes with isomorphic-git when requested
  const shouldStage = git && (git.stage ?? true);
  const stageAdd = async (filepath: string) => {
    if (!shouldStage || !git) return;
    try {
      await git.git.add({ fs: git.fs, dir: git.dir, filepath });
    } catch (e) {
      failed.push({ path: filepath, reason: "git add failed: " + stringifyErr(e) });
    }
  };
  const stageRemove = async (filepath: string) => {
    if (!shouldStage || !git) return;
    try {
      await git.git.remove({ fs: git.fs, dir: git.dir, filepath });
    } catch (e) {
      failed.push({ path: filepath, reason: "git remove failed: " + stringifyErr(e) });
    }
  };

  const base = await resolveSubdir(root, workDir);

  // Apply each file patch
  for (const p of patches) {
    if (signal?.aborted) break;

    // Paths can be "a/foo", "b/foo", or "/dev/null"
    const oldPath = normalizeGitPath(p.oldFileName);
    const newPath = normalizeGitPath(p.newFileName);

    const isCreate = oldPath === null && newPath !== null;
    const isDelete = newPath === null && oldPath !== null;
    const isRename = oldPath !== null && newPath !== null && oldPath !== newPath;
    const targetPath = newPath ?? oldPath; // where to end up (null handled above)

    if (targetPath === null) {
      // Rare: both null; skip
      continue;
    }

    try {
      if (isCreate) {
        // Create new file from patch content applied to empty string
        const out = applyPatch("", p);
        if (out === false) throw new Error("Hunks failed to apply for creation");
        await writeTextFile(base, targetPath, out);
        created.push(targetPath);
        await stageAdd(stagePathForGit(workDir, targetPath, git?.dir));
      } else if (isDelete) {
        // Verify and delete
        const before = await readTextFileOptional(base, oldPath!);
        if (before === null) {
          // If file missing, treat as already deleted (like --ignore-whitespace changed contexts)
          await safeDelete(base, oldPath!);
          deleted.push(oldPath!);
          await stageRemove(stagePathForGit(workDir, oldPath!, git?.dir));
        } else {
          const out = applyPatch(before, p);
          if (out === false) throw new Error("Hunks failed to apply for deletion");
          // If patch results in empty (typical), delete; otherwise trust header and delete
          await safeDelete(base, oldPath!);
          deleted.push(oldPath!);
          await stageRemove(stagePathForGit(workDir, oldPath!, git?.dir));
        }
      } else {
        // Modify (possibly with rename)
        const before = await readTextFileOptional(base, oldPath!);
        if (before === null) throw new Error("Target file not found: " + oldPath);

        const out = applyPatch(before, p);
        if (out === false) throw new Error("Hunks failed to apply");

        if (isRename) {
          // write new
          await writeTextFile(base, newPath!, out);
          // delete old
          await safeDelete(base, oldPath!);
          renamed.push({ from: oldPath!, to: newPath! });
          await stageAdd(stagePathForGit(workDir, newPath!, git?.dir));
          await stageRemove(stagePathForGit(workDir, oldPath!, git?.dir));
        } else {
          await writeTextFile(base, oldPath!, out);
          modified.push(oldPath!);
          await stageAdd(stagePathForGit(workDir, oldPath!, git?.dir));
        }
      }
    } catch (e) {
      failed.push({ path: targetPath, reason: stringifyErr(e) });
    }
  }

  const ok = failed.length === 0;
  const summary = [
    ok ? "Patch applied successfully." : "Patch completed with errors.",
    created.length ? `Created: ${created.length}` : "",
    modified.length ? `Modified: ${modified.length}` : "",
    deleted.length ? `Deleted: ${deleted.length}` : "",
    renamed.length ? `Renamed: ${renamed.length}` : "",
    failed.length ? `Failed: ${failed.length}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    success: ok,
    output: summary,
    details: { created, modified, deleted, renamed, failed },
  };
}

// ---------------------------------------------------------------------------
// OPFS helpers
// ---------------------------------------------------------------------------

/** Resolve a subdirectory ('' means root) */
async function resolveSubdir(root: FileSystemDirectoryHandle, subdir: string) {
  if (!subdir) return root;
  const segs = normalizeSegments(subdir);
  let cur = root;
  for (const s of segs) {
    cur = await cur.getDirectoryHandle(s, { create: true });
  }
  return cur;
}

/** Read a text file or return null if it doesn't exist */
async function readTextFileOptional(root: FileSystemDirectoryHandle, path: string): Promise<string | null> {
  try {
    const fh = await getFileHandle(root, path, false);
    const file = await fh.getFile();
    return await file.text();
  } catch (e: any) {
    if (e && (e.name === "NotFoundError" || e.code === 1)) return null;
    throw e;
  }
}

/** Write text file (mkdir -p as needed) */
async function writeTextFile(root: FileSystemDirectoryHandle, path: string, content: string): Promise<void> {
  const dir = await getDirHandle(root, parentOf(path), true);
  const fh = await dir.getFileHandle(basename(path), { create: true });
  const w = await fh.createWritable();
  try {
    await w.write(content);
  } finally {
    await w.close();
  }
}

/** Delete a file if present */
async function safeDelete(root: FileSystemDirectoryHandle, path: string) {
  const dir = await getDirHandle(root, parentOf(path), false).catch(() => null);
  if (!dir) return;
  try {
    await dir.removeEntry(basename(path));
  } catch (e: any) {
    if (!(e && (e.name === "NotFoundError" || e.code === 1))) throw e;
  }
}

/** Get a FileSystemFileHandle (optionally creating) */
async function getFileHandle(root: FileSystemDirectoryHandle, path: string, create: boolean) {
  const dir = await getDirHandle(root, parentOf(path), create);
  return await dir.getFileHandle(basename(path), { create });
}

/** Get (and optionally create) a directory for a path's parent */
async function getDirHandle(root: FileSystemDirectoryHandle, path: string, create: boolean) {
  if (!path) return root;
  const segs = normalizeSegments(path);
  let cur = root;
  for (const s of segs) {
    cur = await cur.getDirectoryHandle(s, { create });
  }
  return cur;
}

// ---------------------------------------------------------------------------
// Path utilities
// ---------------------------------------------------------------------------

/** Normalize a git path field: strip a/ or b/, handle /dev/null, remove leading /, collapse .. */
export function normalizeGitPath(input?: string): string | null {
  if (!input) return null;
  if (input === "/dev/null") return null;
  const p = input
    .replace(/^[ab]\//, "")
    .replace(/^\/+/, "")
    .replace(/\\/g, "/");
  const segs = normalizeSegments(p);
  return segs.join("/");
}

export function normalizeSegments(p: string): string[] {
  const out: string[] = [];
  for (const raw of p.split("/")) {
    const s = raw.trim();
    if (!s || s === ".") continue;
    if (s === "..") {
      // Do not allow escaping the provided root
      if (out.length) out.pop();
      continue;
    }
    out.push(s);
  }
  return out;
}

function parentOf(p: string): string {
  const i = p.lastIndexOf("/");
  return i === -1 ? "" : p.slice(0, i);
}
function basename(p: string): string {
  const i = p.lastIndexOf("/");
  return i === -1 ? p : p.slice(i + 1);
}

/** Map OPFS path to isomorphic-git `filepath` when staging */
export function stagePathForGit(workDir: string, filePath: string, _gitDir?: string) {
  // isomorphic-git expects a path relative to `dir`
  // If your `dir` points to the same root as `root/workDir`, then this is just workDir/filePath
  const rel = (workDir ? normalizeSegments(workDir).join("/") + "/" : "") + filePath;
  return rel;
}

function stringifyErr(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

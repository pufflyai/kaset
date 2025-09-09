import { applyPatch, parsePatch } from "diff";
import type * as IsomorphicGit from "isomorphic-git";
import { stripAnsi } from "../shared";
import { basename, normalizeSegments, parentOf } from "./path";
export { normalizeSegments } from "./path";

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
   * Maximum allowed drift (in lines) from a hunk's declared oldStart when
   * attempting fuzzy placement. If a numeric header exists and the best match
   * is beyond this offset, the hunk is rejected. Defaults to 200.
   * For hunks without line numbers ("@@ @@"), the entire file is searched.
   */
  maxOffsetLines?: number;

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
  const { root, workDir = "", diffContent, signal, git, sanitizeAnsiDiff = true, maxOffsetLines = 200 } = opts;

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

  // Parse the patch into per-file hunks (relaxed: allow @@ without numbers)
  let patches: StructuredPatch[];
  try {
    patches = await parseUnifiedDiffRelaxed({
      diffText: cleanDiff,
      root,
      workDir,
      maxOffsetLines,
    });
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

// ---------------------------------------------------------------------------
// Relaxed unified diff parsing and fuzzy placement
// ---------------------------------------------------------------------------

interface RelaxedHunk {
  header: string;
  // If numeric header exists, values are present; otherwise undefined
  oldStart?: number;
  oldLines?: number;
  newStart?: number;
  newLines?: number;
  lines: string[]; // hunk body lines including leading prefixes (' ', '+', '-')
}

interface RelaxedFilePatch {
  oldFileName: string;
  newFileName: string;
  hunks: RelaxedHunk[];
}

const HUNK_NUMERIC_RE = /^@@\s+-([0-9]+)(?:,([0-9]+))?\s+\+([0-9]+)(?:,([0-9]+))?\s+@@/;
const HUNK_ANY_RE = /^@@/;

async function parseUnifiedDiffRelaxed(args: {
  diffText: string;
  root: FileSystemDirectoryHandle;
  workDir: string;
  maxOffsetLines: number;
}): Promise<StructuredPatch[]> {
  const { diffText, root, workDir, maxOffsetLines } = args;

  // Try the strict parser first; if it works, return immediately
  // We still enforce maxOffsetLines for numeric hunks by leaving placement to the library,
  // but since we cannot observe its chosen offset, we only enforce during relaxed flow.
  try {
    return parsePatch(diffText);
  } catch {
    // Fall through to relaxed parsing
  }

  const files = collectFilePatches(diffText);
  if (!files.length) return [];

  const structured: StructuredPatch[] = [];
  for (const file of files) {
    const oldPath = normalizeGitPath(file.oldFileName);
    const newPath = normalizeGitPath(file.newFileName);
    const isDelete = oldPath !== null && newPath === null;

    // Build per-file structured patch with fuzzy placement
    const beforeText = oldPath ? await readTextFileOptional(await resolveSubdir(root, workDir), oldPath) : null;
    const beforeLines = (beforeText ?? "").split(/\r?\n/);

    const placedHunks: Array<{
      oldStart: number;
      oldLines: number;
      newStart: number;
      newLines: number;
      lines: string[];
    }> = [];

    let cumulativeDelta = 0; // track line count delta from previous hunks for newStart suggestion

    for (const h of file.hunks) {
      // Compute counts
      const oldBody = h.lines.filter((l) => l.startsWith(" ") || l.startsWith("-"));
      const newBody = h.lines.filter((l) => l.startsWith(" ") || l.startsWith("+"));
      const oldCount = oldBody.length;
      const newCount = newBody.length;

      let chosenOldStart: number | undefined = h.oldStart;

      // If we have a numeric header, try to enforce maxOffset
      if (h.oldStart && oldPath && beforeLines.length) {
        const expectedIndex = h.oldStart - 1;
        const windowStart = Math.max(0, expectedIndex - maxOffsetLines);
        const windowEnd = Math.min(beforeLines.length, expectedIndex + maxOffsetLines + 1);

        const oldSeq = oldBody.map((l) => l.slice(1));
        const within = findSubsequenceIndex(beforeLines, oldSeq, windowStart, windowEnd);

        if (within === -1) {
          throw new Error(
            `Hunk placement exceeds maxOffsetLines (${maxOffsetLines}) for ${oldPath} at declared line ${h.oldStart}.`,
          );
        }
        chosenOldStart = within + 1;
      }

      // If no numeric header (or no oldStart provided), search entire file
      if (!chosenOldStart) {
        if (!oldPath) {
          // Creation hunk; place at start of file (empty pre-image)
          chosenOldStart = 1;
        } else if (isDelete && beforeText === null) {
          // Deletion of a missing file: skip anchoring and let higher-level logic treat as already deleted
          chosenOldStart = 1;
        } else {
          const oldSeq = oldBody.map((l) => l.slice(1));
          const idx = findSubsequenceIndex(beforeLines, oldSeq, 0, beforeLines.length);
          if (oldSeq.length > 0 && idx === -1) {
            throw new Error(`Could not locate hunk context in ${oldPath} for numberless @@ header.`);
          }
          chosenOldStart = (idx === -1 ? 0 : idx) + 1; // when no anchor lines, default to 1
        }
      }

      const suggestedNewStart = Math.max(1, chosenOldStart + cumulativeDelta);

      placedHunks.push({
        oldStart: chosenOldStart,
        oldLines: oldCount,
        newStart: suggestedNewStart,
        newLines: newCount,
        lines: h.lines,
      });

      cumulativeDelta += newCount - oldCount;
    }

    structured.push({
      oldFileName: file.oldFileName,
      newFileName: file.newFileName,
      hunks: placedHunks,
    });
  }

  return structured;
}

function collectFilePatches(diffText: string): RelaxedFilePatch[] {
  const lines = diffText.split(/\r?\n/);
  const files: RelaxedFilePatch[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line?.startsWith("--- ")) {
      const oldFileName = parseHeaderPath(line.slice(4));
      const plus = lines[i + 1] || "";
      if (!plus.startsWith("+++ ")) {
        i++;
        continue;
      }
      const newFileName = parseHeaderPath(plus.slice(4));
      i += 2;

      const hunks: RelaxedHunk[] = [];
      while (i < lines.length && HUNK_ANY_RE.test(lines[i] || "")) {
        const header = lines[i] || "";
        let oldStart: number | undefined;
        let oldLines: number | undefined;
        let newStart: number | undefined;
        let newLines: number | undefined;

        const m = header.match(HUNK_NUMERIC_RE);
        if (m) {
          oldStart = toInt(m[1]);
          oldLines = toInt(m[2] ?? "1");
          newStart = toInt(m[3]);
          newLines = toInt(m[4] ?? "1");
        }

        i++;

        const body: string[] = [];
        while (i < lines.length) {
          const l = lines[i];
          if (l?.startsWith("--- ") || HUNK_ANY_RE.test(l || "") || l?.startsWith("diff --git ")) break;
          if (l?.startsWith("\\ No newline at end of file")) {
            i++;
            continue;
          }
          if (!l?.startsWith(" ") && !l?.startsWith("+") && !l?.startsWith("-")) break;
          body.push(l);
          i++;
        }

        hunks.push({ header, oldStart, oldLines, newStart, newLines, lines: body });
      }

      files.push({ oldFileName, newFileName, hunks });
      continue;
    }

    i++;
  }

  return files;
}

function parseHeaderPath(raw: string): string {
  // Trim everything after first tab or space (timestamps)
  const p = raw.split(/\t|\s/)[0] ?? raw;
  return p.trim();
}

function toInt(s: string): number {
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function findSubsequenceIndex(haystack: string[], needle: string[], from: number, to: number): number {
  // Empty needle matches at 'from'
  if (needle.length === 0) return from;

  const end = Math.min(haystack.length, to);
  for (let i = from; i <= end - needle.length; i++) {
    let ok = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return i;
  }
  return -1;
}

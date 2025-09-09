import { applyPatch, parsePatch } from "diff";
import type * as IsomorphicGit from "isomorphic-git";
import { readTextFileOptional, resolveSubdir, safeDelete, stripAnsi, writeTextFile } from "../shared";
import { joinPath, normalizeSegments } from "./path";

export { normalizeSegments } from "./path";

export interface StructuredPatch {
  oldFileName: string;
  newFileName: string;
  hunks: Array<{
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    lines: string[];
  }>;
}

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
   * Maximum allowed drift (in lines) from a hunk's declared oldStart when attempting fuzzy placement.
   * If a numeric header exists and the best match is beyond this offset, the hunk is rejected.
   * Defaults to 200. For hunks without line numbers ("@@ @@"), the entire file is searched.
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

  // Treat a file-header-only diff (no hunks) as a no-op success.
  const hasHeaders = /^(---|\+\+\+)\s/m.test(cleanDiff);
  const hasHunks = /^@@/m.test(cleanDiff);
  if (hasHeaders && !hasHunks) {
    return { success: true, output: "No changes in patch (no hunks)." };
  }

  const baseDir = await resolveSubdir(root, workDir, true);

  // Parse (strict first, relaxed fallback)
  let patches: StructuredPatch[];
  try {
    patches = await parseUnifiedDiffRelaxed({
      diffText: cleanDiff,
      baseDir,
      maxOffsetLines,
    });
  } catch (e) {
    if (hasHeaders && !hasHunks) {
      return { success: true, output: "No changes in patch (no hunks)." };
    }
    return { success: false, output: "Failed to parse patch: " + stringifyErr(e) };
  }

  // Sanitize hunks to drop any non-change marker lines (e.g., "\\ No newline at end of file").
  patches = sanitizeParsedPatches(patches);

  if (!patches.length) {
    return { success: false, output: "No file hunks found in patch." };
  }

  const tracker = new OperationTracker();
  const stager = new GitStager(git, workDir, tracker);

  // Apply each file patch
  for (const p of patches) {
    if (signal?.aborted) break;

    const oldPath = normalizeGitPath(p.oldFileName);
    const newPath = normalizeGitPath(p.newFileName);

    const isCreate = oldPath === null && newPath !== null;
    const isDelete = newPath === null && oldPath !== null;
    const isRename = oldPath !== null && newPath !== null && oldPath !== newPath;
    const targetPath = newPath ?? oldPath;

    if (targetPath === null) continue; // rare: both null

    try {
      if (isCreate) {
        // Create from empty pre-image
        const out = applyPatch("", p as any);
        if (out === false) throw new Error("Hunks failed to apply for creation");
        await writeTextFile(baseDir, targetPath, out);
        tracker.created.push(targetPath);
        await stager.add(targetPath);
        continue;
      }

      if (isDelete) {
        const before = await readTextFileOptional(baseDir, oldPath!);
        if (before === null) {
          // Treat as already deleted
          await safeDelete(baseDir, oldPath!);
          tracker.deleted.push(oldPath!);
          await stager.remove(oldPath!);
        } else {
          const out = applyPatch(before, p as any);
          if (out === false) throw new Error("Hunks failed to apply for deletion");
          await safeDelete(baseDir, oldPath!);
          tracker.deleted.push(oldPath!);
          await stager.remove(oldPath!);
        }
        continue;
      }

      // Modify (possibly with rename)
      const before = await readTextFileOptional(baseDir, oldPath!);
      if (before === null) throw new Error("Target file not found: " + oldPath);

      const hasTextualChanges = patchHasTextualChanges(p);
      const out = isRename && !hasTextualChanges ? before : applyPatch(before, p as any);
      if (out === false) throw new Error("Hunks failed to apply");

      if (isRename) {
        await writeTextFile(baseDir, newPath!, out);
        await safeDelete(baseDir, oldPath!);
        tracker.renamed.push({ from: oldPath!, to: newPath! });
        await stager.add(newPath!);
        await stager.remove(oldPath!);
      } else {
        await writeTextFile(baseDir, oldPath!, out);
        tracker.modified.push(oldPath!);
        await stager.add(oldPath!);
      }
    } catch (e) {
      tracker.failed.push({ path: targetPath, reason: stringifyErr(e) });
    }
  }

  const ok = tracker.failed.length === 0 && !signal?.aborted;
  const summary = tracker.summary(ok, signal?.aborted);

  return {
    success: ok,
    output: summary,
    details: {
      created: tracker.created,
      modified: tracker.modified,
      deleted: tracker.deleted,
      renamed: tracker.renamed,
      failed: tracker.failed,
    },
  };
}

// OPFS helpers moved to ../shared to be reused across utils.

class GitStager {
  private ctx?: ApplyPatchOptions["git"];
  private shouldStage: boolean;
  private workDir: string;
  private tracker: OperationTracker;

  constructor(ctx: ApplyPatchOptions["git"], workDir: string, tracker: OperationTracker) {
    this.ctx = ctx;
    this.workDir = workDir;
    this.shouldStage = Boolean(ctx && (ctx.stage ?? true));
    this.tracker = tracker;
  }

  async add(filePath: string) {
    if (!this.shouldStage || !this.ctx) return;
    try {
      await this.ctx.git.add({
        fs: this.ctx.fs,
        dir: this.ctx.dir,
        filepath: stagePathForGit(this.workDir, filePath, this.ctx.dir),
      });
    } catch (e) {
      this.tracker.failed.push({ path: filePath, reason: "git add failed: " + stringifyErr(e) });
    }
  }

  async remove(filePath: string) {
    if (!this.shouldStage || !this.ctx) return;
    try {
      await this.ctx.git.remove({
        fs: this.ctx.fs,
        dir: this.ctx.dir,
        filepath: stagePathForGit(this.workDir, filePath, this.ctx.dir),
      });
    } catch (e) {
      this.tracker.failed.push({
        path: filePath,
        reason: "git remove failed: " + stringifyErr(e),
      });
    }
  }
}

/** Map OPFS path to isomorphic-git `filepath` when staging */
export function stagePathForGit(workDir: string, filePath: string, _gitDir?: string) {
  // isomorphic-git expects a path relative to `dir`
  const base = workDir ? normalizeSegments(workDir).join("/") : "";
  return base ? joinPath(base, filePath) : filePath;
}

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

function stringifyErr(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function patchHasTextualChanges(p: Pick<StructuredPatch, "hunks">): boolean {
  return p.hunks?.some((h) => h.lines?.some((l) => l.startsWith("+") || l.startsWith("-"))) ?? true;
}

interface RelaxedHunk {
  header: string;
  oldStart?: number;
  oldLines?: number;
  newStart?: number;
  newLines?: number;
  lines: string[]; // body lines including prefixes (' ', '+', '-')
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
  baseDir: FileSystemDirectoryHandle;
  maxOffsetLines: number;
}): Promise<StructuredPatch[]> {
  const { diffText, baseDir, maxOffsetLines } = args;

  // Try strict parser first; if it succeeds, convert into a relaxed representation
  // and continue with our placement logic (to support numberless @@ and offset search).
  let files: RelaxedFilePatch[] | null = null;
  try {
    const strict = parsePatch(diffText) as unknown as StructuredPatch[];
    files = strict.map((sp) => ({
      oldFileName: sp.oldFileName,
      newFileName: sp.newFileName,
      hunks: (sp.hunks || []).map((h: any) => ({
        header: "",
        oldStart: typeof h.oldStart === "number" && Number.isFinite(h.oldStart) ? h.oldStart : undefined,
        oldLines: typeof h.oldLines === "number" && Number.isFinite(h.oldLines) ? h.oldLines : undefined,
        newStart: typeof h.newStart === "number" && Number.isFinite(h.newStart) ? h.newStart : undefined,
        newLines: typeof h.newLines === "number" && Number.isFinite(h.newLines) ? h.newLines : undefined,
        lines: (h.lines || []) as string[],
      })),
    }));
  } catch {
    // Fall through to relaxed parsing from raw text
  }

  if (!files) {
    files = collectFilePatches(diffText);
  }
  if (!files.length) return [];

  const structured: StructuredPatch[] = [];

  for (const file of files) {
    const oldPath = normalizeGitPath(file.oldFileName);
    const newPath = normalizeGitPath(file.newFileName);
    const isDelete = oldPath !== null && newPath === null;

    // Pre-image
    const beforeText = oldPath ? await readTextFileOptional(baseDir, oldPath) : null;
    const beforeLines = (beforeText ?? "").split(/\r?\n/);

    const placedHunks: StructuredPatch["hunks"] = [];
    let cumulativeDelta = 0;

    for (const h of file.hunks) {
      const filtered = (h.lines || []).filter((l) => l?.startsWith(" ") || l?.startsWith("+") || l?.startsWith("-"));
      // Compute counts
      const oldBody = filtered.filter((l) => l.startsWith(" ") || l.startsWith("-"));
      const newBody = filtered.filter((l) => l.startsWith(" ") || l.startsWith("+"));
      const oldCount = oldBody.length;
      const newCount = newBody.length;

      let chosenOldStart: number | undefined = h.oldStart;

      // Enforce maxOffset when numeric header is present
      if (h.oldStart && oldPath && beforeLines.length) {
        const expectedIndex = h.oldStart - 1;
        const windowStart = Math.max(0, expectedIndex - maxOffsetLines);
        const windowEnd = Math.min(beforeLines.length, expectedIndex + maxOffsetLines + 1);

        const oldSeq = oldBody.map((l) => l.slice(1));
        const within = findSubsequenceIndex(beforeLines, oldSeq, windowStart, windowEnd);

        if (within === -1) {
          // Fall back to declared position; let applyPatch surface the failure
          chosenOldStart = expectedIndex + 1;
        } else {
          chosenOldStart = within + 1;
        }
      }

      // No numeric header: search entire file
      if (!chosenOldStart) {
        if (!oldPath) {
          // Creation hunk; place at start (empty pre-image)
          chosenOldStart = 1;
        } else if (isDelete && beforeText === null) {
          // Deleting a missing file: allow and continue
          chosenOldStart = 1;
        } else {
          const oldSeq = oldBody.map((l) => l.slice(1));
          const idx = findSubsequenceIndex(beforeLines, oldSeq, 0, beforeLines.length);
          // If we cannot find the context, let applyPatch report failure later.
          chosenOldStart = (idx === -1 ? 0 : idx) + 1; // when no context, default to 1
        }
      }

      const suggestedNewStart = Math.max(1, chosenOldStart + cumulativeDelta);

      placedHunks.push({
        oldStart: chosenOldStart,
        oldLines: oldCount,
        newStart: suggestedNewStart,
        newLines: newCount,
        lines: filtered,
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

// Parse relaxed unified diff by scanning headers and hunks.
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

class OperationTracker {
  created: string[] = [];
  modified: string[] = [];
  deleted: string[] = [];
  renamed: Array<{ from: string; to: string }> = [];
  failed: Array<{ path: string; reason: string }> = [];

  summary(ok: boolean, aborted?: boolean): string {
    const parts = [
      aborted ? "Patch aborted." : ok ? "Patch applied successfully." : "Patch completed with errors.",
      this.created.length ? `Created: ${this.created.length}` : "",
      this.modified.length ? `Modified: ${this.modified.length}` : "",
      this.deleted.length ? `Deleted: ${this.deleted.length}` : "",
      this.renamed.length ? `Renamed: ${this.renamed.length}` : "",
      this.failed.length ? `Failed: ${this.failed.length}` : "",
    ].filter(Boolean);
    return parts.join(" ");
  }
}

function sanitizeParsedPatches(patches: StructuredPatch[]): StructuredPatch[] {
  return patches.map((p) => ({
    ...p,
    hunks: (p.hunks || []).map((h) => ({
      ...h,
      lines: (h.lines || []).filter((l) => typeof l === "string" && (/^[ +\-]/.test(l))),
    })),
  }));
}

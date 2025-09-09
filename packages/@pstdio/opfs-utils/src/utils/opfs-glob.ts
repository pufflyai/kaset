// Programmatic globbing over the browser's OPFS.
// Emulates the behavior of the Node `glob` call shown in your code.
import { basename, joinPath, normalizeSlashes, parentOf } from "./path";
import { getDirHandle, getFileHandle as getFileHandleShared, resolveSubdir as resolveSubdirShared } from "../shared";
import { expandBraces, globToRegExp } from "./glob";

/* =========================
 * Types & public API
 * ========================= */

export interface GlobPath {
  /** Return an absolute-like path string (OPFS-style). */
  fullpath(): string;
  /** Milliseconds since epoch (file last modified). */
  mtimeMs?: number;
}

export interface OpfsGlobOptions {
  /** Glob pattern (supports **, *, ?, [..], and one-level {a,b,c}). */
  pattern: string;
  /** Subdirectory within the OPFS root to search (like cwd). Default: "" (root). */
  path?: string;
  /** Case sensitivity. Default: false (case-insensitive). */
  caseSensitive?: boolean;
  /** Include dotfiles. Default: true. */
  dot?: boolean;
  /** Additional ignore globs (always applied). Default: ['**\/node_modules/**','**\/.git/**'] */
  ignore?: string[];
  /** Respect .gitignore rules at the search root. Default: true. (simplified semantics) */
  respectGitIgnore?: boolean;
  /** Collect file stats (mtime) for recency sorting. Default: true. */
  stat?: boolean;
  /** Abort signal to cancel mid-search. */
  signal?: AbortSignal;
}

export interface GlobResult {
  /** Matched files (files only). */
  entries: GlobPath[];
  /** Count of files that were filtered due to .gitignore (approximate). */
  gitIgnored: number;
  /** A human-readable message similar to your tool’s summary. */
  summary: string;
}

/* =========================
 * Main entry
 * ========================= */

export async function opfsGlob(root: FileSystemDirectoryHandle, opts: OpfsGlobOptions): Promise<GlobResult> {
  const {
    pattern,
    path: subdir = "",
    caseSensitive = false, // default nocase like your code
    dot = true,
    ignore = ["**/node_modules/**", "**/.git/**"],
    respectGitIgnore = true,
    stat = true,
    signal,
  } = opts;

  if (!pattern || !pattern.trim()) {
    throw new Error("pattern must be a non-empty string");
  }

  const searchRoot = await resolveSubdirShared(root, subdir, false);

  // --- 1) If the pattern is an exact path in this search root, treat it as a literal (like glob.escape)
  const literalExists = await pathExists(searchRoot, pattern);
  let patterns: string[] = [];
  if (literalExists) {
    // Treat as a literal path match (not a wildcard).
    patterns = [escapeGlobLiteral(pattern)];
  } else {
    // Expand braces (one level) then keep glob tokens as-is for matching.
    patterns = expandBraces(pattern);
  }

  // Compile includes (one or multiple patterns due to brace expansion)
  const includeREs = patterns.map((p) => globToRegExp(p, { dot, caseSensitive }));

  // Compile hard ignores (always applied)
  const hardIgnoreREs = (ignore ?? []).map((g) => globToRegExp(g, { dot: true, caseSensitive }));

  // --- 2) Collect candidate files under searchRoot (files only), then filter
  const found: { rel: string; abs: string; mtimeMs?: number }[] = [];
  const now = Date.now();

  for await (const rel of walkFiles(searchRoot, "", { signal })) {
    if (signal?.aborted) break;

    // Hard ignore first
    if (matchesAny(rel, hardIgnoreREs)) continue;

    // Match include patterns
    if (!matchesAny(rel, includeREs)) continue;

    // Stat if requested
    let mtimeMs: number | undefined;
    if (stat) {
      try {
        const fh = await getFileHandleShared(searchRoot, rel, false);
        const f = await fh.getFile();
        mtimeMs = f.lastModified;
      } catch {
        // Ignore stat errors; treat as 0
        mtimeMs = 0;
      }
    }

    found.push({
      rel,
      abs: joinPath(normalizeSlashes(subdir), rel),
      mtimeMs,
    });
  }

  // --- 3) Optional .gitignore filtering (simplified root-level semantics)
  let gitIgnoredCount = 0;
  let kept = found;

  if (respectGitIgnore) {
    const gi = await loadGitIgnore(searchRoot);
    if (gi) {
      const before = kept.length;
      kept = kept.filter((e) => gi.include(e.rel));
      gitIgnoredCount += before - kept.length;
    }
  }

  // --- 4) Sort: “recent files first” within 24h, then alphabetical
  const RECENCY_MS = 24 * 60 * 60 * 1000;

  const entries = sortFileEntries(
    kept.map((e) => ({
      fullpath: () => "/" + e.abs,
      mtimeMs: e.mtimeMs ?? 0,
    })),
    now,
    RECENCY_MS,
  );

  // --- 5) Build summary message like your tool
  const searchedWhere = subdir ? subdir : "/";
  const count = entries.length;
  const summary =
    `Found ${count} file(s) matching "${pattern}" within ${searchedWhere}` +
    (gitIgnoredCount > 0 ? ` (${gitIgnoredCount} additional files were git-ignored)` : "") +
    `, sorted by modification time (newest first):\n` +
    entries.map((e) => e.fullpath()).join("\n");

  return { entries, gitIgnored: gitIgnoredCount, summary };
}

/* =========================
 * Sorting (same semantics as your helper)
 * ========================= */

/**
 * Sorts file entries based on recency and then alphabetically.
 * Recent files (modified within recencyThresholdMs) are listed first, newest to oldest.
 * Older files are listed after recent ones, sorted alphabetically by path.
 */
export function sortFileEntries(entries: GlobPath[], nowTimestamp: number, recencyThresholdMs: number): GlobPath[] {
  const sortedEntries = [...entries];
  sortedEntries.sort((a, b) => {
    const mtimeA = a.mtimeMs ?? 0;
    const mtimeB = b.mtimeMs ?? 0;
    const aIsRecent = nowTimestamp - mtimeA < recencyThresholdMs;
    const bIsRecent = nowTimestamp - mtimeB < recencyThresholdMs;

    if (aIsRecent && bIsRecent) {
      return mtimeB - mtimeA;
    } else if (aIsRecent) {
      return -1;
    } else if (bIsRecent) {
      return 1;
    } else {
      return a.fullpath().localeCompare(b.fullpath());
    }
  });
  return sortedEntries;
}

/* =========================
 * OPFS helpers
 * ========================= */

async function* walkFiles(
  dir: FileSystemDirectoryHandle,
  prefix: string,
  { signal }: { signal?: AbortSignal },
): AsyncGenerator<string, void, unknown> {
  const iter = (dir as any).entries() as AsyncIterable<[string, FileSystemHandle]>;
  for await (const [name, handle] of iter) {
    if (signal?.aborted) return;
    const rel = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === "file") {
      yield rel;
    } else if (handle.kind === "directory") {
      // Hard prune .git and node_modules here too (fast path)
      if (name === ".git" || name === "node_modules") continue;
      yield* walkFiles(handle as FileSystemDirectoryHandle, rel, { signal });
    }
  }
}

async function pathExists(dir: FileSystemDirectoryHandle, relPath: string): Promise<"file" | "directory" | null> {
  const parent = parentOf(relPath);
  const base = basename(relPath);
  try {
    const d = parent ? await getDirHandle(dir, parent, false) : dir;
    try {
      await d.getFileHandle(base, { create: false });
      return "file";
    } catch {
      try {
        await d.getDirectoryHandle(base, { create: false });
        return "directory";
      } catch {
        return null;
      }
    }
  } catch {
    return null;
  }
}

/* =========================
 * .gitignore (simplified)
 * ========================= */

type GitIgnoreRule = { re: RegExp; negate: boolean; dirOnly: boolean };

async function loadGitIgnore(root: FileSystemDirectoryHandle): Promise<{ include(p: string): boolean } | null> {
  // Root-level .gitignore only (simplified)
  let text: string | null = null;
  try {
    const fh = await root.getFileHandle(".gitignore", { create: false });
    const f = await fh.getFile();
    text = await f.text();
  } catch {
    return null;
  }
  if (!text) return null;

  const rules: GitIgnoreRule[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    let negate = false;
    let body = line;
    if (body.startsWith("!")) {
      negate = true;
      body = body.slice(1);
    }

    let dirOnly = false;
    if (body.endsWith("/")) {
      dirOnly = true;
      body = body.slice(0, -1);
    }
    // Interpret pattern as glob relative to root
    // Expand to catch descendants when dirOnly
    const glob = dirOnly ? body + "/**" : body;
    try {
      const re = globToRegExp(glob, { dot: true, caseSensitive: false });
      rules.push({ re, negate, dirOnly });
    } catch {
      // ignore malformed line
    }
  }

  return {
    include(p: string): boolean {
      // Start as included; each rule can toggle
      let ignored = false;
      for (const r of rules) {
        if (r.re.test(p)) {
          ignored = !r.negate;
        }
      }
      return !ignored;
    },
  };
}
function escapeGlobLiteral(s: string): string {
  // Escape glob metacharacters so we treat the pattern as a literal path
  // (similar to glob.escape in Node)
  return s.replace(/[\\*?[\]{}()!+@]/g, (m) => "\\" + m);
}

function matchesAny(path: string, regs: RegExp[]): boolean {
  for (const r of regs) if (r.test(path)) return true;
  return false;
}

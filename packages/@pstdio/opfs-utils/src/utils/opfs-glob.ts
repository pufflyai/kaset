// Programmatic globbing over the browser's OPFS.
import { getFs } from "../adapter/fs";
import { resolveSubdir, readTextFileOptional } from "../shared.migrated";
import { expandBraces, globToRegExp } from "./glob";
import { joinPath, normalizeSlashes } from "./path";

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

export async function opfsGlob(_root: FileSystemDirectoryHandle, opts: OpfsGlobOptions): Promise<GlobResult> {
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

  // Resolve the absolute search root ("/subdir") using shared.migrated.
  const searchRootAbs = await resolveSubdir(subdir, false);

  // --- 1) If the pattern is an exact path in this search root, treat it as a literal (like glob.escape)
  const literalExists = await fsPathExists(searchRootAbs, pattern);
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

  for await (const rel of walkFilesFs(searchRootAbs, "", { signal })) {
    if (signal?.aborted) break;

    // Hard ignore first
    if (matchesAny(rel, hardIgnoreREs)) continue;

    // Match include patterns
    if (!matchesAny(rel, includeREs)) continue;

    // Stat if requested
    let mtimeMs: number | undefined;
    if (stat) {
      try {
        const fs = await getFs();
        const abs = "/" + joinPath(searchRootAbs, rel);
        const st = await fs.promises.stat(abs);
        mtimeMs = st.mtimeMs ?? 0;
      } catch {
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
    const gi = await loadGitIgnore(searchRootAbs);
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
 * FS-backed helpers (via ZenFS over OPFS)
 * ========================= */

async function* walkFilesFs(
  rootAbs: string,
  prefix: string,
  { signal }: { signal?: AbortSignal },
): AsyncGenerator<string, void, unknown> {
  if (signal?.aborted) return;

  const fs = await getFs();
  const hereAbs = "/" + (prefix ? joinPath(rootAbs, prefix) : normalizeSlashes(rootAbs));

  let names: string[] = [];
  try {
    // ZenFS supports Node-like readdir returning string[]
    names = await fs.promises.readdir(hereAbs);
  } catch {
    return; // unreadable directory
  }

  for (const name of names) {
    if (signal?.aborted) return;
    const rel = prefix ? `${prefix}/${name}` : name;
    const abs = "/" + joinPath(rootAbs, rel);

    let st: any;
    try {
      st = await fs.promises.stat(abs);
    } catch {
      continue;
    }

    if (st.isFile?.()) {
      yield rel;
      continue;
    }

    if (st.isDirectory?.()) {
      // Hard prune .git and node_modules here too (fast path)
      if (name === ".git" || name === "node_modules") continue;
      yield* walkFilesFs(rootAbs, rel, { signal });
    }
  }
}

async function fsPathExists(rootAbs: string, relPath: string): Promise<"file" | "directory" | null> {
  const fs = await getFs();
  const normRel = normalizeSlashes(relPath);
  const abs = "/" + joinPath(rootAbs, normRel);
  try {
    const st = await fs.promises.stat(abs);
    if (st.isFile?.()) return "file";
    if (st.isDirectory?.()) return "directory";
    return null;
  } catch {
    return null;
  }
}

/* =========================
 * .gitignore (simplified)
 * ========================= */

type GitIgnoreRule = { re: RegExp; negate: boolean; dirOnly: boolean };

async function loadGitIgnore(rootAbs: string): Promise<{ include(p: string): boolean } | null> {
  // Root-level .gitignore only (simplified)
  const fileText = await readTextFileOptional(joinPath(rootAbs, ".gitignore"));
  if (!fileText) return null;

  const rules: GitIgnoreRule[] = [];
  for (const raw of fileText.split(/\r?\n/)) {
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

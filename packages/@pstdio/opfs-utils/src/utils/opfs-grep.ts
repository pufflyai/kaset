import { expandBraces, globToRegExp } from "./glob";
import { getFs } from "../adapter/fs";
import { resolveSubdir } from "../shared.migrated";
import { joinPath, normalizeSlashes } from "./path";

/**
 * Shape of a single match.
 */
export interface GrepMatch {
  /** POSIX-like path inside OPFS (e.g., "dir/file.txt"). */
  file: string;
  /** 1-based line number. */
  line: number;
  /** 1-based column (JS code unit index). */
  column: number;
  /** Matched substring. */
  match: string;
  /** Entire line content without trailing newline. */
  lineText: string;
}

/**
 * Options for grep().
 */
export interface GrepOptions {
  /** Pattern to search for (string becomes a RegExp). */
  pattern: string | RegExp;
  /** Regex flags when `pattern` is a string (e.g., "i", "im"). "g" will be added if missing. */
  flags?: string;
  /** Include-only globs (e.g., ["**\/*.txt", "**\/*.log"]). If present, a path must match at least one. */
  include?: string[];
  /** Exclude globs (e.g., ["**\/node_modules\/**"]). */
  exclude?: string[];
  /** Skip files larger than this many bytes (default 20MB). */
  maxFileSize?: number;
  /** Max files processed in parallel (default 4). */
  concurrency?: number;
  /** TextDecoder encoding (default "utf-8"). */
  encoding?: string;
  /** Optional cancellation signal. */
  signal?: AbortSignal;
  /** Optional callback invoked for each match (streaming). */
  onMatch?: (m: GrepMatch) => void | Promise<void>;
}

/**
 * Small internal type for files yielded by the walker.
 */
interface FileEntry {
  /** Path relative to the provided dirPath (POSIX-like) */
  path: string;
  /** Absolute path within OPFS (leading slash) */
  abs: string;
}

export async function grep(dirPath: string, options: GrepOptions): Promise<GrepMatch[]> {
  const {
    pattern,
    flags,
    include,
    exclude,
    maxFileSize = 20 * 1024 * 1024,
    concurrency = 4,
    encoding = "utf-8",
    signal,
    onMatch,
  } = options;

  // Normalize patterns (expand simple {a,b,c} brace lists)
  const includeREs = (include ?? []).flatMap((p) => expandBraces(p)).map((g) => globToRegExp(g));
  const excludeREs = (exclude ?? []).flatMap((p) => expandBraces(p)).map((g) => globToRegExp(g));
  const re = toGlobalRegex(pattern, flags);

  // Resolve absolute search root (OPFS path starting with "/")
  const rootAbs = await resolveSubdir(dirPath || "", false);

  // Collect files first (so we can pool-process them)
  const files: FileEntry[] = [];
  for await (const rel of walkFilesFs(rootAbs, "", { signal })) {
    if (shouldSkip(rel, includeREs, excludeREs)) continue;
    const abs = joinPath(rootAbs, rel);
    files.push({ path: rel, abs });
  }

  const results: GrepMatch[] = [];
  const fs = await getFs();

  await runPool<FileEntry>(files, Math.max(1, concurrency), async (fileEntry: FileEntry) => {
    if (signal?.aborted) return;
    try {
      const st = await fs.promises.stat("/" + normalizeSlashes(fileEntry.abs));
      if ((st.size ?? 0) > maxFileSize) return;

      // Read entire file and scan lines
      const buf = await fs.promises.readFile("/" + normalizeSlashes(fileEntry.abs));
      const text = typeof buf === "string" ? buf : new TextDecoder(encoding, { fatal: false }).decode(buf);

      const lines = text.split("\n");
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (line.endsWith("\r")) line = line.slice(0, -1);

        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(line)) !== null) {
          const col = (m.index ?? 0) + 1;
          const match: GrepMatch = {
            file: fileEntry.path,
            line: i + 1,
            column: col,
            match: m[0],
            lineText: line,
          };
          results.push(match);
          if (onMatch) await onMatch(match);
          if (m[0] === "") re.lastIndex++;
        }
      }
    } catch {
      // Swallow per-file errors to keep scanning others.
      // (Consider adding a hook for error reporting if needed.)
    }
  });

  return results;
}

/**
 * Recursively walk a directory, yielding files with their POSIX-like paths.
 */
async function* walkFilesFs(
  rootAbs: string,
  prefix = "",
  { signal }: { signal?: AbortSignal } = {},
): AsyncGenerator<string, void, unknown> {
  if (signal?.aborted) return;

  const fs = await getFs();
  const hereAbs = "/" + (prefix ? joinPath(rootAbs, prefix) : normalizeSlashes(rootAbs));

  let names: string[] = [];
  try {
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
      yield* walkFilesFs(rootAbs, rel, { signal });
    }
  }
}

/**
 * Ensure a *global* RegExp. If `pattern` is a string, build one with flags.
 * If it's a RegExp, add 'g' if missing.
 */
export function toGlobalRegex(pat: string | RegExp, flags?: string): RegExp {
  if (pat instanceof RegExp) {
    const f = pat.flags.includes("g") ? pat.flags : pat.flags + "g";
    return new RegExp(pat.source, f);
  }
  const f = flags ?? "";
  const f2 = f.includes("g") ? f : f + "g";
  return new RegExp(pat, f2);
}

/**
 * Apply include/exclude rules to a POSIX-like path.
 */
export function shouldSkip(path: string, includeREs: RegExp[], excludeREs: RegExp[]): boolean {
  const p = path.replace(/\\/g, "/");
  if (excludeREs.some((r) => r.test(p))) return true;
  if (includeREs.length > 0 && !includeREs.some((r) => r.test(p))) return true;
  return false;
}

/**
 * Convert a simple glob to RegExp. Supports **, *, ? tokens.
 * - **  : match across path separators
 * - *   : match within a segment (no '/')
 * - ?   : match a single char (no '/')
 *
 * Note: Brace lists like {js,ts} are expanded by expandBraces() upstream
 * before this converter runs.
 */
// Re-export shared helpers for existing test imports
export { expandBraces, globToRegExp } from "./glob";

/**
 * Simple promise pool to cap concurrency.
 */
async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let idx = 0;
  const runners = Array.from({ length: Math.min(limit, items.length || 1) }, async function run() {
    while (idx < items.length) {
      const i = idx++;
      await worker(items[i]);
    }
  });
  await Promise.all(runners);
}

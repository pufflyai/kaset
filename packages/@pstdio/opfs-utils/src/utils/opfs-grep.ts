import { expandBraces, globToRegExp } from "./glob";

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
  path: string;
  handle: FileSystemFileHandle;
}

export async function grep(dirHandle: FileSystemDirectoryHandle, options: GrepOptions): Promise<GrepMatch[]> {
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

  // Collect files first (so we can pool-process them)
  const files: FileEntry[] = [];
  for await (const f of walk(dirHandle, "", { signal })) {
    if (shouldSkip(f.path, includeREs, excludeREs)) continue;
    files.push(f);
  }

  const results: GrepMatch[] = [];
  await runPool<FileEntry>(files, Math.max(1, concurrency), async (fileEntry: FileEntry) => {
    if (signal?.aborted) return;
    try {
      const file = await fileEntry.handle.getFile();
      if (file.size > maxFileSize) return;

      const reader = file.stream().getReader();
      const decoder = new TextDecoder(encoding, { fatal: false });

      let carry = "";
      let lineNo = 0;

      while (true) {
        if (signal?.aborted) return;
        const { value, done } = await reader.read();
        if (done) break;
        carry += decoder.decode(value, { stream: true });

        // Consume full lines in 'carry'
        let nlIndex: number;
        while ((nlIndex = carry.indexOf("\n")) >= 0) {
          let line = carry.slice(0, nlIndex);
          // Handle CRLF
          if (line.endsWith("\r")) line = line.slice(0, -1);
          carry = carry.slice(nlIndex + 1);
          lineNo++;

          // Scan the line
          re.lastIndex = 0;
          let m: RegExpExecArray | null;
          while ((m = re.exec(line)) !== null) {
            const col = (m.index ?? 0) + 1;
            const match: GrepMatch = {
              file: fileEntry.path,
              line: lineNo,
              column: col,
              match: m[0],
              lineText: line,
            };
            results.push(match);
            if (onMatch) await onMatch(match);
            // Prevent infinite loop on zero-length matches
            if (m[0] === "") re.lastIndex++;
          }
        }
      }

      // Flush remainder as final line (if any)
      const tail = carry + decoder.decode();
      if (tail.length > 0) {
        lineNo++;
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(tail)) !== null) {
          const col = (m.index ?? 0) + 1;
          const match: GrepMatch = {
            file: fileEntry.path,
            line: lineNo,
            column: col,
            match: m[0],
            lineText: tail,
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
async function* walk(
  dirHandle: FileSystemDirectoryHandle,
  prefix = "",
  { signal }: { signal?: AbortSignal } = {},
): AsyncGenerator<FileEntry, void, unknown> {
  // entries() yields [name, handle]
  for await (const [name, handle] of (dirHandle as any).entries() as AsyncIterable<[string, FileSystemHandle]>) {
    if (signal?.aborted) return;
    const path = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === "file") {
      yield { path, handle: handle as FileSystemFileHandle };
    } else if (handle.kind === "directory") {
      yield* walk(handle as FileSystemDirectoryHandle, path, { signal });
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

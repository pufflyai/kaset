import { processSingleFileContent } from "../utils/opfs-files";
import { globToRegExp as globToRegExpGrep, grep } from "../utils/opfs-grep";
import { formatLong, ls } from "../utils/opfs-ls";

/**
 * Configuration options for running OPFS shell commands
 */
export type RunOptions = {
  /** OPFS root (usually from navigator.storage.getDirectory()) */
  root: FileSystemDirectoryHandle;
  /** Logical working subdirectory under root; default "" = OPFS root */
  cwd?: string;
  /** Optional streaming callback for stdout; still returns the final concatenated stdout */
  onChunk?: (s: string) => void;
};

/**
 * Executes a command line string in an OPFS-based shell environment.
 * Supports basic Unix-like commands (ls, sed, rg) with pipe and && operators.
 *
 * @param cmdline - Command line string to execute (supports pipes | and && operators)
 * @param opts - Execution options including root directory and optional callbacks
 * @returns Promise resolving to execution result with stdout, stderr, and exit code
 */
export async function runOpfsCommandLine(
  cmdline: string,
  opts: RunOptions,
): Promise<{ stdout: string; stderr: string; code: number }> {
  const ctx: Ctx = { ...opts, cwd: normalizeSlashes(opts.cwd ?? "") };

  // Split command line by && operators (logical AND)
  const sequences = splitTop(cmdline, "&&");
  let out = "";
  let err = "";

  for (const seq of sequences) {
    // Split each sequence by | operators (pipes)
    const stages = splitTop(seq, "|")
      .map((s) => s.trim())
      .filter(Boolean);

    let stdin = "";
    for (let i = 0; i < stages.length; i++) {
      const tokens = tokenize(stages[i]);
      if (tokens.length === 0) continue;

      const cmd = tokens[0];
      const args = tokens.slice(1);

      let stageOut = "";
      // Execute supported commands
      switch (cmd) {
        case "ls":
          stageOut = await cmdLs(args, ctx);
          break;
        case "find":
          stageOut = await cmdFind(args, ctx);
          break;
        case "echo":
          stageOut = await cmdEcho(args, ctx, stdin);
          break;
        case "sed":
          stageOut = await cmdSed(args, ctx, stdin);
          break;
        case "wc":
          stageOut = await cmdWc(args, ctx, stdin);
          break;
        case "rg":
        case "ripgrep":
          stageOut = await cmdRg(args, ctx);
          break;
        default:
          err += `Unknown command: ${cmd}\n`;
          return { stdout: out, stderr: err, code: 127 };
      }

      // Pass output from current stage to next stage as stdin
      stdin = stageOut;
    }

    // Accumulate final output from this sequence
    if (stdin) {
      out += stdin + (stdin.endsWith("\n") ? "" : "\n");
      ctx.onChunk?.(stdin);
    }
  }

  return { stdout: out, stderr: err, code: err ? 1 : 0 };
}

/**
 * Implementation of a simple 'echo' command.
 * - Joins arguments with spaces and returns the string.
 * - Currently ignores flags like -n/-e and stdin; suitable for piping to other commands.
 */
async function cmdEcho(args: string[], _ctx: Ctx, _stdin: string): Promise<string> {
  if (!args.length) return "";

  // Basic option parsing (ignored semantics for now; keeps room for future support)
  const out: string[] = [];
  for (const a of args) {
    if (a === "-n" || a === "-e" || a === "-E") continue;
    out.push(a);
  }

  return out.join(" ");
}

/**
 * Implementation of a minimal 'find' for OPFS.
 * Supports:
 * - paths: a single starting path (default '.')
 * - -name <glob>: basename match (simple glob, supports **, *, ?)
 * - -type [f|d]: filter by file/directory
 * - -maxdepth N / -mindepth N: depth limits (mindepth relative to start; 0 includes start itself)
 * - prints one path per line (relative to cwd, including the starting path when mindepth<=0)
 */
async function cmdFind(args: string[], ctx: Ctx): Promise<string> {
  // Defaults
  let startPathArg: string | undefined;
  let namePattern: string | undefined;
  let typeFilter: "file" | "directory" | undefined;
  let maxdepth: number | undefined;
  let mindepth = 0;

  // Parse args (simple, order-insensitive)
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-name") {
      namePattern = args[++i];
    } else if (a === "-type") {
      const t = args[++i];
      if (t === "f") typeFilter = "file";
      else if (t === "d") typeFilter = "directory";
    } else if (a === "-maxdepth") {
      const v = parseInt(args[++i] ?? "", 10);
      if (!Number.isNaN(v) && v >= 0) maxdepth = v;
    } else if (a === "-mindepth") {
      const v = parseInt(args[++i] ?? "", 10);
      if (!Number.isNaN(v) && v >= 0) mindepth = v;
    } else if (!a.startsWith("-")) {
      // First positional = start path
      if (startPathArg == null) startPathArg = a;
    }
  }

  const target = startPathArg ?? ".";
  const normTarget = normalizeSlashes(target);

  const { dir, rel } = await resolveAsDirOrFile(ctx, target);

  // Build matcher(s)
  const nameRE = namePattern ? globToRegExpGrep(namePattern) : undefined;

  // We'll collect outputs as paths relative to cwd
  const out: string[] = [];

  // Helper to test a candidate
  const matchesFilters = (entry: { name: string; kind: "file" | "directory"; depth: number }): boolean => {
    if (typeFilter && entry.kind !== typeFilter) return false;
    if (nameRE && !nameRE.test(entry.name)) return false;
    if (entry.depth < mindepth) return false;
    if (maxdepth != null && entry.depth > maxdepth) return false;
    return true;
  };

  // Include starting path itself when mindepth <= 0
  if (rel.kind === "directory") {
    if (mindepth <= 0) {
      const includeStart = matchesFilters({
        name: normTarget === "." ? "." : basename(normTarget),
        kind: "directory",
        depth: 0,
      });
      if (includeStart) out.push(normTarget);
    }

    const entries = await ls(dir, {
      maxDepth: maxdepth == null ? Infinity : Math.max(0, maxdepth),
      // find shows hidden files by default
      showHidden: true,
      kinds: ["file", "directory"],
      stat: false,
      dirsFirst: false,
    });

    for (const e of entries) {
      const depthFromStart = e.depth; // ls yields 1 for direct children
      const candidate = { name: e.name, kind: e.kind, depth: depthFromStart };
      if (!matchesFilters(candidate)) continue;

      // Print path relative to cwd, prefixed with the provided start arg when applicable
      const printed = normTarget === "." ? e.path : `${normTarget}/${e.path}`;
      out.push(printed);
    }
  } else {
    // file: only consider the file itself (depth 0)
    if (mindepth <= 0) {
      const include = matchesFilters({ name: rel.path, kind: "file", depth: 0 });
      if (include) out.push(normTarget);
    }
  }

  return out.join("\n");
}

/**
 * Implementation of the 'ls' command for OPFS.
 * Supports common flags: -l (long format), -a (show hidden), -R (recursive)
 */
async function cmdLs(args: string[], ctx: Ctx): Promise<string> {
  // Parse command line flags
  let long = false;
  let all = false;
  let recursive = false;

  const paths: string[] = [];
  for (const a of args) {
    if (a.startsWith("-")) {
      long = long || a.includes("l");
      all = all || a.includes("a");
      recursive = recursive || a.includes("R");
    } else {
      paths.push(a);
    }
  }

  const target = paths[0] ?? ".";
  const { dir, rel } = await resolveAsDirOrFile(ctx, target);

  if (rel.kind === "directory") {
    // List directory contents
    const entries = await ls(dir, {
      maxDepth: recursive ? Infinity : 1,
      showHidden: all,
      stat: long,
      sortBy: "name",
      sortOrder: "asc",
      dirsFirst: true,
    });

    return long ? formatLong(entries) : entries.map((e) => e.path).join("\n");
  } else {
    // Show single file information
    if (long) {
      const entries = await ls(dir, {
        maxDepth: 1,
        include: [escapeLiteral(rel.path)],
        showHidden: true,
        stat: true,
      });
      return formatLong(entries.filter((e) => e.path === rel.path));
    } else {
      return rel.path;
    }
  }
}

/**
 * Implementation of the 'sed' command for OPFS.
 * Currently supports line range printing (e.g., sed -n '1,10p' file)
 */
async function cmdSed(args: string[], ctx: Ctx, stdin: string): Promise<string> {
  let quiet = false;
  const positional: string[] = [];

  // Parse command line arguments
  for (const a of args) {
    if (a === "-n") quiet = true;
    else positional.push(a);
  }

  if (positional.length === 0) throw new Error("sed: missing script");
  const script = unquote(positional[0]);
  const fileArg = positional[1];

  // Parse range patterns like "1,220p" or "5p"
  const mRange = /^(\d+),\s*(\d+)p$/.exec(script) || /^(\d+)p$/.exec(script);
  if (!mRange) throw new Error(`sed: unsupported script "${script}" (use 'N,Mp' or 'Np')`);

  const start1 = parseInt(mRange[1], 10);
  const end1 = mRange.length === 3 ? parseInt(mRange[2], 10) : start1;
  const offset = Math.max(0, start1 - 1); // Convert to 0-based index
  const limit = Math.max(0, end1 - offset);

  if (fileArg) {
    // Read from file
    const { dir, rel } = await resolveAsFile(ctx, fileArg);
    const res = await processSingleFileContent(rel.path, "", dir, offset, limit);
    const text = typeof res.llmContent === "string" ? res.llmContent : String(res.llmContent ?? "");
    return quiet ? text : text; // for now treat -n as implied since we only print requested range
  } else {
    // Read from stdin
    const lines = (stdin ?? "").split("\n");
    const slice = lines.slice(offset, offset + limit);
    return slice.join("\n");
  }
}

/**
 * Implementation of the 'rg' (ripgrep) command for OPFS.
 * Supports pattern searching with line numbers (-n) and smart case (-S)
 */
async function cmdRg(args: string[], ctx: Ctx): Promise<string> {
  let showLineNums = false;
  let smartCase = false;

  const positional: string[] = [];

  // Parse command line flags
  for (const a of args) {
    if (a === "-n") showLineNums = true;
    else if (a === "-S") smartCase = true;
    else positional.push(a);
  }

  if (positional.length === 0) throw new Error("rg: missing pattern");
  const rawPattern = unquote(positional[0]);
  const searchPath = positional[1] ?? ".";

  // Smart case: add case-insensitive flag if pattern has no uppercase letters
  let flags = "";
  if (smartCase && !/[A-Z]/.test(rawPattern)) flags += "i";

  const re = new RegExp(rawPattern, flags.includes("g") ? flags : flags + "g");

  const { dir } = await resolveAsDir(searchPath, ctx);

  // Perform grep search with common exclusions
  const matches = await grep(dir, {
    pattern: re,
    exclude: ["**/node_modules/**", "**/.git/**"],
    onMatch: undefined,
  });

  // Format output similar to ripgrep
  return matches
    .map((m) =>
      showLineNums ? `${m.file}:${m.line}:${m.column}: ${m.lineText}` : `${m.file}:${m.line}:${m.column}: ${m.match}`,
    )
    .join("\n");
}

/**
 * Implementation of a minimal 'wc' for OPFS.
 * Supports:
 * - -l (lines), -w (words), -c (bytes)
 * - multiple files with a final 'total' line
 * - reading from stdin when no files provided
 */
async function cmdWc(args: string[], ctx: Ctx, stdin: string): Promise<string> {
  let wantLines = false;
  let wantWords = false;
  let wantBytes = false;

  const files: string[] = [];

  for (const a of args) {
    if (a === "-l") wantLines = true;
    else if (a === "-w") wantWords = true;
    else if (a === "-c") wantBytes = true;
    else if (!a.startsWith("-")) files.push(a);
  }

  // default: all three
  if (!wantLines && !wantWords && !wantBytes) {
    wantLines = wantWords = wantBytes = true;
  }

  type Counts = { lines: number; words: number; bytes: number };
  const totals: Counts = { lines: 0, words: 0, bytes: 0 };

  const formatCounts = (c: Counts, label?: string) => {
    const parts: string[] = [];
    if (wantLines) parts.push(String(c.lines));
    if (wantWords) parts.push(String(c.words));
    if (wantBytes) parts.push(String(c.bytes));
    return label ? parts.join("\t") + "\t" + label : parts.join("\t");
  };

  const lines: string[] = [];

  if (files.length === 0) {
    const c = countText(stdin ?? "");
    return formatCounts(c);
  }

  for (const fileArg of files) {
    const { dir, rel } = await resolveAsFile(ctx, fileArg);
    const fh = await dir.getFileHandle(rel.path, { create: false });
    const f = await fh.getFile();
    const text = await f.text();

    const c = countText(text);
    totals.lines += c.lines;
    totals.words += c.words;
    totals.bytes += c.bytes;

    const label = normalizeSlashes(fileArg);
    lines.push(formatCounts(c, label));
  }

  if (files.length > 1) {
    lines.push(formatCounts(totals, "total"));
  }

  return lines.join("\n");
}

function countText(text: string): { lines: number; words: number; bytes: number } {
  const lines = text === "" ? 0 : (text.match(/\n/g) || []).length;
  const words = text.trim() ? (text.trim().match(/\S+/g) || []).length : 0;
  const bytes = typeof TextEncoder !== "undefined" ? new TextEncoder().encode(text).length : Buffer.from(text).length;
  return { lines, words, bytes };
}

/** Internal context type combining RunOptions with normalized current working directory */
type Ctx = Required<Pick<RunOptions, "root">> & { cwd: string; onChunk?: (s: string) => void };

/** Normalizes file paths by removing empty segments and joining with forward slashes */
function normalizeSlashes(p: string): string {
  return p.split("/").filter(Boolean).join("/");
}

/** Removes surrounding quotes from a string if present */
function unquote(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

/** Escapes special glob characters for literal matching */
function escapeLiteral(s: string) {
  return s.replace(/[\\*?[\]{}()!+@]/g, (m) => "\\" + m);
}

/**
 * Splits a command string at the top level by the specified separator,
 * respecting quoted strings to avoid splitting inside them.
 */
function splitTop(input: string, sep: "|" | "&&"): string[] {
  const out: string[] = [];
  let cur = "";
  let q: "'" | '"' | null = null; // Track current quote type

  for (let i = 0; i < input.length; i++) {
    const c = input[i];

    if (q) {
      // Inside quoted string
      if (c === q) {
        // Closing quote - preserve it and exit quote mode
        cur += c;
        q = null;
      } else if (c === "\\" && q === '"' && i + 1 < input.length) {
        // Handle escape sequences inside double quotes
        cur += c + input[++i];
      } else {
        cur += c;
      }
      continue;
    }

    // Check for separator outside of quotes
    if ((sep === "|" && c === "|") || (sep === "&&" && c === "&" && input[i + 1] === "&")) {
      out.push(cur.trim());
      cur = "";
      if (sep === "&&") i++; // Skip second '&' for && operator
      continue;
    }

    if (c === "'" || c === '"') {
      // Start of quoted string - preserve opening quote
      q = c as any;
      cur += c;
      continue;
    }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/**
 * Tokenizes a command string into individual arguments,
 * respecting quoted strings and escape sequences.
 */
function tokenize(input: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q: "'" | '"' | null = null; // Track quote type

  for (let i = 0; i < input.length; i++) {
    const c = input[i];

    if (q) {
      // Inside quoted string
      if (c === q) {
        q = null; // Close quote (don't preserve in token)
      } else if (c === "\\" && q === '"' && i + 1 < input.length) {
        // Handle escape sequences in double quotes
        cur += input[++i];
      } else {
        cur += c;
      }
      continue;
    }

    if (c === "'" || c === '"') {
      // Start quoted string (don't preserve quote in token)
      q = c as any;
      continue;
    }

    if (/\s/.test(c)) {
      // Whitespace separates tokens
      if (cur) {
        out.push(cur);
        cur = "";
      }
      continue;
    }

    cur += c;
  }

  if (cur) out.push(cur);
  return out;
}

/** Resolves a path as a directory handle relative to the current context */
async function resolveAsDir(path: string, ctx: Ctx): Promise<{ dir: FileSystemDirectoryHandle; full: string }> {
  const full = normalizeSlashes(join(ctx.cwd, path));
  const dir = await getDir(ctx.root, full);
  return { dir, full };
}

/** Resolves a path as a file handle, returning the parent directory and relative file info */
async function resolveAsFile(
  ctx: Ctx,
  filePath: string,
): Promise<{ dir: FileSystemDirectoryHandle; rel: { path: string } }> {
  const relPath = normalizeSlashes(join(ctx.cwd, filePath));
  const parent = parentOf(relPath);
  const base = basename(relPath);
  const dir = await getDir(ctx.root, parent);
  await dir.getFileHandle(base, { create: false }); // Verify file exists
  return { dir, rel: { path: base } };
}

/**
 * Resolves a path as either a directory or file, determining which type it is
 * by attempting directory resolution first, then falling back to file resolution
 */
async function resolveAsDirOrFile(
  ctx: Ctx,
  inputPath: string,
): Promise<{ dir: FileSystemDirectoryHandle; rel: { path: string; kind: "file" | "directory" } }> {
  const full = normalizeSlashes(join(ctx.cwd, inputPath));
  try {
    // Try as directory first
    const dir = await getDir(ctx.root, full);
    return { dir, rel: { path: ".", kind: "directory" } };
  } catch {
    // Fall back to treating as file
    const parent = parentOf(full);
    const base = basename(full);
    const dir = await getDir(ctx.root, parent);
    await dir.getFileHandle(base, { create: false }); // Verify file exists
    return { dir, rel: { path: base, kind: "file" } };
  }
}

/**
 * Navigates to a directory handle by following path segments from the root.
 * Throws if any segment doesn't exist or isn't a directory.
 */
async function getDir(root: FileSystemDirectoryHandle, path: string): Promise<FileSystemDirectoryHandle> {
  const segs = path ? path.split("/").filter((s) => s && s !== ".") : [];
  let cur = root;
  for (const s of segs) cur = await cur.getDirectoryHandle(s, { create: false });
  return cur;
}

/** Returns the parent directory path of a given path */
function parentOf(p: string): string {
  const i = p.lastIndexOf("/");
  return i === -1 ? "" : p.slice(0, i);
}

/** Returns the filename/basename portion of a path */
function basename(p: string): string {
  const i = p.lastIndexOf("/");
  return i === -1 ? p : p.slice(i + 1);
}

/** Joins two path segments with proper normalization */
function join(a: string, b: string): string {
  if (!a) return normalizeSlashes(b);
  if (!b) return normalizeSlashes(a);
  return normalizeSlashes(a + "/" + b);
}

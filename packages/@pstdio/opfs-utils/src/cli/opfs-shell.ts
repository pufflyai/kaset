// src/cli/opfs-shell.ts
import { ls, formatLong } from "../utils/opfs-ls";
import { processSingleFileContent } from "../utils/opfs-files";
import { grep } from "../utils/opfs-grep";

// ---- Public API ------------------------------------------------------------

export type RunOptions = {
  /** OPFS root (usually from navigator.storage.getDirectory()) */
  root: FileSystemDirectoryHandle;
  /** Logical working subdirectory under root; default "" = OPFS root */
  cwd?: string;
  /** Optional streaming callback for stdout; still returns the final concatenated stdout */
  onChunk?: (s: string) => void;
};

export async function runOpfsCommandLine(
  cmdline: string,
  opts: RunOptions,
): Promise<{ stdout: string; stderr: string; code: number }> {
  const ctx: Ctx = { ...opts, cwd: normalizeSlashes(opts.cwd ?? "") };

  const sequences = splitTop(cmdline, "&&");
  let out = "";
  let err = "";
  for (const seq of sequences) {
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
      switch (cmd) {
        case "ls":
          stageOut = await cmdLs(args, ctx);
          break;
        case "sed":
          stageOut = await cmdSed(args, ctx, stdin);
          break;
        case "rg":
        case "ripgrep":
          stageOut = await cmdRg(args, ctx);
          break;
        default:
          err += `Unknown command: ${cmd}\n`;
          return { stdout: out, stderr: err, code: 127 };
      }

      // piping
      stdin = stageOut;
    }

    if (stdin) {
      out += stdin + (stdin.endsWith("\n") ? "" : "\n");
      ctx.onChunk?.(stdin);
    }
  }

  return { stdout: out, stderr: err, code: err ? 1 : 0 };
}

// ---- Commands --------------------------------------------------------------

async function cmdLs(args: string[], ctx: Ctx): Promise<string> {
  // Minimal flags: -l (long), -a (all), -R (recursive)
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
    // list contents (depth 1 unless recursive)
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
    // ls of a single file: show just that file
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

async function cmdSed(args: string[], ctx: Ctx, stdin: string): Promise<string> {
  // Support: sed -n '1,220p' [file]
  let quiet = false;
  const positional: string[] = [];
  for (const a of args) {
    if (a === "-n") quiet = true;
    else positional.push(a);
  }
  if (positional.length === 0) throw new Error("sed: missing script");
  const script = unquote(positional[0]);
  const fileArg = positional[1];

  const mRange = /^(\d+),\s*(\d+)p$/.exec(script) || /^(\d+)p$/.exec(script);
  if (!mRange) throw new Error(`sed: unsupported script "${script}" (use 'N,Mp' or 'Np')`);

  const start1 = parseInt(mRange[1], 10);
  const end1 = mRange.length === 3 ? parseInt(mRange[2], 10) : start1;
  const offset = Math.max(0, start1 - 1);
  const limit = Math.max(0, end1 - offset);

  if (fileArg) {
    const { dir, rel } = await resolveAsFile(ctx, fileArg);
    const res = await processSingleFileContent(rel.path, "", dir, offset, limit);
    const text = typeof res.llmContent === "string" ? res.llmContent : String(res.llmContent ?? "");
    return quiet ? text : text; // for now treat -n as implied since we only print requested range
  } else {
    // operate on stdin
    const lines = (stdin ?? "").split("\n");
    const slice = lines.slice(offset, offset + limit);
    return slice.join("\n");
  }
}

async function cmdRg(args: string[], ctx: Ctx): Promise<string> {
  // Support subset: rg [-n] [-S] "pattern|alt" [path]
  let showLineNums = false;
  let smartCase = false;

  const positional: string[] = [];
  for (const a of args) {
    if (a === "-n") showLineNums = true;
    else if (a === "-S") smartCase = true;
    else positional.push(a);
  }
  if (positional.length === 0) throw new Error("rg: missing pattern");
  const rawPattern = unquote(positional[0]);
  const searchPath = positional[1] ?? ".";

  // smart case -> add 'i' only if the pattern has no uppercase letters
  let flags = "";
  if (smartCase && !/[A-Z]/.test(rawPattern)) flags += "i";

  // ripgrep-style alternation already supported by JS regex with '|'
  const re = new RegExp(rawPattern, flags.includes("g") ? flags : flags + "g");

  const { dir } = await resolveAsDir(searchPath, ctx);

  const matches = await grep(dir, {
    pattern: re,
    // apply default ignores similar to ripgrep
    exclude: ["**/node_modules/**", "**/.git/**"],
    onMatch: undefined,
  });

  return matches
    .map((m) =>
      showLineNums ? `${m.file}:${m.line}:${m.column}: ${m.lineText}` : `${m.file}:${m.line}:${m.column}: ${m.match}`,
    )
    .join("\n");
}

// ---- Helpers ---------------------------------------------------------------

type Ctx = Required<Pick<RunOptions, "root">> & { cwd: string; onChunk?: (s: string) => void };

function normalizeSlashes(p: string): string {
  return p.split("/").filter(Boolean).join("/");
}

function unquote(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function escapeLiteral(s: string) {
  return s.replace(/[\\*?[\]{}()!+@]/g, (m) => "\\" + m);
}

// split by a top-level separator, respecting quotes
function splitTop(input: string, sep: "|" | "&&"): string[] {
  const out: string[] = [];
  let cur = "";
  let q: "'" | '"' | null = null;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (q) {
      if (c === q) q = null;
      else if (c === "\\" && q === '"' && i + 1 < input.length) cur += input[++i];
      else cur += c;
      continue;
    }
    if ((sep === "|" && c === "|") || (sep === "&&" && c === "&" && input[i + 1] === "&")) {
      out.push(cur.trim());
      cur = "";
      if (sep === "&&") i++; // skip second '&'
      continue;
    }
    if (c === "'" || c === '"') {
      q = c as any;
      continue;
    }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// simple shell-like tokenizer (quotes + whitespace)
function tokenize(input: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q: "'" | '"' | null = null;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (q) {
      if (c === q) {
        q = null;
      } else if (c === "\\" && q === '"' && i + 1 < input.length) {
        cur += input[++i];
      } else {
        cur += c;
      }
      continue;
    }
    if (c === "'" || c === '"') {
      q = c as any;
      continue;
    }
    if (/\s/.test(c)) {
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

// Resolve helpers (relative to ctx.cwd)

async function resolveAsDir(path: string, ctx: Ctx): Promise<{ dir: FileSystemDirectoryHandle; full: string }> {
  const full = normalizeSlashes(join(ctx.cwd, path));
  const dir = await getDir(ctx.root, full);
  return { dir, full };
}

async function resolveAsFile(
  ctx: Ctx,
  filePath: string,
): Promise<{ dir: FileSystemDirectoryHandle; rel: { path: string } }> {
  const relPath = normalizeSlashes(join(ctx.cwd, filePath));
  const parent = parentOf(relPath);
  const base = basename(relPath);
  const dir = await getDir(ctx.root, parent);
  // Will throw if not found (let processSingleFileContent report properly)
  await dir.getFileHandle(base, { create: false });
  return { dir, rel: { path: base } };
}

async function resolveAsDirOrFile(
  ctx: Ctx,
  inputPath: string,
): Promise<{ dir: FileSystemDirectoryHandle; rel: { path: string; kind: "file" | "directory" } }> {
  const full = normalizeSlashes(join(ctx.cwd, inputPath));
  // First try as directory
  try {
    const dir = await getDir(ctx.root, full);
    return { dir, rel: { path: ".", kind: "directory" } };
  } catch {
    // Try file
    const parent = parentOf(full);
    const base = basename(full);
    const dir = await getDir(ctx.root, parent);
    await dir.getFileHandle(base, { create: false });
    return { dir, rel: { path: base, kind: "file" } };
  }
}

async function getDir(root: FileSystemDirectoryHandle, path: string): Promise<FileSystemDirectoryHandle> {
  const segs = path ? path.split("/").filter(Boolean) : [];
  let cur = root;
  for (const s of segs) cur = await cur.getDirectoryHandle(s, { create: false });
  return cur;
}

function parentOf(p: string): string {
  const i = p.lastIndexOf("/");
  return i === -1 ? "" : p.slice(0, i);
}
function basename(p: string): string {
  const i = p.lastIndexOf("/");
  return i === -1 ? p : p.slice(i + 1);
}
function join(a: string, b: string): string {
  if (!a) return normalizeSlashes(b);
  if (!b) return normalizeSlashes(a);
  return normalizeSlashes(a + "/" + b);
}

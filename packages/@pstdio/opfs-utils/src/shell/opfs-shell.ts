import { normalizeSlashes } from "../utils/path";
import { cmdEcho } from "./echo";
import { cmdFind } from "./find";
import type { Ctx } from "./helpers";
import { cmdLs } from "./ls";
import { cmdNl } from "./nl";
import { cmdRg } from "./rg";
import { cmdSed } from "./sed";
import { cmdWc } from "./wc";

/**
 * Configuration options for running OPFS shell commands
 */
export type RunOptions = {
  /** OPFS root handle is no longer required; adapter-backed FS is used */
  root?: FileSystemDirectoryHandle;
  /** Logical working subdirectory; default "" = OPFS root */
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
        case "nl":
          stageOut = await cmdNl(args, ctx, stdin);
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

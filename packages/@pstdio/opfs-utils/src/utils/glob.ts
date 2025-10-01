// Shared glob helpers for OPFS utilities

import * as picomatch from "picomatch/posix";

export interface GlobToRegExpOptions {
  // When false, wildcards at the start of a segment do not match a leading dot
  // (like many glob implementations). Default: true (match dotfiles).
  dot?: boolean;

  // Case sensitivity for the generated RegExp. Default: true (case-sensitive).
  caseSensitive?: boolean;
}

/**
 * Convert a glob pattern into a RegExp that matches the FULL POSIX-like path (anchored ^$).
 */
export function globToRegExp(glob: string, opts: GlobToRegExpOptions = {}): RegExp {
  const dot = opts.dot ?? true;
  const caseSensitive = opts.caseSensitive ?? true;

  const normalized = normalizeGlob(glob);

  const regex = picomatch.makeRe(normalized, {
    dot,
    nocase: !caseSensitive,
    windows: false,
    posixSlashes: true,
  });

  if (!regex) {
    throw new Error(`Failed to create RegExp from glob: ${glob}`);
  }

  return regex;
}

function normalizeGlob(pattern: string): string {
  let result = "";

  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];

    if (ch === "\\") {
      result += ch;
      if (i + 1 < pattern.length) {
        result += pattern[i + 1];
        i++;
      }
      continue;
    }

    if (ch === "[") {
      result += ch;
      const next = pattern[i + 1];
      const after = pattern[i + 2];

      if (next === "!" && after && after !== "]") {
        result += "^";
        i++;
      }
      continue;
    }

    result += ch;
  }

  return result;
}

// Expand simple one-or-more brace lists like:
//  - "**/*.{ts,tsx,md,txt}" -> ["**/*.ts", "**/*.tsx", "**/*.md", "**/*.txt"]
//  - "a/{b,c}/d" -> ["a/b/d", "a/c/d"]
// Nested braces are supported by recursively expanding the first pair found.
// Does not support numeric ranges (e.g., {1..3}); such inputs are treated as literals.
export function expandBraces(glob: string): string[] {
  const first = findFirstBrace(glob);
  if (!first) return [glob];

  const { start, end } = first;
  const before = glob.slice(0, start);
  const inner = glob.slice(start + 1, end);
  const after = glob.slice(end + 1);

  const parts = splitTopLevelCommaList(inner);
  if (parts.length <= 1) {
    // Not a comma-list; treat braces as literals
    return [glob];
  }

  const expanded = parts.map((p) => `${before}${p}${after}`);
  // Recurse to handle multiple brace sections
  return expanded.flatMap(expandBraces);
}

function findFirstBrace(s: string): { start: number; end: number } | null {
  let depth = 0;
  let start = -1;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\\") {
      i++; // skip next char
      continue;
    }
    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      if (depth > 0) {
        depth--;
        if (depth === 0) {
          return { start, end: i };
        }
      }
    }
  }
  return null;
}

function splitTopLevelCommaList(s: string): string[] {
  const out: string[] = [];
  let current = "";
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\\") {
      // keep escapes literal
      current += ch;
      if (i + 1 < s.length) {
        current += s[i + 1];
        i++;
      }
      continue;
    }
    if (ch === "{") {
      depth++;
      current += ch;
      continue;
    }
    if (ch === "}") {
      if (depth > 0) depth--;
      current += ch;
      continue;
    }
    if (ch === "," && depth === 0) {
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out;
}

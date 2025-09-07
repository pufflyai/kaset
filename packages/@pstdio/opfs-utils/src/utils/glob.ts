// Shared glob helpers for OPFS utilities

export interface GlobToRegExpOptions {
  // When false, wildcards at the start of a segment do not match a leading dot
  // (like many glob implementations). Default: true (match dotfiles).
  dot?: boolean;

  // Case sensitivity for the generated RegExp. Default: true (case-sensitive).
  caseSensitive?: boolean;
}

/**
 * Convert a glob pattern into a RegExp that matches the FULL POSIX-like path (anchored ^$).
 * Supports: **, *, ?, character classes [..] with leading ! for negation, and escapes.
 */
export function globToRegExp(glob: string, opts: GlobToRegExpOptions = {}): RegExp {
  const dot = opts.dot ?? true;
  const caseSensitive = opts.caseSensitive ?? true;

  let re = "^";
  let i = 0;

  while (i < glob.length) {
    const c = glob[i];

    if (c === "*") {
      if (glob[i + 1] === "*") {
        // ** -> match across directories
        re += ".*";
        i += 2;
      } else {
        // * -> match within a segment
        // If dot=false, avoid matching a leading dot for a segment wildcard
        re += dot ? "[^/]*" : "(?!\\.)[^/]*";
        i++;
      }
      continue;
    }

    if (c === "?") {
      re += dot ? "[^/]" : "(?!\\.)[^/]";
      i++;
      continue;
    }

    if (c === "[") {
      const { src, newIndex } = parseCharClass(glob, i);
      re += src;
      i = newIndex;
      continue;
    }

    if (c === "\\") {
      // escape next char literally
      if (i + 1 < glob.length) {
        re += escapeRegex(glob[i + 1]);
        i += 2;
      } else {
        re += "\\\\";
        i++;
      }
      continue;
    }

    // Path separator
    if (c === "/") {
      re += "/";
      i++;
      continue;
    }

    // Ordinary character
    re += escapeRegex(c);
    i++;
  }

  re += "$";
  const flags = caseSensitive ? "" : "i";
  return new RegExp(re, flags);
}

function parseCharClass(glob: string, start: number): { src: string; newIndex: number } {
  let i = start + 1;
  let negate = false;
  if (glob[i] === "!") {
    negate = true;
    i++;
  }
  // Edge case: literal ']' at start of class
  let content = "";
  if (glob[i] === "]") {
    content += "\\]";
    i++;
  }
  while (i < glob.length && glob[i] !== "]") {
    const ch = glob[i];
    if (ch === "\\") {
      // take the next char literally
      if (i + 1 < glob.length) {
        content += "\\" + glob[i + 1];
        i += 2;
      } else {
        content += "\\\\";
        i++;
      }
    } else if ("^$.|+(){}".includes(ch)) {
      content += "\\" + ch;
      i++;
    } else {
      content += ch;
      i++;
    }
  }
  // If no closing ']', treat the '[' literally
  if (i >= glob.length || glob[i] !== "]") {
    return { src: "\\[", newIndex: start + 1 };
  }
  const close = glob[i]; // ']'
  i++;

  const cls = "[" + (negate ? "^" : "") + content + close;
  return { src: cls, newIndex: i };
}

function escapeRegex(ch: string): string {
  return /[\\^$.*+?()[\]{}|]/.test(ch) ? "\\" + ch : ch;
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

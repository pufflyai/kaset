/**
 * Split a POSIX-like path into normalized segments.
 * - trims whitespace
 * - removes empty and '.' segments
 * - resolves '..' by popping a segment when possible
 */
export function normalizeSegments(p: string): string[] {
  const out: string[] = [];

  for (const part of p.split("/")) {
    const s = part.trim();
    if (!s || s === ".") continue;
    if (s === "..") {
      if (out.length) out.pop();
      continue;
    }
    out.push(s);
  }

  return out;
}

/** Join segments with single slashes, removing empties. */
export function normalizeSlashes(p: string): string {
  return p.split("/").filter(Boolean).join("/");
}

/** Join two path segments with normalization. */
export function joinPath(a: string, b: string): string {
  if (!a) return normalizeSlashes(b);
  if (!b) return normalizeSlashes(a);
  return normalizeSlashes(a + "/" + b);
}

/** Return the parent directory portion of a path. */
export function parentOf(p: string): string {
  const i = p.lastIndexOf("/");
  return i === -1 ? "" : p.slice(0, i);
}

/** Return the basename (filename) portion of a path. */
export function basename(p: string): string {
  const i = p.lastIndexOf("/");
  return i === -1 ? p : p.slice(i + 1);
}

/** Detect `..` traversal in a path string (browser-friendly). */
export function hasParentTraversal(p?: string): boolean {
  if (!p) return false;
  const s = p.replace(/\\/g, "/");
  return /(?:^|\/)\.\.(?:\/|$)/.test(s);
}

/** Check if `pathToCheck` is within `rootDirectory` using normalized segments. */
export function isWithinRoot(pathToCheck: string, rootDirectory: string): boolean {
  const p = normalizeSegments(pathToCheck).join("/");
  const r = normalizeSegments(rootDirectory).join("/");

  if (!r) return true;
  if (p === r) return true;
  return p.startsWith(r + "/");
}

/** Join a relative path under a workspace; throws if it escapes the workspace. */
export function joinUnderWorkspace(workspaceDir: string, rel: string): string {
  const base = normalizeSegments(workspaceDir).join("/");
  const child = normalizeSegments(rel).join("/");
  const full = base ? `${base}/${child}` : child;

  if (!isWithinRoot(full, base)) {
    throw new Error(`Path escapes workspace: "${rel}" not under "${workspaceDir}"`);
  }

  return full || ".";
}

import { joinPath, normalizeSlashes } from "../utils/path";
import { getFileHandle, resolveSubdir } from "../shared";

export type Ctx = { cwd: string; onChunk?: (s: string) => void };

export function unquote(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

export function escapeLiteral(s: string): string {
  return s.replace(/[\\*?[\]{}()!+@]/g, (m) => "\\" + m);
}

export async function resolveAsDir(path: string, ctx: Ctx): Promise<{ full: string }> {
  const full = normalizeSlashes(joinPath(ctx.cwd, path));
  await resolveSubdir(full, /*create*/ false);
  return { full };
}

export async function resolveAsFile(ctx: Ctx, filePath: string): Promise<{ full: string }> {
  const relPath = normalizeSlashes(joinPath(ctx.cwd, filePath));
  await getFileHandle(relPath, /*create*/ false);
  return { full: relPath };
}

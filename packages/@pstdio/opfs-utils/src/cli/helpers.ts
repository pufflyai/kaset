import { basename, joinPath, normalizeSlashes, parentOf } from "../utils/path";

export type Ctx = { root: FileSystemDirectoryHandle; cwd: string; onChunk?: (s: string) => void };

export function unquote(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

export function escapeLiteral(s: string): string {
  return s.replace(/[\\*?[\]{}()!+@]/g, (m) => "\\" + m);
}

export async function resolveAsDir(path: string, ctx: Ctx): Promise<{ dir: FileSystemDirectoryHandle; full: string }> {
  const full = normalizeSlashes(joinPath(ctx.cwd, path));
  const dir = await getDir(ctx.root, full);
  return { dir, full };
}

export async function resolveAsFile(
  ctx: Ctx,
  filePath: string,
): Promise<{ dir: FileSystemDirectoryHandle; rel: { path: string } }> {
  const relPath = normalizeSlashes(joinPath(ctx.cwd, filePath));
  const parent = parentOf(relPath);
  const base = basename(relPath);
  const dir = await getDir(ctx.root, parent);
  await dir.getFileHandle(base, { create: false });
  return { dir, rel: { path: base } };
}

export async function resolveAsDirOrFile(
  ctx: Ctx,
  inputPath: string,
): Promise<{ dir: FileSystemDirectoryHandle; rel: { path: string; kind: "file" | "directory" } }> {
  const full = normalizeSlashes(joinPath(ctx.cwd, inputPath));
  try {
    const dir = await getDir(ctx.root, full);
    return { dir, rel: { path: ".", kind: "directory" } };
  } catch {
    const parent = parentOf(full);
    const base = basename(full);
    const dir = await getDir(ctx.root, parent);
    await dir.getFileHandle(base, { create: false });
    return { dir, rel: { path: base, kind: "file" } };
  }
}

export async function getDir(root: FileSystemDirectoryHandle, path: string): Promise<FileSystemDirectoryHandle> {
  const segs = path ? path.split("/").filter((s) => s && s !== ".") : [];
  let cur = root;
  for (const s of segs) cur = await cur.getDirectoryHandle(s, { create: false });
  return cur;
}

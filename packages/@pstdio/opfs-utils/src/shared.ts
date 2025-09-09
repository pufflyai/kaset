import { basename, parentOf, normalizeSegments } from "./utils/path";

export async function getOPFSRoot(): Promise<FileSystemDirectoryHandle> {
  const storage = (typeof navigator !== "undefined" ? navigator.storage : undefined) as StorageManager | undefined;
  const getDir = storage?.getDirectory as undefined | (() => Promise<FileSystemDirectoryHandle>);

  if (typeof getDir !== "function") {
    throw new Error("OPFS is not supported (navigator.storage.getDirectory unavailable).");
  }

  return getDir.call(storage);
}

export async function getDirectoryHandle(path = ""): Promise<FileSystemDirectoryHandle> {
  const root = await getOPFSRoot();

  if (!path) return root;

  const segments = path.replace(/\\/g, "/").split("/").filter(Boolean);

  let dir = root;

  for (const seg of segments) {
    dir = await dir.getDirectoryHandle(seg, { create: false });
  }

  return dir;
}

/** Resolve a subdirectory under a provided root. Creates directories when `create` is true. */
export async function resolveSubdir(
  root: FileSystemDirectoryHandle,
  subdir: string,
  create = false,
): Promise<FileSystemDirectoryHandle> {
  if (!subdir) return root;

  const segs = normalizeSegments(subdir);

  let cur = root;

  for (const s of segs) {
    cur = await cur.getDirectoryHandle(s, { create });
  }

  return cur;
}

/** Get (and optionally create) a directory for a path string relative to `root`. */
export async function getDirHandle(
  root: FileSystemDirectoryHandle,
  path: string,
  create: boolean,
): Promise<FileSystemDirectoryHandle> {
  if (!path) return root;

  const segs = normalizeSegments(path);

  let cur = root;

  for (const s of segs) {
    cur = await cur.getDirectoryHandle(s, { create });
  }

  return cur;
}

/** Get a FileSystemFileHandle (optionally creating) relative to `root`. */
export async function getFileHandle(
  root: FileSystemDirectoryHandle,
  path: string,
  create: boolean,
): Promise<FileSystemFileHandle> {
  const dir = await getDirHandle(root, parentOf(path), create);
  return await dir.getFileHandle(basename(path), { create });
}

/** Read a text file or return null if it doesn't exist. */
export async function readTextFileOptional(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<string | null> {
  try {
    const fh = await getFileHandle(root, path, false);
    const file = await fh.getFile();
    return await file.text();
  } catch (e: any) {
    if (e && (e.name === "NotFoundError" || e.code === 1)) return null;
    throw e;
  }
}

/** Write text file (mkdir -p as needed). */
export async function writeTextFile(
  root: FileSystemDirectoryHandle,
  path: string,
  content: string,
): Promise<void> {
  const dir = await getDirHandle(root, parentOf(path), true);
  const fh = await dir.getFileHandle(basename(path), { create: true });
  const w = await fh.createWritable();
  try {
    await w.write(content);
  } finally {
    await w.close();
  }
}

/** Delete a file if present (no-op when missing). */
export async function safeDelete(root: FileSystemDirectoryHandle, path: string): Promise<void> {
  const dir = await getDirHandle(root, parentOf(path), false).catch(() => null as unknown as FileSystemDirectoryHandle);
  if (!dir) return;
  try {
    await dir.removeEntry(basename(path));
  } catch (e: any) {
    if (!(e && (e.name === "NotFoundError" || e.code === 1))) throw e;
  }
}

/**
 * Strip ANSI/VT100 escape sequences from a string.
 * Useful to sanitize copy/pasted colored diffs or terminal-styled inputs.
 */
export function stripAnsi(s: string): string {
  if (typeof s !== "string") return s as unknown as string;
  // Regex adapted to cover ESC (\u001B) and CSI (\u009B) sequences commonly used for styling
  // and links in terminals. Intentionally broad but safe for textual content.
  // eslint-disable-next-line no-control-regex
  const re = /[\u001B\u009B][[()#;?]*(?:\d{1,4}(?:;\d{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
  return s.replace(re, "");
}

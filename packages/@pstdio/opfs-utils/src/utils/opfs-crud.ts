import { getOPFSRoot, stripAnsi } from "../shared";

/** Normalize to POSIX-ish, strip leading slashes. */
function normalizeRelPath(p: string): string {
  // Sanitize terminal escape sequences that may have leaked into paths
  // from colored CLI output or copy/paste.
  const cleaned = stripAnsi(p);
  return cleaned.replace(/\\/g, "/").replace(/^\/+/, "").trim();
}

/** Walk to the parent directory of a path. */
async function getParentDirHandle(
  root: FileSystemDirectoryHandle,
  path: string,
  create: boolean,
): Promise<FileSystemDirectoryHandle> {
  const segs = normalizeRelPath(path).split("/").filter(Boolean);

  let dir = root;
  for (const segment of segs.slice(0, -1)) {
    dir = await dir.getDirectoryHandle(segment, { create });
  }

  return dir;
}

/**
 * Read a file from OPFS and return its text content.
 * Throws DOMException(NotFoundError) if path is missing.
 */
export const readFile = async (path: string): Promise<string> => {
  const root = await getOPFSRoot();
  const normalized = normalizeRelPath(path);

  const dir = await getParentDirHandle(root, normalized, /*create*/ false);
  const base = normalized.split("/").pop()!;

  const fh = await dir.getFileHandle(base, { create: false });
  const f = await fh.getFile();

  return f.text();
};

/**
 * Write a text file to OPFS, creating parent directories as needed.
 * Overwrites if the file already exists.
 */
export const writeFile = async (path: string, contents: string): Promise<void> => {
  const root = await getOPFSRoot();
  const normalized = normalizeRelPath(path);

  const dir = await getParentDirHandle(root, normalized, /*create*/ true);
  const base = normalized.split("/").pop()!;

  const fh = await dir.getFileHandle(base, { create: true });
  const w = await fh.createWritable();

  try {
    await w.write(contents);
  } finally {
    await w.close();
  }
};

/**
 * Delete a file from OPFS.
 * Throws DOMException(NotFoundError) if path is missing.
 */
export const deleteFile = async (path: string): Promise<void> => {
  const root = await getOPFSRoot();
  const normalized = normalizeRelPath(path);

  const dir = await getParentDirHandle(root, normalized, /*create*/ false);
  const base = normalized.split("/").pop()!;

  await dir.removeEntry(base);
};

/**
 * Trigger a browser download of a file stored in OPFS.
 * Requires a DOM environment (window/document).
 */
export const downloadFile = async (path: string): Promise<void> => {
  const root = await getOPFSRoot();
  const normalized = normalizeRelPath(path);

  const dir = await getParentDirHandle(root, normalized, /*create*/ false);
  const base = normalized.split("/").pop()!;

  const fh = await dir.getFileHandle(base, { create: false });
  const file = await fh.getFile();

  if (typeof document === "undefined") {
    throw new Error("downloadFile requires a DOM environment (window/document).");
  }

  const url = URL.createObjectURL(file);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = base;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
};

/**
 * Move (rename) a file within OPFS.
 * - Creates destination directories as needed.
 * - Overwrites the destination if it exists.
 * - Uses copy+delete for broad compatibility.
 */
export const moveFile = async (fromPath: string, toPath: string): Promise<void> => {
  const root = await getOPFSRoot();

  const from = normalizeRelPath(fromPath);
  const to = normalizeRelPath(toPath);

  if (!from) throw new Error("moveFile: 'fromPath' is empty");
  if (!to) throw new Error("moveFile: 'toPath' is empty");
  if (from === to) return; // no-op

  const fromDir = await getParentDirHandle(root, from, /*create*/ false);
  const toDir = await getParentDirHandle(root, to, /*create*/ true);

  const fromBase = from.split("/").pop()!;
  const toBase = to.split("/").pop()!;

  // Try native move if available (experimental in some browsers)
  const fh = await fromDir.getFileHandle(fromBase, { create: false });
  const maybeMove = (fh as any)?.move;

  if (typeof maybeMove === "function") {
    await maybeMove.call(fh, toDir as any, toBase);
    return;
  }

  // Fallback: copy bytes then delete source
  const file = await fh.getFile();
  const destHandle = await toDir.getFileHandle(toBase, { create: true });
  const writable = await destHandle.createWritable({ keepExistingData: false } as any);

  try {
    const buf = await file.arrayBuffer();
    await writable.write(buf);
  } finally {
    await writable.close();
  }

  await fromDir.removeEntry(fromBase);
};

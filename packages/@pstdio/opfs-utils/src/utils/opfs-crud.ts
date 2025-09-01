import { getOPFSRoot } from "../shared";

/** Normalize to POSIX-ish, strip leading slashes. */
function normalizeRelPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\/+/, "").trim();
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
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
};

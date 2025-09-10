import * as migrated from "./shared.migrated";

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
export async function resolveSubdir(_: FileSystemDirectoryHandle, subdir: string, create = false) {
  return migrated.resolveSubdir(subdir, create);
}

/** Get (and optionally create) a directory for a path string relative to `root`. */
export async function getDirHandle(_: FileSystemDirectoryHandle, path: string, create: boolean) {
  return migrated.getDirHandle(path, create);
}

/** Get a FileSystemFileHandle (optionally creating) relative to `root`. */
export async function getFileHandle(_: FileSystemDirectoryHandle, path: string, create: boolean) {
  await migrated.getFileHandle(path, create);
}

/** Read a text file or return null if it doesn't exist. */
export async function readTextFileOptional(_: FileSystemDirectoryHandle, path: string): Promise<string | null> {
  return migrated.readTextFileOptional(path);
}

/** Write text file (mkdir -p as needed). */
export async function writeTextFile(_: FileSystemDirectoryHandle, path: string, content: string) {
  await migrated.writeTextFile(path, content);
}

/** Delete a file if present (no-op when missing). */
export async function safeDelete(_: FileSystemDirectoryHandle, path: string) {
  await migrated.safeDelete(path);
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

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

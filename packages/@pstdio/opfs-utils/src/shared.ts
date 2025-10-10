import { getFs } from "./adapter/fs";
import { normalizeSegments, parentOf } from "./utils/path";

export type BinaryLike = ArrayBuffer | SharedArrayBuffer | ArrayBufferView | Blob | Uint8Array;

function isSharedArrayBuffer(value: unknown): value is SharedArrayBuffer {
  return typeof SharedArrayBuffer !== "undefined" && value instanceof SharedArrayBuffer;
}

function isBlob(value: unknown): value is Blob {
  return typeof Blob !== "undefined" && value instanceof Blob;
}

export async function ensureUint8Array(content: BinaryLike): Promise<Uint8Array> {
  if (content instanceof Uint8Array) return content;
  if (isSharedArrayBuffer(content)) return new Uint8Array(content);
  if (content instanceof ArrayBuffer) return new Uint8Array(content);
  if (ArrayBuffer.isView(content)) {
    return new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
  }
  if (isBlob(content)) {
    const buffer = await content.arrayBuffer();
    return new Uint8Array(buffer);
  }
  throw new TypeError("Unsupported binary content type");
}

function toAbsolutePath(p: string) {
  const norm = normalizeSegments(p.replace(/\\/g, "/")).join("/");
  return "/" + norm;
}

async function ensureParentDirectories(fs: typeof import("@zenfs/core").fs, path: string) {
  const dir = toAbsolutePath(parentOf(path));
  if (dir === "/") return dir;
  try {
    await fs.promises.mkdir?.(dir, { recursive: true });
  } catch (error: any) {
    if (error && error.code !== "EEXIST" && error.name !== "InvalidModificationError") {
      throw error;
    }
  }
  return dir;
}

export async function ensureDirExists(targetDir: string, create: boolean) {
  const fs = await getFs();

  if (create) {
    await (fs.promises as any).mkdir?.(targetDir, { recursive: true });
    return;
  }

  try {
    const st = await fs.promises.stat(targetDir);
    if (!st.isDirectory()) {
      const err = new Error(`Not a directory: ${targetDir}`) as any;
      err.name = "TypeMismatchError";
      throw err;
    }
  } catch (e: any) {
    // Normalize ENOENT into a DOM-like NotFoundError for compatibility.
    if (e && (e.code === "ENOENT" || e.name === "NotFoundError")) {
      const err = new Error(`Directory not found: ${targetDir}`) as any;
      err.name = "NotFoundError";
      throw err;
    }
    throw e;
  }
}

export async function getDirectoryHandle(path = "") {
  const dir = toAbsolutePath(path || "");
  if (dir === "/") return dir;
  await ensureDirExists(dir, /*create*/ false);
  return dir;
}

/** Resolve a subdirectory under the OPFS root. Creates directories when `create` is true. */
export async function resolveSubdir(subdir: string, create = false) {
  const dir = toAbsolutePath(subdir || "");
  if (dir === "/") return dir;
  await ensureDirExists(dir, create);
  return dir;
}

/** Get (and optionally create) a directory for a path string relative to root. */
export async function getDirHandle(path: string, create: boolean) {
  const dir = toAbsolutePath(path || "");
  if (dir === "/") return dir;
  await ensureDirExists(dir, create);
  return dir;
}

/** Get a file path (optionally creating) relative to root. */
export async function getFileHandle(path: string, create: boolean) {
  const fs = await getFs();
  const absPath = toAbsolutePath(path);
  const dir = toAbsolutePath(parentOf(path));

  if (create) {
    await (fs.promises as any).mkdir?.(dir, { recursive: true });
    // Touch the file to ensure it exists
    await fs.promises.writeFile(absPath, "", "utf8").catch(async (e: any) => {
      if (e && e.code !== "EISDIR") throw e;
    });
    return absPath;
  }

  try {
    const st = await fs.promises.stat(absPath);
    if (!st.isFile()) {
      const err = new Error(`Not a file: ${absPath}`);
      err.name = "TypeMismatchError";
      throw err;
    }
    return absPath;
  } catch (e: any) {
    if (e && (e.code === "ENOENT" || e.name === "NotFoundError")) {
      const err = new Error(`File not found: ${absPath}`);
      err.name = "NotFoundError";
      throw err;
    }
    throw e;
  }
}

/** Read a text file or return null if it doesn't exist. */
export async function readTextFileOptional(path: string): Promise<string | null> {
  const fs = await getFs();
  const absPath = toAbsolutePath(path);
  try {
    const text = await fs.promises.readFile(absPath, "utf8");
    return text;
  } catch (e: any) {
    if (e && (e.code === "ENOENT" || e.name === "NotFoundError" || e.code === 1)) return null;
    throw e;
  }
}

export async function readBinaryFileOptional(path: string): Promise<Uint8Array | null> {
  const fs = await getFs();
  const absPath = toAbsolutePath(path);
  try {
    const result = await fs.promises.readFile(absPath);
    return result instanceof Uint8Array ? result : new Uint8Array(result);
  } catch (e: any) {
    if (e && (e.code === "ENOENT" || e.name === "NotFoundError" || e.code === 1)) return null;
    throw e;
  }
}

/** Write text file (mkdir -p as needed). */
export async function writeTextFile(path: string, content: string) {
  const fs = await getFs();
  const absPath = toAbsolutePath(path);
  await ensureParentDirectories(fs, path);
  await fs.promises.writeFile(absPath, content, "utf8");
}

export async function writeBinaryFile(path: string, content: BinaryLike) {
  const fs = await getFs();
  const absPath = toAbsolutePath(path);
  await ensureParentDirectories(fs, path);
  const bytes = await ensureUint8Array(content);
  await fs.promises.writeFile(absPath, bytes);
}

/** Delete a file if present (no-op when missing). */
export async function safeDelete(path: string) {
  const fs = await getFs();
  const absPath = toAbsolutePath(path);
  try {
    await fs.promises.unlink(absPath);
  } catch (e: any) {
    if (e && (e.code === "ENOENT" || e.name === "NotFoundError" || e.code === 1)) return;
    throw e;
  }
}

/**
 * Strip ANSI/VT100 escape sequences from a string.
 * Useful to sanitize copy/pasted colored diffs or terminal-styled inputs.
 */
export function stripAnsi(s: string) {
  if (typeof s !== "string") return s as unknown as string;
  // Regex adapted to cover ESC (\u001B) and CSI (\u009B) sequences commonly used for styling
  // and links in terminals. Intentionally broad but safe for textual content.
  // eslint-disable-next-line no-control-regex
  const re = /[\u001B\u009B][[()#;?]*(?:\d{1,4}(?:;\d{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
  return s.replace(re, "");
}

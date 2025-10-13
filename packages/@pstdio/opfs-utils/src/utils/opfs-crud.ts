import { getFs } from "../adapter/fs";
import {
  ensureUint8Array,
  getDirHandle,
  getFileHandle,
  readBinaryFileOptional,
  readTextFileOptional,
  safeDelete,
  writeBinaryFile,
  writeTextFile,
} from "../shared";
import { basename, joinPath, normalizeRelPath, parentOf } from "./path";

import type { BinaryLike } from "../shared";

type TextEncoding = "utf8" | "utf-8";

export interface ReadFileOptions {
  encoding?: TextEncoding | null;
}

export interface WriteFileOptions {
  encoding?: TextEncoding | null;
}

function isTextEncoding(encoding: string | null | undefined): encoding is TextEncoding {
  return encoding === "utf8" || encoding === "utf-8";
}

export type { BinaryLike };

async function removeDirectory(path: string): Promise<void> {
  const normalized = normalizeRelPath(path);
  if (!normalized) return;

  const fs = await getFs();
  const absPath = "/" + normalized;

  const { rm, rmdir } = fs.promises as unknown as {
    rm?: (path: string, options?: { recursive?: boolean; force?: boolean }) => Promise<void>;
    rmdir?: (path: string) => Promise<void>;
  };

  if (typeof rm === "function") {
    try {
      if (rm.length >= 2) {
        await rm(absPath, { recursive: false });
      } else {
        await rm(absPath);
      }
      return;
    } catch (error: any) {
      const code = error?.code;
      const name = error?.name;
      if (code === "ENOENT" || code === 1 || name === "NotFoundError" || name === "NotFound") return;
      if (code === "ENOTEMPTY" || name === "InvalidModificationError") return;
      throw error;
    }
  }

  if (typeof rmdir === "function") {
    try {
      await rmdir(absPath);
    } catch (error: any) {
      const code = error?.code;
      const name = error?.name;
      if (code === "ENOENT" || code === 1 || name === "NotFoundError" || name === "NotFound") return;
      if (code === "ENOTEMPTY" || name === "InvalidModificationError") return;
      throw error;
    }
  }
}

async function listDirectory(absPath: string): Promise<string[]> {
  const fs = await getFs();

  try {
    const entries = await fs.promises.readdir(absPath);
    if (Array.isArray(entries)) return entries as string[];
    return [];
  } catch (error: any) {
    const code = error?.code;
    const name = error?.name;
    if (code === "ENOENT" || code === 1 || name === "NotFoundError" || name === "NotFound") return [];
    throw error;
  }
}

function notFound(path: string) {
  const Ctor: any = (globalThis as any).DOMException;
  try {
    return new Ctor(`File not found: ${path}`, "NotFoundError");
  } catch {
    const e: any = new Error(`File not found: ${path}`);
    e.name = "NotFoundError";
    return e;
  }
}

/**
 * Read a file from OPFS.
 * Returns text by default, or Uint8Array when encoding is null.
 * Throws DOMException(NotFoundError) if path is missing.
 */
export function readFile(path: string): Promise<string>;
export function readFile(path: string, options: ReadFileOptions & { encoding: null }): Promise<Uint8Array>;
export function readFile(path: string, options?: ReadFileOptions): Promise<string | Uint8Array>;
export async function readFile(path: string, options?: ReadFileOptions): Promise<string | Uint8Array> {
  const normalized = normalizeRelPath(path);
  const encoding = options?.encoding === undefined ? "utf8" : options.encoding;

  if (encoding === null) {
    const bytes = await readBinaryFileOptional(normalized);
    if (bytes === null) throw notFound(normalized);
    return bytes;
  }

  if (isTextEncoding(encoding)) {
    const text = await readTextFileOptional(normalized);
    if (text === null) throw notFound(normalized);
    return text;
  }

  throw new Error(`readFile: Unsupported encoding '${encoding}'`);
}

/**
 * Write a file to OPFS, creating parent directories as needed.
 * Text is written by default; pass encoding null (or binary data) for raw bytes.
 * Overwrites if the file already exists.
 */
export function writeFile(path: string, contents: string, options?: WriteFileOptions): Promise<void>;
export function writeFile(
  path: string,
  contents: BinaryLike,
  options?: WriteFileOptions & { encoding: null },
): Promise<void>;
export function writeFile(path: string, contents: string | BinaryLike, options?: WriteFileOptions): Promise<void>;
export async function writeFile(
  path: string,
  contents: string | BinaryLike,
  options?: WriteFileOptions,
): Promise<void> {
  const normalized = normalizeRelPath(path);
  const encoding = options?.encoding === undefined ? (typeof contents === "string" ? "utf8" : null) : options.encoding;

  if (encoding === null) {
    const bytes = typeof contents === "string" ? new TextEncoder().encode(contents) : await ensureUint8Array(contents);
    await writeBinaryFile(normalized, bytes);
    return;
  }

  if (isTextEncoding(encoding)) {
    const text =
      typeof contents === "string" ? contents : new TextDecoder("utf-8").decode(await ensureUint8Array(contents));
    await writeTextFile(normalized, text);
    return;
  }

  throw new Error(`writeFile: Unsupported encoding '${encoding}'`);
}

/**
 * Delete a file from OPFS.
 * Throws DOMException(NotFoundError) if path is missing.
 */
export const deleteFile = async (path: string): Promise<void> => {
  const normalized = normalizeRelPath(path);

  try {
    await getFileHandle(normalized, /*create*/ false);
  } catch {
    throw notFound(normalized);
  }

  await safeDelete(normalized);
};

async function deleteDirectoryContentsInternal(relPath: string): Promise<void> {
  const normalized = normalizeRelPath(relPath);
  const absPath = normalized ? `/${normalized}` : "/";

  const entries = await listDirectory(absPath);
  if (!entries.length) return;

  const fs = await getFs();

  for (const name of entries) {
    const childRel = joinPath(normalized, name);
    const childAbs = `/${normalizeRelPath(childRel)}`;

    let stat: any;
    try {
      stat = await fs.promises.stat(childAbs);
    } catch (error: any) {
      const code = error?.code;
      const errName = error?.name;
      if (code === "ENOENT" || code === 1 || errName === "NotFoundError" || errName === "NotFound") {
        continue;
      }
      throw error;
    }

    if (stat.isDirectory?.()) {
      await deleteDirectoryContentsInternal(childRel);
      await removeDirectory(childRel);
      continue;
    }

    await safeDelete(childRel);
  }
}

export const deleteDirectoryContents = async (path: string): Promise<void> => {
  await deleteDirectoryContentsInternal(path);
};

export const deleteDirectory = async (path: string): Promise<void> => {
  const normalized = normalizeRelPath(path);
  if (!normalized) return;

  await deleteDirectoryContentsInternal(normalized);
  await removeDirectory(normalized);
};

/**
 * Trigger a browser download of a file stored in OPFS.
 * Requires a DOM environment (window/document).
 */
export const downloadFile = async (path: string): Promise<void> => {
  const normalized = normalizeRelPath(path);

  if (typeof document === "undefined") {
    throw new Error("downloadFile requires a DOM environment (window/document).");
  }

  const text = await readTextFileOptional(normalized);
  if (text === null) throw notFound(normalized);

  const base = normalized.split("/").pop()!;
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
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
  const from = normalizeRelPath(fromPath);
  const to = normalizeRelPath(toPath);

  if (!from) throw new Error("moveFile: 'fromPath' is empty");
  if (!to) throw new Error("moveFile: 'toPath' is empty");
  if (from === to) return; // no-op

  const fromAbs = await getFileHandle(from, /*create*/ false);

  const destDirRel = parentOf(to);
  const destBase = basename(to);
  const destDirAbs = await getDirHandle(destDirRel, /*create*/ true);
  const toAbs = "/" + joinPath(destDirAbs, destBase);

  const fs = await getFs();
  try {
    await fs.promises.rename(fromAbs, toAbs);
  } catch {
    const data = await fs.promises.readFile(fromAbs);
    await fs.promises.writeFile(toAbs, data);
    await fs.promises.unlink(fromAbs);
  }
};

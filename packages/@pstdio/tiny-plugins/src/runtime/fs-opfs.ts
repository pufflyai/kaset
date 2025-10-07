import { configureSingle, fs as zenfs } from "@zenfs/core";
import { WebAccess } from "@zenfs/dom";

export interface ScopedFs {
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, contents: Uint8Array | string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  moveFile(from: string, to: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  mkdirp(path: string): Promise<void>;
  readJSON<T = unknown>(path: string): Promise<T>;
  writeJSON(path: string, value: unknown, pretty?: boolean): Promise<void>;
}

let initPromise: Promise<void> | null = null;
let configuredRoot: FileSystemDirectoryHandle | null = null;

function getOPFSRootGetter(): (() => Promise<FileSystemDirectoryHandle>) | null {
  if (typeof navigator === "undefined" || !navigator.storage) return null;

  const anyStorage = navigator.storage as StorageManager & {
    getDirectory?: () => Promise<FileSystemDirectoryHandle>;
  };

  return typeof anyStorage.getDirectory === "function" ? anyStorage.getDirectory.bind(navigator.storage) : null;
}

async function sameRoot(a: FileSystemDirectoryHandle | null, b: FileSystemDirectoryHandle): Promise<boolean> {
  if (!a) return false;

  const anyA = a as unknown as { isSameEntry?: (other: FileSystemDirectoryHandle) => Promise<boolean> };
  if (typeof anyA.isSameEntry === "function") {
    try {
      return await anyA.isSameEntry(b);
    } catch {
      // Ignore errors and fall back to reference comparison.
    }
  }

  return a === b;
}

async function ensureConfiguredFor(root: FileSystemDirectoryHandle): Promise<void> {
  if (await sameRoot(configuredRoot, root)) {
    if (initPromise) await initPromise;
    return;
  }

  if (initPromise) {
    await initPromise;
    if (await sameRoot(configuredRoot, root)) return;
  }

  initPromise = (async () => {
    try {
      await configureSingle({ backend: WebAccess, handle: root });
      configuredRoot = root;
    } finally {
      initPromise = null;
    }
  })();

  await initPromise;
}

async function getFs() {
  const getter = getOPFSRootGetter();
  if (!getter) {
    throw new Error("OPFS is not supported in this environment");
  }

  const root = await getter();
  await ensureConfiguredFor(root);
  return zenfs;
}

function normalizeSegment(segment: string): string {
  return segment.replace(/\\/g, "/").trim();
}

function normalizeBase(path: string): string[] {
  const segments = path.split("/");
  const out: string[] = [];

  for (const segment of segments) {
    const trimmed = normalizeSegment(segment);
    if (!trimmed || trimmed === ".") continue;
    if (trimmed === "..") {
      throw new Error(`Path escapes root: ${path}`);
    }
    out.push(trimmed);
  }

  return out;
}

function resolveRelative(base: string[], relative: string): string {
  const parts = relative.split("/");
  const stack = [...base];

  for (const part of parts) {
    const trimmed = normalizeSegment(part);
    if (!trimmed || trimmed === ".") continue;

    if (trimmed === "..") {
      if (stack.length <= base.length) {
        throw new Error(`Path escapes plugin root: ${relative}`);
      }

      stack.pop();
      continue;
    }

    stack.push(trimmed);
  }

  return stack.join("/");
}

function toAbsolute(posix: string) {
  return posix ? `/${posix}` : "/";
}

function parentOf(path: string) {
  const index = path.lastIndexOf("/");
  return index === -1 ? "" : path.slice(0, index);
}

function toUint8Array(data: Uint8Array | string): Uint8Array {
  if (typeof data === "string") {
    return new TextEncoder().encode(data);
  }

  return data;
}

async function readUint8(path: string) {
  const fs = await getFs();
  const buffer = await fs.promises.readFile(path);
  return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
}

async function writeUint8(path: string, contents: Uint8Array) {
  const fs = await getFs();
  await fs.promises.mkdir(parentOf(path) || "/", { recursive: true });
  await fs.promises.writeFile(path, contents);
}

async function removeFile(path: string) {
  const fs = await getFs();
  try {
    await fs.promises.unlink(path);
  } catch (error: any) {
    if (!error || (error.code !== "ENOENT" && error.name !== "NotFoundError")) {
      throw error;
    }
  }
}

async function ensureDir(path: string) {
  if (!path || path === "/") return;
  const fs = await getFs();
  await fs.promises.mkdir(path, { recursive: true });
}

async function pathExists(path: string) {
  const fs = await getFs();
  try {
    await fs.promises.stat(path);
    return true;
  } catch (error: any) {
    if (!error || (error.code !== "ENOENT" && error.name !== "NotFoundError")) {
      throw error;
    }
    return false;
  }
}

export function createScopedFs(rootPath: string): ScopedFs {
  const baseSegments = normalizeBase(rootPath);

  function resolve(path: string): string {
    if (!path) {
      return toAbsolute(baseSegments.join("/"));
    }

    const resolved = resolveRelative(baseSegments, path);
    return toAbsolute(resolved);
  }

  function resolveRelativePath(path: string): string {
    if (!path) return baseSegments.join("/");
    return resolveRelative(baseSegments, path);
  }

  return {
    async readFile(path: string) {
      const abs = resolve(path);
      return readUint8(abs);
    },

    async writeFile(path: string, contents: Uint8Array | string) {
      const abs = resolve(path);
      await writeUint8(abs, toUint8Array(contents));
    },

    async deleteFile(path: string) {
      const abs = resolve(path);
      await removeFile(abs);
    },

    async moveFile(from: string, to: string) {
      const fs = await getFs();
      const absFrom = resolve(from);
      const absTo = resolve(to);
      await ensureDir(toAbsolute(resolveRelativePath(parentOf(to))));
      try {
        await fs.promises.rename(absFrom, absTo);
      } catch {
        const data = await readUint8(absFrom);
        await writeUint8(absTo, data);
        await removeFile(absFrom);
      }
    },

    async exists(path: string) {
      const abs = resolve(path);
      return pathExists(abs);
    },

    async mkdirp(path: string) {
      const rel = resolveRelativePath(path);
      await ensureDir(toAbsolute(rel));
    },

    async readJSON<T = unknown>(path: string) {
      const bytes = await this.readFile(path);
      const text = new TextDecoder().decode(bytes);

      try {
        return JSON.parse(text) as T;
      } catch (error) {
        throw new Error(`Failed to parse JSON at ${resolveRelativePath(path)}: ${(error as Error).message}`);
      }
    },

    async writeJSON(path: string, value: unknown, pretty?: boolean) {
      const serialized = JSON.stringify(value, null, pretty ? 2 : undefined);
      await this.writeFile(path, serialized);
    },
  } satisfies ScopedFs;
}

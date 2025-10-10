import { ensureUint8Array, type BinaryLike } from "../shared";

class MemFileHandle {
  kind = "file" as const;
  name: string;
  private content: Uint8Array;

  constructor(name: string, content: Uint8Array = new Uint8Array(0)) {
    this.name = name;
    this.content = content;
  }

  async getFile(): Promise<File> {
    return new File([this.content.slice()], this.name);
  }

  async createWritable(opts: { keepExistingData?: boolean } = {}) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const handle = this;
    let position = 0;

    if (!opts.keepExistingData) {
      handle.content = new Uint8Array(0);
    }

    async function toUint8Array(input: unknown): Promise<Uint8Array> {
      if (typeof input === "string") {
        return new TextEncoder().encode(input);
      }

      if (input == null) {
        return new Uint8Array(0);
      }

      return ensureUint8Array(input as BinaryLike);
    }

    function truncateContent(content: Uint8Array, size: number) {
      if (size < content.length) {
        return content.slice(0, size);
      }

      if (size === content.length) {
        return content;
      }

      const next = new Uint8Array(size);
      next.set(content);
      return next;
    }

    function writeInto(content: Uint8Array, chunk: Uint8Array, offset: number) {
      const end = offset + chunk.length;
      const nextLength = Math.max(content.length, end);
      const next = new Uint8Array(nextLength);
      next.set(content);
      next.set(chunk, offset);
      return next;
    }

    return {
      async write(data: unknown) {
        if (data && typeof data === "object" && "type" in (data as any)) {
          const payload = data as { type: string; position?: number; size?: number; data?: unknown };

          if (payload.type === "seek") {
            position = Math.max(0, Number(payload.position) || 0);
            return;
          }

          if (payload.type === "truncate") {
            const size = Math.max(0, Number(payload.size) || 0);
            handle.content = truncateContent(handle.content, size);
            position = Math.min(position, handle.content.length);
            return;
          }

          if (payload.type === "write") {
            if (typeof payload.position === "number") {
              position = Math.max(0, Number(payload.position) || 0);
            }

            const chunk = await toUint8Array(payload.data);
            handle.content = writeInto(handle.content, chunk, position);
            position += chunk.length;
            return;
          }
        }

        const chunk = await toUint8Array(data);
        handle.content = writeInto(handle.content, chunk, position);
        position += chunk.length;
      },
      async seek(nextPosition: number) {
        position = Math.max(0, Number(nextPosition) || 0);
      },
      async close() {},
    };
  }
}

class MemDirHandle {
  kind = "directory" as const;
  name: string;
  private children: Map<string, MemDirHandle | MemFileHandle> = new Map();

  constructor(name: string) {
    this.name = name;
  }

  async *entries() {
    for (const [name, handle] of this.children) {
      yield [name, handle];
    }
  }

  async *keys() {
    for (const [name] of this.children) {
      yield name;
    }
  }

  async getDirectoryHandle(name: string, opts: { create?: boolean } = {}) {
    let handle = this.children.get(name);

    if (!handle) {
      if (!opts.create) throw createNotFoundError();
      handle = new MemDirHandle(name);
      this.children.set(name, handle);
    }

    if (handle.kind !== "directory") throw new Error("TypeMismatch");

    return handle;
  }

  async getFileHandle(name: string, opts: { create?: boolean } = {}) {
    let handle = this.children.get(name);

    if (!handle) {
      if (!opts.create) throw createNotFoundError();
      handle = new MemFileHandle(name);
      this.children.set(name, handle);
    }

    if (handle.kind !== "file") throw new Error("TypeMismatch");

    return handle;
  }

  async removeEntry(name: string) {
    this.children.delete(name);
  }
}

export function setupTestOPFS() {
  const root = new MemDirHandle("");

  Object.defineProperty(globalThis, "navigator", {
    value: {
      storage: {
        getDirectory: async () => root,
      },
    },
    configurable: true,
  });

  return root;
}

export async function writeFile(root: any, path: string, content: string) {
  const parts = path.split("/");
  let dir = root as MemDirHandle;

  for (let i = 0; i < parts.length - 1; i++) {
    dir = await dir.getDirectoryHandle(parts[i], { create: true });
  }

  const file = await dir.getFileHandle(parts[parts.length - 1], { create: true });
  const writable = await file.createWritable();
  await writable.write(content);
  await writable.close();
}

export type TestDirHandle = MemDirHandle;
export type TestFileHandle = MemFileHandle;

function createNotFoundError(): any {
  const Ctor: any = (globalThis as any).DOMException;
  if (typeof Ctor === "function") {
    try {
      return new Ctor("NotFound", "NotFoundError");
    } catch {
      // fall through
    }
  }
  const e: any = new Error("NotFound");
  e.name = "NotFoundError";
  return e;
}

export async function getOPFSRoot(): Promise<FileSystemDirectoryHandle> {
  const storage = (typeof navigator !== "undefined" ? navigator.storage : undefined) as StorageManager | undefined;
  const getDir = storage?.getDirectory as undefined | (() => Promise<FileSystemDirectoryHandle>);

  if (typeof getDir !== "function") {
    throw new Error("OPFS is not supported (navigator.storage.getDirectory unavailable).");
  }

  return getDir.call(storage);
}

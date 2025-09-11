class MemFileHandle {
  kind = "file" as const;
  name: string;
  private content: string;

  constructor(name: string, content = "") {
    this.name = name;
    this.content = content;
  }

  async getFile(): Promise<File> {
    return new File([this.content], this.name);
  }

  async createWritable(opts: { keepExistingData?: boolean } = {}) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const handle = this;
    let pos = 0;

    if (!opts.keepExistingData) {
      handle.content = "";
    }

    function decodeToString(input: unknown): string {
      if (typeof input === "string") return input;
      if (input instanceof ArrayBuffer) return new TextDecoder().decode(new Uint8Array(input));
      if (typeof SharedArrayBuffer !== "undefined" && input instanceof SharedArrayBuffer)
        return new TextDecoder().decode(new Uint8Array(input as SharedArrayBuffer));
      if (ArrayBuffer.isView(input as any)) {
        const v = input as ArrayBufferView;
        return new TextDecoder().decode(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
      }
      throw new TypeError("Unsupported data type for write");
    }

    return {
      async write(data: unknown) {
        // Handle FileSystemWritableFileStream-like param objects
        if (data && typeof data === "object" && (data as any).type) {
          const p = data as any;
          if (p.type === "seek") {
            pos = Math.max(0, Number(p.position) || 0);
            return;
          }
          if (p.type === "truncate") {
            const size = Math.max(0, Number(p.size) || 0);
            handle.content = handle.content.slice(0, size);
            pos = Math.min(pos, size);
            return;
          }
          if (p.type === "write") {
            const payload = p.data;
            const chunk = decodeToString(payload);
            const before = handle.content.slice(0, pos);
            const after = handle.content.slice(pos + chunk.length);
            handle.content = before + chunk + after;
            pos += chunk.length;
            return;
          }
        }

        const text = decodeToString(data);
        // Default semantics: overwrite from current position
        const before = handle.content.slice(0, pos);
        const after = handle.content.slice(pos + text.length);
        handle.content = before + text + after;
        pos += text.length;
      },
      async seek(position: number) {
        pos = Math.max(0, Number(position) || 0);
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

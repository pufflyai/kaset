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

  async createWritable() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const handle = this;
    return {
      async write(data: string | ArrayBuffer) {
        handle.content = typeof data === "string" ? data : new TextDecoder().decode(data as ArrayBuffer);
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

  async getDirectoryHandle(name: string, opts: { create?: boolean } = {}) {
    let handle = this.children.get(name);

    if (!handle) {
      if (!opts.create) throw Object.assign(new Error("NotFound"), { name: "NotFoundError" });
      handle = new MemDirHandle(name);
      this.children.set(name, handle);
    }

    if (handle.kind !== "directory") throw new Error("TypeMismatch");

    return handle;
  }

  async getFileHandle(name: string, opts: { create?: boolean } = {}) {
    let handle = this.children.get(name);

    if (!handle) {
      if (!opts.create) throw Object.assign(new Error("NotFound"), { name: "NotFoundError" });
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

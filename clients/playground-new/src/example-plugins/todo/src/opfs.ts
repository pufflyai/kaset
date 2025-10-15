const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

export interface TinyFsEntry {
  path: string;
  name: string;
  kind: "file" | "directory";
  depth: number;
  size?: number;
  lastModified?: number;
}

export interface TinyFsDirSnapshot {
  dir: string;
  entries: TinyFsEntry[];
  signature?: string;
  generatedAt?: number;
}

interface TinyHostFs {
  readFile(path: string): Promise<Uint8Array | string | ArrayBuffer | ArrayBufferView>;
  writeFile(path: string, data: Uint8Array | string): Promise<unknown>;
  deleteFile?(path: string): Promise<unknown>;
  mkdirp?(path: string): Promise<unknown>;
  dirSnapshot?(dir?: string): Promise<TinyFsDirSnapshot>;
  ls?(dir?: string): Promise<TinyFsEntry[]>;
}

interface TinyHost {
  fs?: TinyHostFs | null;
  call?(method: string, params?: Record<string, unknown>): Promise<unknown>;
}

export interface TodoFileEntry {
  name: string;
  path: string;
  kind: "file" | "directory";
  lastModified?: number;
  size?: number;
}

export interface TodoDirectorySnapshot {
  entries: TodoFileEntry[];
  signature: string;
}

export interface TodoHostHelpers {
  ensureDir(path: string): Promise<void>;
  listFiles(path: string): Promise<TodoFileEntry[]>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, contents: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  watchDirectory(
    path: string,
    callback: (snapshot: TodoDirectorySnapshot) => void,
    options?: { intervalMs?: number; emitInitial?: boolean; signal?: AbortSignal },
  ): Promise<() => void>;
}

const isArrayBufferView = (value: unknown): value is ArrayBufferView =>
  Boolean(value) && ArrayBuffer.isView(value as ArrayBufferView);

function toUint8Array(value: Uint8Array | string) {
  if (typeof value === "string") {
    return textEncoder.encode(value);
  }
  if (value instanceof Uint8Array) {
    return value;
  }
  return new Uint8Array(value);
}

function decodeBytes(value: Uint8Array | string | ArrayBuffer | ArrayBufferView) {
  if (typeof value === "string") return value;
  if (value instanceof Uint8Array) return textDecoder.decode(value);
  if (value instanceof ArrayBuffer) return textDecoder.decode(new Uint8Array(value));
  if (isArrayBufferView(value)) return textDecoder.decode(new Uint8Array(value.buffer));
  throw new Error("Tiny UI host returned unsupported data payload");
}

function ensureFs(host: TinyHost | null | undefined): TinyHostFs {
  if (!host?.fs) {
    throw new Error("Tiny UI host fs adapter is unavailable");
  }
  return host.fs;
}

function ensureDirSnapshot(host: TinyHost, fs: TinyHostFs): (dir: string) => Promise<TinyFsDirSnapshot> {
  if (typeof fs.dirSnapshot === "function") {
    return (dir: string) => fs.dirSnapshot?.(dir ?? "") ?? Promise.resolve({ dir: "", entries: [] });
  }

  if (typeof host.call === "function") {
    return async (dir: string) => {
      const result = await host.call!("fs.dirSnapshot", { dir });
      if (!result || typeof result !== "object") {
        throw new Error("Tiny UI host returned an invalid dirSnapshot response");
      }
      const snapshot = result as TinyFsDirSnapshot;
      snapshot.entries = Array.isArray(snapshot.entries) ? snapshot.entries : [];
      snapshot.signature = snapshot.signature ?? createSignature(snapshot.entries);
      return snapshot;
    };
  }

  if (typeof fs.ls === "function") {
    return async (dir: string) => {
      const entries = await fs.ls?.(dir ?? "");
      const normalized = Array.isArray(entries) ? entries : [];
      return { dir, entries: normalized, signature: createSignature(normalized), generatedAt: Date.now() };
    };
  }

  throw new Error("Tiny UI host does not expose fs.dirSnapshot or a compatible alternative");
}

function createSignature(entries: TinyFsEntry[]) {
  if (!Array.isArray(entries) || entries.length === 0) return "0";
  return entries
    .slice()
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    .map((entry) => {
      const modified = entry.lastModified == null ? "" : String(entry.lastModified);
      const size = entry.size == null ? "" : String(entry.size);
      return `${entry.path}|${entry.kind}|${modified}|${size}`;
    })
    .join(";");
}

function toTodoEntries(entries: TinyFsEntry[]): TodoFileEntry[] {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((entry) => entry.kind === "file" && entry.depth === 1)
    .map((entry) => ({
      name: entry.name,
      path: entry.path,
      kind: entry.kind,
      lastModified: entry.lastModified,
      size: entry.size,
    }));
}

export function createTodoHostHelpers(host: TinyHost): TodoHostHelpers {
  const fs = ensureFs(host);
  const dirSnapshot = ensureDirSnapshot(host, fs);

  const ensureDir = async (path: string) => {
    if (typeof fs.mkdirp !== "function") {
      throw new Error("Tiny UI host fs.mkdirp is not available");
    }
    await fs.mkdirp(path);
  };

  const listFiles = async (path: string) => {
    const snapshot = await dirSnapshot(path);
    const entries = toTodoEntries(snapshot.entries);
    return entries.sort((a, b) => a.name.localeCompare(b.name));
  };

  const readFile = async (path: string) => {
    const contents = await fs.readFile(path);
    return decodeBytes(contents);
  };

  const writeFile = async (path: string, contents: string) => {
    await fs.writeFile(path, toUint8Array(contents));
  };

  const deleteFile = async (path: string) => {
    if (typeof fs.deleteFile !== "function") {
      throw new Error("Tiny UI host fs.deleteFile is not available");
    }
    await fs.deleteFile(path);
  };

  const watchDirectory = async (
    path: string,
    callback: (snapshot: TodoDirectorySnapshot) => void,
    options: { intervalMs?: number; emitInitial?: boolean; signal?: AbortSignal } = {},
  ) => {
    const intervalMs = Math.max(250, options.intervalMs ?? 1500);
    const signal = options.signal;

    if (signal?.aborted) {
      return () => undefined;
    }

    let stopped = false;
    let initialized = false;
    let lastSignature: string | null = null;

    const emitSnapshot = async (emitInitial: boolean) => {
      if (stopped) return;
      try {
        const snapshot = await dirSnapshot(path);
        if (stopped) return;
        const entries = toTodoEntries(snapshot.entries);
        const signature = snapshot.signature ?? createSignature(snapshot.entries);

        if (!initialized) {
          initialized = true;
          lastSignature = signature;
          if (emitInitial) {
            callback({ entries, signature });
          }
          return;
        }

        if (signature !== lastSignature) {
          lastSignature = signature;
          callback({ entries, signature });
        }
      } catch (error) {
        console.warn("[todo] Failed to refresh directory snapshot", error);
      }
    };

    await emitSnapshot(options.emitInitial === true);

    const timer = setInterval(() => {
      void emitSnapshot(false);
    }, intervalMs);

    const cleanup = () => {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
    };

    if (signal) {
      signal.addEventListener("abort", cleanup, { once: true });
    }

    return cleanup;
  };

  return {
    ensureDir,
    listFiles,
    readFile,
    writeFile,
    deleteFile,
    watchDirectory,
  };
}

export type { TinyHost };

// TEMPORARY: OPFS WILL BE ACCESSIBLE THROUGH THE HOST API

type OpfsDirectoryHandle = FileSystemDirectoryHandle & {
  entries?: () => AsyncIterableIterator<[string, FileSystemHandle]>;
};

type OpfsFileHandle = FileSystemFileHandle;

type StorageManagerWithDirectory = StorageManager & {
  getDirectory?: () => Promise<FileSystemDirectoryHandle>;
};

interface LsEntry {
  name: string;
  kind: FileSystemHandle["kind"];
  path: string;
}

interface LsOptions {
  include?: string[];
  kinds?: Array<FileSystemHandle["kind"]>;
  maxDepth?: number;
}

type DirectoryChangeType = "appeared" | "disappeared" | "modified";

export interface DirectoryChange {
  type: DirectoryChangeType;
  path: string[];
}

interface WatchDirectoryOptions {
  emitInitial?: boolean;
  intervalMs?: number;
  recursive?: boolean;
  signal?: AbortSignal;
}

const normalizePath = (path: string | null | undefined) => {
  if (!path) return "";
  return path
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .join("/");
};

const splitPath = (path: string) => {
  const normalized = normalizePath(path);
  return normalized ? normalized.split("/") : [];
};

const matchesInclude = (name: string, include: string[] | undefined) => {
  if (!include || include.length === 0) return true;

  for (const pattern of include) {
    if (pattern === "*") return true;

    if (pattern.startsWith("*.")) {
      const suffix = pattern.slice(1).toLowerCase();
      if (name.toLowerCase().endsWith(suffix)) return true;
    } else if (pattern === name) {
      return true;
    }
  }

  return false;
};

const getStorageManager = (): StorageManagerWithDirectory | null => {
  if (typeof navigator === "undefined") return null;
  return (navigator.storage as StorageManagerWithDirectory | undefined) ?? null;
};

let rootHandlePromise: Promise<OpfsDirectoryHandle> | null = null;

const getOpfsRoot = async (): Promise<OpfsDirectoryHandle> => {
  if (rootHandlePromise) return rootHandlePromise;

  const storage = getStorageManager();
  if (!storage || typeof storage.getDirectory !== "function") {
    throw new Error("OPFS is not available in this environment.");
  }

  rootHandlePromise = storage
    .getDirectory()
    .then((handle) => handle as OpfsDirectoryHandle)
    .catch((error) => {
      rootHandlePromise = null;
      throw error;
    });

  return rootHandlePromise;
};

const getDirectoryHandleForPath = async (
  path: string,
  options: { create?: boolean; allowMissing?: boolean } = {},
): Promise<OpfsDirectoryHandle | null> => {
  const { create = false, allowMissing = false } = options;
  const segments = splitPath(path);
  let current = await getOpfsRoot();

  for (const segment of segments) {
    try {
      current = (await current.getDirectoryHandle(
        segment,
        create ? { create: true } : undefined,
      )) as OpfsDirectoryHandle;
    } catch (error: any) {
      if (create) {
        current = (await current.getDirectoryHandle(segment, { create: true })) as OpfsDirectoryHandle;
      } else if (allowMissing && error?.name === "NotFoundError") {
        return null;
      } else {
        throw error;
      }
    }
  }

  return current;
};

export const ensureDirExists = async (path: string, recursive: boolean) => {
  const segments = splitPath(path);
  let current = await getOpfsRoot();

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const shouldCreate = recursive || index === segments.length - 1;

    current = (await current.getDirectoryHandle(
      segment,
      shouldCreate ? { create: true } : undefined,
    )) as OpfsDirectoryHandle;
  }

  return current;
};

export const ls = async (path: string, options: LsOptions = {}): Promise<LsEntry[]> => {
  const { include, kinds, maxDepth = 1 } = options;
  const normalized = normalizePath(path);
  const directory = await getDirectoryHandleForPath(normalized, { allowMissing: true });
  if (!directory || maxDepth <= 0) return [];

  const results: LsEntry[] = [];

  const walk = async (handle: OpfsDirectoryHandle, depth: number, relative: string) => {
    if (!handle.entries) return;

    for await (const [name, childHandle] of handle.entries()) {
      const nextDepth = depth + 1;
      const isDirectory = childHandle.kind === "directory";
      const shouldInclude =
        nextDepth <= maxDepth &&
        (!kinds || kinds.includes(childHandle.kind)) &&
        (isDirectory || matchesInclude(name, include));

      if (shouldInclude) {
        const relativePath = relative ? `${relative}/${name}` : name;
        const absolutePath = normalized ? `${normalized}/${relativePath}` : relativePath;
        results.push({
          name,
          kind: childHandle.kind,
          path: absolutePath,
        });
      }

      if (isDirectory && nextDepth < maxDepth) {
        await walk(childHandle as OpfsDirectoryHandle, nextDepth, relative ? `${relative}/${name}` : name);
      }
    }
  };

  await walk(directory, 0, "");
  return results;
};

const resolveFileHandle = async (
  path: string,
  options: { create?: boolean } = {},
): Promise<{ directory: OpfsDirectoryHandle; handle: OpfsFileHandle }> => {
  const normalized = normalizePath(path);
  if (!normalized) {
    throw new Error("File path must not be empty.");
  }

  const segments = normalized.split("/");
  const fileName = segments.pop();
  if (!fileName) {
    throw new Error("File name is missing in the provided path.");
  }

  const directoryPath = segments.join("/");
  const directoryOptions = options.create ? { create: true } : {};
  const directory =
    directoryPath.length > 0
      ? ((await getDirectoryHandleForPath(directoryPath, { ...directoryOptions })) as OpfsDirectoryHandle)
      : await getOpfsRoot();

  const handle = (await directory.getFileHandle(
    fileName,
    options.create ? { create: true } : undefined,
  )) as OpfsFileHandle;

  return { directory, handle };
};

export const readFile = async (path: string) => {
  const { handle } = await resolveFileHandle(path);
  const file = await handle.getFile();
  return file.text();
};

export const writeFile = async (path: string, contents: string) => {
  const { handle } = await resolveFileHandle(path, { create: true });
  const writable = await handle.createWritable();

  try {
    await writable.write(contents);
  } finally {
    await writable.close();
  }
};

export const deleteFile = async (path: string) => {
  const normalized = normalizePath(path);
  if (!normalized) return;

  const segments = normalized.split("/");
  const fileName = segments.pop();
  if (!fileName) return;

  const directoryPath = segments.join("/");
  const directory =
    directoryPath.length > 0
      ? await getDirectoryHandleForPath(directoryPath, { allowMissing: true })
      : await getOpfsRoot();
  if (!directory) return;

  await directory.removeEntry(fileName);
};

const collectSnapshot = async (path: string, recursive: boolean) => {
  const directory = await getDirectoryHandleForPath(path, { allowMissing: true });
  if (!directory) return new Map<string, number>();

  const snapshot = new Map<string, number>();

  const walk = async (handle: OpfsDirectoryHandle, relative: string) => {
    if (!handle.entries) return;

    for await (const [name, childHandle] of handle.entries()) {
      const childRelative = relative ? `${relative}/${name}` : name;

      if (childHandle.kind === "file") {
        const file = await (childHandle as OpfsFileHandle).getFile();
        snapshot.set(childRelative, file.lastModified);
      } else if (recursive) {
        await walk(childHandle as OpfsDirectoryHandle, childRelative);
      }
    }
  };

  await walk(directory, "");
  return snapshot;
};

export const watchDirectory = async (
  path: string,
  callback: (changes: DirectoryChange[]) => void,
  options: WatchDirectoryOptions = {},
): Promise<() => void> => {
  const intervalMs = options.intervalMs ?? 1500;
  const recursive = options.recursive ?? false;
  const normalized = normalizePath(path);
  const signal = options.signal;

  if (signal?.aborted) {
    return () => undefined;
  }

  let stopped = false;
  let pending = false;
  let current = await collectSnapshot(normalized, recursive);

  if (options.emitInitial) {
    const initialChanges: DirectoryChange[] = [];
    for (const name of current.keys()) {
      initialChanges.push({ type: "appeared", path: [name] });
    }

    if (initialChanges.length > 0) {
      callback(initialChanges);
    }
  }

  const tick = async () => {
    if (stopped || pending) return;
    pending = true;

    try {
      const next = await collectSnapshot(normalized, recursive);
      const seen = new Set<string>();
      const changes: DirectoryChange[] = [];

      for (const [name, lastModified] of next) {
        seen.add(name);

        if (!current.has(name)) {
          changes.push({ type: "appeared", path: name.split("/") });
        } else if (current.get(name) !== lastModified) {
          changes.push({ type: "modified", path: name.split("/") });
        }
      }

      for (const name of current.keys()) {
        if (!seen.has(name)) {
          changes.push({ type: "disappeared", path: name.split("/") });
        }
      }

      if (!stopped && changes.length > 0) {
        callback(changes);
      }

      current = next;
    } catch (error) {
      console.warn("OPFS directory watch failed", error);
    } finally {
      pending = false;
    }
  };

  const intervalId = setInterval(
    () => {
      void tick();
    },
    Math.max(250, intervalMs),
  );

  const cleanup = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(intervalId);
  };

  if (signal) {
    signal.addEventListener("abort", cleanup, { once: true });
  }

  return cleanup;
};

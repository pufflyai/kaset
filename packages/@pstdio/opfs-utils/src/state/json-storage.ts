import { readFile, writeFile } from "../utils/opfs-crud";
import { parentOf, normalizeRelPath } from "../utils/path";
import { watchDirectory, type ChangeRecord, type DirectoryWatcherCleanup } from "../utils/opfs-watch";

export interface JsonFileStorageOptions<T> {
  /** Initial fallback used when the file is missing or cannot be parsed. */
  defaultValue: T;
  /** Relative path to the JSON file inside OPFS. */
  filePath: string;
  /** Delay (ms) applied before writing successive updates. */
  debounceMs?: number;
  /** Optional migration hook executed on the raw file value. */
  migrate?: (fileValue: unknown) => T;
  /** Optional serializer. Defaults to pretty JSON. */
  serialize?: (value: T) => string;
  /** Optional deserializer. Defaults to JSON.parse. */
  deserialize?: (text: string) => unknown;
  /** Interval (ms) for polling OPFS changes. Set to 0 to disable polling. */
  watchIntervalMs?: number;
  /** Custom BroadcastChannel identifier. Pass null to disable BroadcastChannel. */
  broadcastChannelId?: string | null;
}

export interface JsonFileStorage<T> {
  read(): Promise<T>;
  write(next: T): Promise<void>;
  subscribe(listener: (next: T) => void): () => void;
  dispose(): void;
}

const DEFAULT_DEBOUNCE_MS = 150;
const DEFAULT_CHANNEL_PREFIX = "@pstdio/opfs-utils/json";

function createDebouncedWriter<T>(
  fn: (value: T) => Promise<void>,
  delay: number,
): {
  schedule: (value: T) => Promise<void>;
  cancel: (reason?: unknown) => void;
} {
  if (delay <= 0) {
    return {
      schedule: fn,
      cancel: () => undefined,
    };
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingValue: T | null = null;
  const waiters: Array<{ resolve: () => void; reject: (error: unknown) => void }> = [];

  const settle = (error?: unknown) => {
    const handlers = waiters.splice(0, waiters.length);
    if (error) {
      for (const waiter of handlers) waiter.reject(error);
      return;
    }
    for (const waiter of handlers) waiter.resolve();
  };

  const flush = async () => {
    const value = pendingValue as T;
    pendingValue = null;
    timer = null;

    try {
      await fn(value);
      settle();
    } catch (error) {
      settle(error);
    }
  };

  return {
    schedule: (value: T) => {
      pendingValue = value;
      if (timer) clearTimeout(timer);

      return new Promise<void>((resolve, reject) => {
        waiters.push({ resolve, reject });
        timer = setTimeout(flush, delay);
      });
    },
    cancel: (reason?: unknown) => {
      if (!timer) return;
      clearTimeout(timer);
      timer = null;
      pendingValue = null;
      settle(reason ?? new Error("Debounced write cancelled"));
    },
  };
}

async function safeParse<T>(
  text: string,
  options: Pick<JsonFileStorageOptions<T>, "defaultValue" | "migrate" | "deserialize">,
): Promise<T> {
  if (!text.trim()) return options.defaultValue;

  try {
    const deserialize = options.deserialize ?? JSON.parse;
    const raw = deserialize(text);
    return options.migrate ? options.migrate(raw) : (raw as T);
  } catch {
    return options.defaultValue;
  }
}

async function readJsonOrDefault<T>(
  path: string,
  options: Pick<JsonFileStorageOptions<T>, "defaultValue" | "migrate" | "deserialize">,
): Promise<T> {
  try {
    const text = await readFile(path);
    return safeParse(text, options);
  } catch (error: any) {
    if (error && (error.name === "NotFoundError" || error.code === "ENOENT")) {
      return options.defaultValue;
    }
    return safeParse("", options);
  }
}

function isWatchedFile(change: ChangeRecord, relativeFile: string): boolean {
  const path = change.path.join("/");
  return path === relativeFile;
}

export function createJsonFileStorage<T>(options: JsonFileStorageOptions<T>): JsonFileStorage<T> {
  const {
    defaultValue,
    filePath,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    migrate,
    serialize = (value: T) => JSON.stringify(value, null, 2),
    deserialize,
    watchIntervalMs = 1500,
    broadcastChannelId,
  } = options;

  if (!filePath) {
    throw new Error("createJsonFileStorage: 'filePath' must be provided");
  }

  const normalizedPath = normalizeRelPath(filePath);
  const directory = parentOf(normalizedPath);
  const relativeFile = normalizedPath.slice(directory ? directory.length + 1 : 0);

  const channelName =
    broadcastChannelId === null ? null : (broadcastChannelId ?? `${DEFAULT_CHANNEL_PREFIX}:${normalizedPath}`);

  const broadcast = typeof BroadcastChannel !== "undefined" && channelName ? new BroadcastChannel(channelName) : null;

  const listeners = new Set<(next: T) => void>();
  let disposed = false;
  let stopWatching: DirectoryWatcherCleanup | null = null;
  let lastSerialized: string | null = null;

  const writeImpl = async (value: T) => {
    if (disposed) return;

    const serialized = serialize(value);
    if (serialized === lastSerialized) return;

    const performWrite = async () => {
      await writeFile(normalizedPath, serialized);
      lastSerialized = serialized;
      void ensureWatcher();
    };

    const navigatorLocks = (typeof navigator !== "undefined" ? (navigator as any).locks : undefined) as
      | undefined
      | {
          request?: (
            name: string,
            options: { mode?: "exclusive" | "shared" },
            callback: () => Promise<void>,
          ) => Promise<void>;
        };

    if (navigatorLocks?.request) {
      await navigatorLocks.request(`@pstdio/opfs-utils:${normalizedPath}`, { mode: "exclusive" }, performWrite);
    } else {
      await performWrite();
    }

    try {
      broadcast?.postMessage({ type: "json-write", path: normalizedPath, ts: Date.now() });
    } catch {
      // Ignore BroadcastChannel failures (Safari can throw when closing windows).
    }
  };

  const { schedule: scheduleWrite, cancel: cancelWrite } = createDebouncedWriter(writeImpl, debounceMs);

  async function emitExternalChange() {
    if (disposed) return;
    const next = await readJsonOrDefault(normalizedPath, { defaultValue, migrate, deserialize });
    const serialized = serialize(next);
    if (serialized === lastSerialized) return;
    lastSerialized = serialized;
    for (const listener of listeners) {
      listener(next);
    }
  }

  async function ensureWatcher() {
    if (stopWatching || disposed || watchIntervalMs <= 0 || listeners.size === 0) return;

    try {
      stopWatching = await watchDirectory(
        directory,
        (changes) => {
          for (const change of changes) {
            if (isWatchedFile(change, relativeFile)) {
              void emitExternalChange();
              return;
            }
          }
        },
        {
          intervalMs: watchIntervalMs,
          recursive: false,
        },
      );
    } catch {
      stopWatcher();
    }
  }

  function stopWatcher() {
    if (stopWatching) {
      try {
        stopWatching();
      } catch {
        // ignore
      }
      stopWatching = null;
    }
  }

  const onBroadcastMessage = () => {
    void emitExternalChange();
  };
  broadcast?.addEventListener("message", onBroadcastMessage);

  return {
    async read() {
      if (disposed) throw new Error("createJsonFileStorage: storage has been disposed");
      const value = await readJsonOrDefault(normalizedPath, { defaultValue, migrate, deserialize });
      lastSerialized = serialize(value);
      return value;
    },
    async write(next) {
      if (disposed) return;
      await scheduleWrite(next);
    },
    subscribe(listener) {
      if (disposed) return () => undefined;
      listeners.add(listener);
      void ensureWatcher();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          stopWatcher();
        }
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stopWatcher();
      cancelWrite(new Error("createJsonFileStorage disposed"));
      try {
        broadcast?.removeEventListener("message", onBroadcastMessage);
        broadcast?.close();
      } catch {
        // ignore
      }
    },
  };
}

import { getOPFSRoot } from "../shared";

export type DirectoryWatcherCleanup = () => void;
export type ChangeType = "appeared" | "modified" | "disappeared" | "moved" | "unknown" | "errored";

export interface ChangeRecord {
  type: ChangeType;
  path: string[];
  size?: number;
  lastModified?: number;
  handleKind?: FileSystemHandle["kind"];
}

export interface WatchOptions {
  intervalMs?: number;
  pauseWhenHidden?: boolean;
  emitInitial?: boolean;
  recursive?: boolean;
  signal?: AbortSignal;
  ignore?: RegExp | RegExp[] | ((path: string[], handle: FileSystemHandle) => boolean);
}

export async function watchOPFS(
  callback: (changes: ChangeRecord[]) => void,
  options?: WatchOptions,
): Promise<DirectoryWatcherCleanup> {
  const root = await getOPFSRoot();
  return watchDirectory(root, callback, options);
}

export async function watchDirectory(
  dir: FileSystemDirectoryHandle,
  callback: (changes: ChangeRecord[]) => void,
  options: WatchOptions = {},
): Promise<DirectoryWatcherCleanup> {
  const { intervalMs = 1500, pauseWhenHidden = true, emitInitial = false, recursive = true, signal, ignore } = options;

  const ignoreFn = toIgnoreFn(ignore);

  const ObserverCtor: any = (globalThis as any).FileSystemObserver;
  if (typeof ObserverCtor === "function") {
    const observer = new ObserverCtor((records: any[]) => {
      const changes: ChangeRecord[] = [];

      for (const r of records) {
        const p: string[] = r.relativePathComponents || [r.name || ""];
        changes.push({
          type: r.type || "unknown",
          path: p,
          size: r.size,
          lastModified: r.lastModified,
          handleKind: r.kind,
        });
      }

      if (changes.length) callback(changes);
    });

    await observer.observe(dir, { recursive });

    const cleanup = () => observer.disconnect();
    signal?.addEventListener("abort", cleanup);
    return cleanup;
  }

  let prev = new Map<string, { size: number; mtime: number; kind: string }>();

  async function snap() {
    const cur = new Map<string, { size: number; mtime: number; kind: string }>();
    await walk(dir, [], cur);
    const changes: ChangeRecord[] = [];

    for (const [path, meta] of cur) {
      const before = prev.get(path);
      if (!before) {
        changes.push({
          type: "appeared",
          path: path.split("/"),
          size: meta.size,
          lastModified: meta.mtime,
          handleKind: meta.kind as any,
        });
      } else if (before.size !== meta.size || before.mtime !== meta.mtime) {
        changes.push({
          type: "modified",
          path: path.split("/"),
          size: meta.size,
          lastModified: meta.mtime,
          handleKind: meta.kind as any,
        });
      }
    }

    for (const [path] of prev) {
      if (!cur.has(path)) {
        changes.push({ type: "disappeared", path: path.split("/") });
      }
    }

    if (changes.length) callback(changes);
    prev = cur;
  }

  async function walk(
    d: FileSystemDirectoryHandle,
    prefix: string[],
    out: Map<string, { size: number; mtime: number; kind: string }>,
  ) {
    for await (const [name, handle] of (d as any).entries() as any) {
      const path = [...prefix, name];
      if (ignoreFn(path, handle)) continue;

      if (handle.kind === "directory") {
        out.set(path.join("/"), { size: 0, mtime: 0, kind: handle.kind });
        await walk(handle, path, out);
      } else if (handle.kind === "file") {
        const f = await handle.getFile();
        out.set(path.join("/"), {
          size: f.size,
          mtime: f.lastModified,
          kind: handle.kind,
        });
      }
    }
  }

  if (emitInitial) await snap();

  let timer = setInterval(snap, intervalMs);

  let visListener: (() => void) | null = null;
  if (pauseWhenHidden && typeof document !== "undefined") {
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        clearInterval(timer);
      } else {
        snap();
        timer = setInterval(snap, intervalMs);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    visListener = () => document.removeEventListener("visibilitychange", onVis);
  }

  const cleanup = () => {
    clearInterval(timer);
    visListener?.();
  };

  signal?.addEventListener("abort", cleanup);
  return cleanup;
}

function toIgnoreFn(ignore: WatchOptions["ignore"]): (path: string[], handle: FileSystemHandle) => boolean {
  if (!ignore) return () => false;
  if (typeof ignore === "function") return ignore;
  const regs = Array.isArray(ignore) ? ignore : [ignore];
  return (path) => regs.some((r) => r.test(path.join("/")));
}

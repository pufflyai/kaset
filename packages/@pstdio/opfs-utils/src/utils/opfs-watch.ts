import { getFs } from "../adapter/fs";
import { resolveSubdir } from "../shared";
import { joinPath } from "./path";

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
  return watchDirectory("", callback, options);
}

export async function watchDirectory(
  dirPath: string,
  callback: (changes: ChangeRecord[]) => void,
  options: WatchOptions = {},
): Promise<DirectoryWatcherCleanup> {
  const { intervalMs = 1500, pauseWhenHidden = true, emitInitial = false, recursive = true, signal, ignore } = options;

  const ignoreFn = toIgnoreFn(ignore);

  // Snapshot map: "relative/path" -> metadata
  let prev: Map<string, { size: number; mtime: number; kind: "file" | "directory" }> | null = null;

  async function snap() {
    const cur = new Map<string, { size: number; mtime: number; kind: "file" | "directory" }>();
    await walkFs(dirPath, cur, { recursive, ignoreFn });
    const changes: ChangeRecord[] = [];

    if (prev === null) {
      if (!emitInitial) {
        prev = cur;
        return;
      }
    }

    const prevSnapshot = prev ?? new Map<string, { size: number; mtime: number; kind: "file" | "directory" }>();

    for (const [path, meta] of cur) {
      const before = prevSnapshot.get(path);
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

    for (const [path] of prevSnapshot) {
      if (!cur.has(path)) {
        changes.push({ type: "disappeared", path: path.split("/") });
      }
    }

    if (changes.length) callback(changes);
    prev = cur;
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

async function walkFs(
  dirPath: string,
  out: Map<string, { size: number; mtime: number; kind: "file" | "directory" }>,
  opts: { recursive: boolean; ignoreFn: (path: string[], handle: FileSystemHandle) => boolean },
) {
  const fs = await getFs();
  const rootAbs = await resolveSubdir(dirPath || "", /*create*/ false);

  async function visit(prefix: string): Promise<void> {
    const hereAbs = "/" + (prefix ? joinPath(rootAbs, prefix) : rootAbs);

    let names: string[] = [];
    try {
      names = await fs.promises.readdir(hereAbs);
    } catch {
      return;
    }

    for (const name of names) {
      const rel = prefix ? `${prefix}/${name}` : name;
      const abs = "/" + joinPath(rootAbs, rel);

      let st: any;
      try {
        st = await fs.promises.stat(abs);
      } catch {
        continue;
      }

      if (st.isDirectory?.()) {
        const fake: any = { kind: "directory" };
        if (opts.ignoreFn(rel.split("/"), fake)) continue;
        out.set(rel, { size: 0, mtime: 0, kind: "directory" });
        if (opts.recursive) await visit(rel);
      } else if (st.isFile?.()) {
        const fake: any = { kind: "file" };
        if (opts.ignoreFn(rel.split("/"), fake)) continue;
        out.set(rel, {
          size: Number((st as any).size ?? 0),
          mtime: Number((st as any).mtimeMs ?? 0),
          kind: "file",
        });
      }
    }
  }

  await visit("");
}

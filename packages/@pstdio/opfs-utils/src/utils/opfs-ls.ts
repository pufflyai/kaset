// A small, dependency-free "ls" for the Origin Private File System (OPFS).
// Works with OPFS (navigator.storage.getDirectory())

// ---------- Types ----------
export interface LsEntry {
  /** POSIX-like path relative to the provided dir handle */
  path: string;
  /** Basename of the entry */
  name: string;
  /** "file" or "directory" */
  kind: "file" | "directory";
  /** Depth starting at 1 for direct children of the given dir handle */
  depth: number;
  /** File size in bytes (only when stat: true and kind === "file") */
  size?: number;
  /** Last modified time (epoch ms; only when stat: true and kind === "file") */
  lastModified?: number;
  /** Blob type (MIME) from getFile(); optional */
  type?: string;
}

export interface LsOptions {
  /** Maximum depth to descend (default 1 = only the directory itself). Use Infinity for full recursion. */
  maxDepth?: number;
  /** Only include paths matching at least one of these globs. (Applied to files & dirs) */
  include?: string[];
  /** Exclude paths matching any of these globs. (Prunes dirs too) */
  exclude?: string[];
  /** Show entries whose *name* begins with "." (default: false, like `ls`) */
  showHidden?: boolean;
  /** Which kinds to return (default: both) */
  kinds?: Array<"file" | "directory">;
  /** Fetch size & mtime for files (default: false for speed) */
  stat?: boolean;
  /** Concurrency limit for stat operations (default: 4) */
  concurrency?: number;
  /** Optional cancellation signal */
  signal?: AbortSignal;
  /** Optional streaming callback; called when an entry is ready (after stat for files) */
  onEntry?: (e: LsEntry) => void | Promise<void>;
  /** Sort key (default: "name") */
  sortBy?: "name" | "path" | "size" | "mtime";
  /** Sort order (default: "asc") */
  sortOrder?: "asc" | "desc";
  /** Place directories before files (default: true) */
  dirsFirst?: boolean;
}

/**
 * List files & directories under `dirHandle` honoring filters, depth, and sorting.
 */
export async function ls(dirHandle: FileSystemDirectoryHandle, opts: LsOptions = {}): Promise<LsEntry[]> {
  const {
    maxDepth = 1,
    include,
    exclude,
    showHidden = false,
    kinds = ["file", "directory"],
    stat = false,
    concurrency = 4,
    signal,
    onEntry,
    sortBy = "name",
    sortOrder = "asc",
    dirsFirst = true,
  } = opts;

  const includeREs = (include ?? []).map(globToRegExp);
  const excludeREs = (exclude ?? []).map(globToRegExp);

  const results: LsEntry[] = [];
  const statTasks: Array<() => Promise<void>> = [];

  // Traverse
  await walk(dirHandle, "", 0, {
    maxDepth,
    showHidden,
    excludeREs,
    signal,
    onDir: async (name, _handle, prefix, depth) => {
      const path = prefix ? `${prefix}/${name}` : name;
      const listThis = kinds.includes("directory") && !shouldFilterOut(path, includeREs, excludeREs, showHidden, name);

      if (listThis) {
        const entry: LsEntry = {
          path,
          name,
          kind: "directory",
          depth,
        };
        results.push(entry);
        if (onEntry) await onEntry(entry);
      }
    },
    onFile: async (name, handle, prefix, depth) => {
      const path = prefix ? `${prefix}/${name}` : name;
      const listThis = kinds.includes("file") && !shouldFilterOut(path, includeREs, excludeREs, showHidden, name);

      if (!listThis) return;

      const entry: LsEntry = {
        path,
        name,
        kind: "file",
        depth,
      };
      results.push(entry);

      if (stat) {
        statTasks.push(async () => {
          try {
            const f = await (handle as FileSystemFileHandle).getFile();
            entry.size = f.size;
            entry.lastModified = f.lastModified;
            if (f.type) entry.type = f.type;
          } catch {
            // Ignore stat errors; keep basic entry.
          }
          if (onEntry) await onEntry(entry);
        });
      } else {
        if (onEntry) await onEntry(entry);
      }
    },
  });

  // Perform file stats with concurrency limit
  if (statTasks.length > 0) {
    await runPool(statTasks, Math.max(1, concurrency), (fn) => fn());
  }

  // Sort results
  sortEntries(results, { sortBy, sortOrder, dirsFirst });

  return results;
}

// ---------- Formatting helpers (optional) ----------

/** Human-friendly size (e.g., "12.3 MB"). */
export function formatSize(n?: number): string {
  if (n == null) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return (i === 0 ? v.toString() : v.toFixed(1)) + " " + units[i];
}

/**  YYYY-MM-DD HH:mm local (files only) */
export function formatMtime(ms?: number): string {
  if (ms == null) return "-";
  const d = new Date(ms);
  const pad = (x: number) => (x < 10 ? "0" + x : "" + x);
  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    " " +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes())
  );
}

/** Minimal “ls -l”-like output (permissions/owner not available in OPFS). */
export function formatLong(entries: LsEntry[]): string {
  const lines: string[] = [];
  for (const e of entries) {
    const typeFlag = e.kind === "directory" ? "d" : "-";
    const size = e.kind === "file" ? formatSize(e.size) : "-";
    const mtime = e.kind === "file" ? formatMtime(e.lastModified) : "-";
    lines.push(`${typeFlag} ${size.padStart(10)}  ${mtime}  ${e.path}`);
  }
  return lines.join("\n");
}

/** Simple tree view (uses entries you already got; pass `maxDepth: Infinity`). */
export function formatTree(entries: LsEntry[]): string {
  // Build child lists keyed by parent path.
  const children = new Map<string, LsEntry[]>();
  for (const e of entries) {
    const parent = parentPath(e.path);
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent)!.push(e);
  }
  // Sort each child array: dirs first, then name asc.
  for (const arr of children.values()) {
    sortEntries(arr, { sortBy: "name", sortOrder: "asc", dirsFirst: true });
  }

  const lines: string[] = [];
  const visit = (parent: string, prefix: string) => {
    const arr = children.get(parent) || [];
    arr.forEach((e, i) => {
      const last = i === arr.length - 1;
      const connector = last ? "└── " : "├── ";
      const nextPrefix = prefix + (last ? "    " : "│   ");
      lines.push(prefix + connector + (e.kind === "directory" ? e.name + "/" : e.name));
      if (e.kind === "directory") {
        visit(e.path, nextPrefix);
      }
    });
  };

  visit("", "");
  return lines.join("\n");
}

// ---------- Internals ----------

function parentPath(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

function sortEntries(
  entries: LsEntry[],
  opts: { sortBy: "name" | "path" | "size" | "mtime"; sortOrder: "asc" | "desc"; dirsFirst: boolean },
) {
  const mult = opts.sortOrder === "asc" ? 1 : -1;
  entries.sort((a, b) => {
    if (opts.dirsFirst && a.kind !== b.kind) {
      return a.kind === "directory" ? -1 : 1;
    }
    const va =
      opts.sortBy === "name"
        ? a.name
        : opts.sortBy === "path"
          ? a.path
          : opts.sortBy === "size"
            ? (a.size ?? -1)
            : (a.lastModified ?? 0);
    const vb =
      opts.sortBy === "name"
        ? b.name
        : opts.sortBy === "path"
          ? b.path
          : opts.sortBy === "size"
            ? (b.size ?? -1)
            : (b.lastModified ?? 0);

    // string vs number compare
    if (typeof va === "string" && typeof vb === "string") {
      return va.localeCompare(vb) * mult;
    }
    return (va < vb ? -1 : va > vb ? 1 : 0) * mult;
  });
}

function shouldFilterOut(
  path: string,
  includeREs: RegExp[],
  excludeREs: RegExp[],
  showHidden: boolean,
  name: string,
): boolean {
  if (!showHidden && name.startsWith(".")) return true;
  const p = path.replace(/\\/g, "/");
  if (excludeREs.some((r) => r.test(p))) return true;
  if (includeREs.length > 0 && !includeREs.some((r) => r.test(p))) return true;
  return false;
}

function globToRegExp(glob: string): RegExp {
  // Supports **, *, ?  — no brace expansion.
  let re = "^";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        re += ".*";
        i++;
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else {
      re += /[\\^$.*+?()[\]{}|]/.test(c) ? "\\" + c : c;
    }
  }
  re += "$";
  return new RegExp(re);
}

async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let idx = 0;
  const runners = Array.from({ length: Math.min(limit, items.length || 1) }, async function run() {
    while (idx < items.length) {
      const i = idx++;
      await worker(items[i]);
    }
  });
  await Promise.all(runners);
}

async function walk(
  dir: FileSystemDirectoryHandle,
  prefix: string,
  depth: number,
  opts: {
    maxDepth: number;
    showHidden: boolean;
    excludeREs: RegExp[];
    signal?: AbortSignal;
    onDir: (name: string, handle: FileSystemDirectoryHandle, prefix: string, depth: number) => Promise<void>;
    onFile: (name: string, handle: FileSystemFileHandle, prefix: string, depth: number) => Promise<void>;
  },
): Promise<void> {
  if (opts.signal?.aborted) return;
  if (depth >= opts.maxDepth) return;

  const iter = (dir as any).entries() as AsyncIterable<[string, FileSystemHandle]>;
  for await (const [name, handle] of iter) {
    if (opts.signal?.aborted) return;

    // Prune hidden directories when showHidden=false
    const hidden = name.startsWith(".");
    if (handle.kind === "directory" && hidden && !opts.showHidden) {
      continue;
    }

    // Prune excluded directories entirely
    const path = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === "directory" && opts.excludeREs.some((r) => r.test(path))) {
      continue;
    }

    const nextDepth = depth + 1;
    if (handle.kind === "directory") {
      await opts.onDir(name, handle as FileSystemDirectoryHandle, prefix, nextDepth);
      await walk(handle as FileSystemDirectoryHandle, path, nextDepth, opts);
    } else {
      await opts.onFile(name, handle as FileSystemFileHandle, prefix, nextDepth);
    }
  }
}

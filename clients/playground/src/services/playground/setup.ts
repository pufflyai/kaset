import { getDirectoryHandle, getOPFSRoot, writeFile } from "@pstdio/opfs-utils";

/**
 * Options when applying a bundle of example files into OPFS.
 */
export type ApplyFilesOptions = {
  /**
   * Root directory name under OPFS. Example: "playground" (default).
   * Files will be written under `${rootDir}/...` maintaining relative paths.
   */
  rootDir?: string;

  /**
   * Record of file paths to contents. Paths should be absolute (e.g. `/src/...`).
   */
  files: Record<string, string>;

  /**
   * Prefix to strip from `files` keys when computing the OPFS relative path.
   * Example: `/src/examples/todo/files`
   */
  baseDir?: string;

  /** Overwrite existing OPFS files. Defaults to true. */
  overwrite?: boolean;
};

/** Ensure an OPFS directory path exists; returns the handle. */
async function ensureOpfsDir(path: string): Promise<FileSystemDirectoryHandle> {
  // Try fast path via utility; if missing, create via manual walk
  try {
    return await getDirectoryHandle(path);
  } catch (err: any) {
    if (err?.name !== "NotFoundError" && err?.code !== 404) throw err;

    const root = await getOPFSRoot();
    const parts = path.split("/").filter(Boolean);

    let current = root;
    for (const part of parts) {
      current = await current.getDirectoryHandle(part, { create: true });
    }

    return current;
  }
}

/** Normalize a path to POSIX and remove leading slash. */
function normalizeRel(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\/+/, "");
}

/**
 * Apply a map of source files (bundled via Vite import.meta.glob) into OPFS.
 * Maintains directory structure under `rootDir`, stripping `baseDir` from keys.
 */
export async function applyFilesToOpfs(options: ApplyFilesOptions): Promise<{
  rootDir: string;
  written: number;
}> {
  const rootDir = (options.rootDir ?? "playground").trim().replace(/\/+$/, "");
  const { files } = options;
  const baseDir = (options.baseDir ?? "").replace(/\\/g, "/").replace(/\/$/, "");
  const overwrite = options.overwrite ?? true;

  await ensureOpfsDir(rootDir);

  let written = 0;

  const entries = Object.entries(files);
  for (const [absKey, content] of entries) {
    const normalizedKey = absKey.replace(/\\/g, "/");

    let rel = normalizedKey;
    if (baseDir && normalizedKey.startsWith(baseDir)) {
      rel = normalizedKey.slice(baseDir.length);
    }

    rel = rel.replace(/^\/+/, "");
    if (!rel) continue;

    const target = normalizeRel(`${rootDir}/${rel}`);

    if (!overwrite) {
      // Cheap existence check: try to get a handle; skip if present
      try {
        const dirPath = target.split("/").slice(0, -1).join("/");
        const base = target.split("/").pop()!;
        const dir = await getDirectoryHandle(dirPath);
        await dir.getFileHandle(base);
        continue; // exists; skip
      } catch (e: any) {
        // Missing is fine; we'll write it
      }
    }

    await writeFile(target, content);
    written++;
  }

  return { rootDir, written };
}

export default applyFilesToOpfs;

import { getDirectoryHandle, getOPFSRoot, writeFile } from "@pstdio/opfs-utils";
import { PROJECTS_ROOT } from "@/constant";

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

  /** Overwrite existing OPFS files. Defaults to false. */
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
  const rootDir = (options.rootDir ?? PROJECTS_ROOT).trim().replace(/\/+$/, "");
  const { files } = options;
  const baseDir = (options.baseDir ?? "").replace(/\\/g, "/").replace(/\/$/, "");
  const overwrite = options.overwrite ?? false;

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
        continue;
      } catch {
        // Missing is fine; we'll write it
      }
    }

    await writeFile(target, content);
    written++;
  }

  return { rootDir, written };
}

export default applyFilesToOpfs;

/** Example kinds supported by the playground. */
export type ExampleKind = string;

/** Options shared by example setup helpers. */
export type SetupOptions = {
  /** OPFS root folder name. Defaults to `${PROJECTS_ROOT}/<kind>`. */
  folderName?: string;
  /** Overwrite existing files. Defaults to false. */
  overwrite?: boolean;
};

/**
 * Reusable example setup that bundles files with Vite and writes them to OPFS.
 * Handles special filename rewrites (e.g. `__agents.md` -> `agents.md`).
 */
export async function setupExample(kind: ExampleKind, options: SetupOptions = {}) {
  const overwrite = options.overwrite ?? false;
  const folderName = options.folderName?.trim() || `${PROJECTS_ROOT}/${kind}`;

  // Bundle all files under /src/examples/** once, then filter by example kind
  const allFiles = import.meta.glob("/src/examples/**", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;

  const examplePrefix = `/src/examples/${kind}/files`;
  const rawFiles = Object.fromEntries(
    Object.entries(allFiles).filter(([path]) => path.startsWith(examplePrefix)),
  ) as Record<string, string>;

  const filesSubdirPrefix = `${examplePrefix}/`;
  const hasFilesSubdir = Object.keys(rawFiles).some((p) => p.startsWith(filesSubdirPrefix));
  const baseDir = (hasFilesSubdir ? `${examplePrefix}` : examplePrefix).replace(/\/$/, "");

  const files: Record<string, string> = {};
  for (const [absKey, content] of Object.entries(rawFiles)) {
    const key = absKey.endsWith("/__agents.md") ? absKey.replace(/\/__agents\.md$/, "/agents.md") : absKey;
    files[key] = content;
  }

  return applyFilesToOpfs({ rootDir: folderName, files, baseDir, overwrite });
}

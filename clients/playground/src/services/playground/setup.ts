import { PROJECTS_ROOT } from "@/constant";
import {
  commitAll,
  deleteFile,
  ensureRepo,
  getDirectoryHandle,
  listCommits,
  readFile,
  writeFile,
} from "@pstdio/opfs-utils";
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

/** Ensure an OPFS directory path exists; returns the absolute path string. */
async function ensureOpfsDir(path: string): Promise<string> {
  try {
    return await getDirectoryHandle(path);
  } catch (err: any) {
    if (err?.name !== "NotFoundError" && err?.code !== 404) throw err;
    const keep = `${path.replace(/\/+$/, "")}/.keep`;
    await writeFile(keep, "");
    try {
      await deleteFile(keep);
    } catch {
      // ignore
    }
    return await getDirectoryHandle(path);
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
      // Cheap existence check: try to read; skip if present
      try {
        await readFile(target);
        continue; // it exists
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
export async function setupExample(kind: string, options: SetupOptions = {}) {
  const overwrite = options.overwrite ?? false;
  const folderName = options.folderName?.trim() || `${PROJECTS_ROOT}/${kind}`;

  // Bundle all files under /src/examples/** once, then filter by example kind
  const allFiles = import.meta.glob("/src/examples/**", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;

  // Prefer copying from a dedicated "files" subfolder when present; otherwise copy the example root.
  const exampleRoot = `/src/examples/${kind}`;
  const hasFilesSubdir = Object.keys(allFiles).some((p) => p.startsWith(`${exampleRoot}/files/`));
  const copyPrefix = (hasFilesSubdir ? `${exampleRoot}/files` : exampleRoot).replace(/\/$/, "");

  const rawFiles = Object.fromEntries(
    Object.entries(allFiles).filter(([path]) => path.startsWith(copyPrefix)),
  ) as Record<string, string>;

  const baseDir = copyPrefix;

  const files: Record<string, string> = {};
  for (const [absKey, content] of Object.entries(rawFiles)) {
    const key = absKey.endsWith("/__agents.md") ? absKey.replace(/\/__agents\.md$/, "/agents.md") : absKey;
    files[key] = content;
  }

  const result = await applyFilesToOpfs({ rootDir: folderName, files, baseDir, overwrite });

  // Initialize a git repository in the project folder if none exists
  try {
    const dir = await getDirectoryHandle(folderName);
    await ensureRepo({ dir });

    // If the repo has no commits yet, create an initial commit so history exists
    let hasCommit = false;
    try {
      const commits = await listCommits({ dir }, { limit: 1 });
      hasCommit = Array.isArray(commits) && commits.length > 0;
    } catch {
      // If listing commits fails (e.g., unborn HEAD), treat as no commits
      hasCommit = false;
    }

    if (!hasCommit) {
      try {
        await commitAll(
          { dir },
          {
            message: "chore: initial commit",
            author: { name: "KAS", email: "kas@kaset.dev" },
          },
        );
      } catch (e) {
        console.error("Failed to create initial commit in new repo", e);
        // Non-fatal: if committing fails, continue without blocking setup
      }
    }
  } catch {
    // Non-fatal: if OPFS/git is unavailable, skip repo init silently
  }

  return result;
}

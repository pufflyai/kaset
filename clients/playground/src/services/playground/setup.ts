import { ROOT } from "@/constant";
import {
  commitAll,
  deleteFile,
  ensureRepo,
  getDirectoryHandle,
  listCommits,
  readFile,
  writeFile,
} from "@pstdio/opfs-utils";

export type SetupOptions = {
  rootDir?: string;
  overwrite?: boolean;
};

type ApplyBundleOptions = {
  bundleRoot: string;
  files: Record<string, string>;
  baseDir: string;
  overwrite: boolean;
};

const EXAMPLE_FILE_BUNDLE = import.meta.glob("/src/example-files/**", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const EXAMPLE_PLUGIN_BUNDLE = import.meta.glob("/src/example-plugins/**", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const EXAMPLE_PLUGIN_DATA_BUNDLE = import.meta.glob("/src/example-plugin-data/**", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const WALLPAPER_BUNDLE = import.meta.glob("/src/example-wallpapers/*.{png,jpg,jpeg,gif,webp}", {
  query: "?url",
  import: "default",
  eager: true,
}) as Record<string, string>;

async function ensureDirectory(path: string) {
  const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "");

  try {
    await getDirectoryHandle(normalized);
    return;
  } catch (error: any) {
    if (error?.name !== "NotFoundError" && error?.code !== 404) throw error;
  }

  const keepFile = `${normalized.replace(/\/+$/, "")}/.keep`;
  await writeFile(keepFile, "");
  try {
    await deleteFile(keepFile);
  } catch {
    // ignore cleanup failures
  }
}

function normalizeOpfsPath(path: string) {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

async function applyBundle(options: ApplyBundleOptions) {
  const { bundleRoot, files, baseDir, overwrite } = options;
  const normalizedRoot = bundleRoot.replace(/\/+$/, "");
  const normalizedBase = baseDir.replace(/\\/g, "/").replace(/\/$/, "");

  const writeResults = await Promise.all(
    Object.entries(files).map(async ([absoluteKey, content]): Promise<number> => {
      const normalizedKey = absoluteKey.replace(/\\/g, "/");

      let relativePath = normalizedKey;
      if (normalizedBase && normalizedKey.startsWith(normalizedBase)) {
        relativePath = normalizedKey.slice(normalizedBase.length);
      }

      relativePath = relativePath.replace(/^\/+/, "");
      if (!relativePath) return 0;

      const target = normalizeOpfsPath(`${normalizedRoot}/${relativePath}`);

      if (!overwrite) {
        try {
          await readFile(target, { encoding: null });
          return 0;
        } catch {
          // file missing — we'll create it below
        }
      }

      await writeFile(target, content);
      return 1;
    }),
  );

  return writeResults.reduce((sum, value) => sum + value, 0);
}

async function applyWallpaperBundle(options: {
  wallpaperRoot: string;
  files: Record<string, string>;
  overwrite: boolean;
}) {
  const { wallpaperRoot, files, overwrite } = options;
  const writeResults = await Promise.all(
    Object.entries(files).map(async ([absoluteKey, url]): Promise<number> => {
      const normalizedKey = absoluteKey.replace(/\\/g, "/");
      const filename = normalizedKey.split("/").pop();

      if (!filename) return 0;

      const target = normalizeOpfsPath(`${wallpaperRoot}/${filename}`);

      if (!overwrite) {
        try {
          await readFile(target);
          return 0;
        } catch {
          // file missing — we'll create it below
        }
      }

      try {
        const response = await fetch(url);
        if (!response.ok) {
          console.warn(`Failed to fetch wallpaper ${filename}:`, response.status);
          return 0;
        }

        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        await writeFile(target, uint8Array);
        return 1;
      } catch (error) {
        console.error(`Failed to copy wallpaper ${filename}:`, error);
        return 0;
      }
    }),
  );

  return writeResults.reduce((sum, value) => sum + value, 0);
}

export async function setupPlayground(options: SetupOptions = {}) {
  const rootDir = options.rootDir?.trim() || ROOT;
  const overwrite = options.overwrite ?? false;

  const normalizedRoot = normalizeOpfsPath(rootDir);
  const pluginsRoot = `${normalizedRoot}/plugins`;
  const pluginDataRoot = `${normalizedRoot}/plugin_data`;
  const wallpaperRoot = `${normalizedRoot}/wallpaper`;

  await ensureDirectory(normalizedRoot);
  await ensureDirectory(pluginsRoot);
  await ensureDirectory(pluginDataRoot);
  await ensureDirectory(wallpaperRoot);

  const rootFilesWritten = await applyBundle({
    bundleRoot: normalizedRoot,
    files: EXAMPLE_FILE_BUNDLE,
    baseDir: "/src/example-files",
    overwrite,
  });

  const pluginFilesWritten = await applyBundle({
    bundleRoot: pluginsRoot,
    files: EXAMPLE_PLUGIN_BUNDLE,
    baseDir: "/src/example-plugins",
    overwrite,
  });

  const pluginDataFilesWritten = await applyBundle({
    bundleRoot: pluginDataRoot,
    files: EXAMPLE_PLUGIN_DATA_BUNDLE,
    baseDir: "/src/example-plugin-data",
    overwrite,
  });

  const wallpaperFilesWritten = await applyWallpaperBundle({
    wallpaperRoot,
    files: WALLPAPER_BUNDLE,
    overwrite,
  });

  try {
    const dir = await getDirectoryHandle(normalizedRoot);
    await ensureRepo({ dir });

    let hasCommit = false;
    try {
      const commits = await listCommits({ dir }, { limit: 1 });
      hasCommit = Array.isArray(commits) && commits.length > 0;
    } catch {
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
      } catch (error) {
        console.error("Failed to create initial commit in new repo", error);
      }
    }
  } catch {
    // Non-fatal: git may be unavailable in the current environment.
  }

  return {
    rootDir: normalizedRoot,
    written: rootFilesWritten + pluginFilesWritten + pluginDataFilesWritten + wallpaperFilesWritten,
    rootFiles: rootFilesWritten,
    pluginFiles: pluginFilesWritten,
    pluginDataFiles: pluginDataFilesWritten,
    wallpaperFiles: wallpaperFilesWritten,
  };
}

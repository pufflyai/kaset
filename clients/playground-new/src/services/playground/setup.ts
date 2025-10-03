import { ROOT } from "@/constant";
import { deleteFile, getDirectoryHandle, readFile, writeFile } from "@pstdio/opfs-utils";

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

  let written = 0;

  for (const [absoluteKey, content] of Object.entries(files)) {
    const normalizedKey = absoluteKey.replace(/\\/g, "/");

    let relativePath = normalizedKey;
    if (normalizedBase && normalizedKey.startsWith(normalizedBase)) {
      relativePath = normalizedKey.slice(normalizedBase.length);
    }

    relativePath = relativePath.replace(/^\/+/, "");
    if (!relativePath) continue;

    const target = normalizeOpfsPath(`${normalizedRoot}/${relativePath}`);

    if (!overwrite) {
      try {
        await readFile(target);
        continue;
      } catch {
        // file missing — we'll create it below
      }
    }

    await writeFile(target, content);
    written++;
  }

  return written;
}

export async function setupPlayground(options: SetupOptions = {}) {
  const rootDir = options.rootDir?.trim() || ROOT;
  const overwrite = options.overwrite ?? false;

  const normalizedRoot = normalizeOpfsPath(rootDir);
  const pluginsRoot = `${normalizedRoot}/plugins`;

  await ensureDirectory(normalizedRoot);
  await ensureDirectory(pluginsRoot);

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

  return {
    rootDir: normalizedRoot,
    written: rootFilesWritten + pluginFilesWritten,
    rootFiles: rootFilesWritten,
    pluginFiles: pluginFilesWritten,
  };
}

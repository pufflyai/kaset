import { PLUGIN_DATA_ROOT } from "@/constant";
import { deleteDirectory, ls, readFile } from "@pstdio/opfs-utils";
import { Zip, ZipPassThrough } from "fflate";

import { getPluginsRoot } from "./plugin-host";

interface DownloadOptions {
  pluginId: string;
  label?: string;
}

const sanitizeFileSegment = (value: string) => {
  const normalized = value
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "download";
};

const buildRelativePath = (...segments: Array<string | null | undefined>) =>
  segments
    .filter((segment): segment is string => Boolean(segment && segment.trim().length > 0))
    .map((segment) => segment.replace(/^\/+|\/+$/g, ""))
    .filter((segment) => segment.length > 0)
    .join("/");

const joinZipPath = (...segments: Array<string | undefined>) =>
  segments
    .filter((segment): segment is string => Boolean(segment && segment.length > 0))
    .map((segment) => segment.replace(/^\/+|\/+$/g, ""))
    .join("/");

const createZipBlob = async (options: {
  rootDir: string;
  entries: Awaited<ReturnType<typeof ls>>;
  rootFolder: string;
}) => {
  const { rootDir, entries, rootFolder } = options;
  return createZipFromDirectories({
    rootFolder,
    directories: [
      {
        directoryPath: rootDir,
        entries,
      },
    ],
  });
};

const createZipFromDirectories = async (options: {
  rootFolder?: string;
  directories: Array<{
    directoryPath: string;
    entries: Awaited<ReturnType<typeof ls>> | null;
    folderLabel?: string;
  }>;
}) => {
  const { rootFolder, directories } = options;
  const zip = new Zip();
  const blobParts: BlobPart[] = [];
  const addedDirectories = new Set<string>();

  const zipCompletion = new Promise<void>((resolve, reject) => {
    zip.ondata = (error, chunk, final) => {
      if (error) {
        reject(error);
        return;
      }

      let part: ArrayBuffer;
      if (chunk.buffer instanceof ArrayBuffer) {
        if (chunk.byteOffset === 0 && chunk.byteLength === chunk.buffer.byteLength) {
          part = chunk.buffer;
        } else {
          part = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength);
        }
      } else {
        part = new Uint8Array(chunk).buffer;
      }

      blobParts.push(part);
      if (final) {
        resolve();
      }
    };
  });

  const addDirectoryEntry = (path: string | undefined) => {
    if (!path || path.length === 0) return;
    const normalizedPath = path.replace(/\/+$/g, "");
    if (addedDirectories.has(normalizedPath)) return;
    addedDirectories.add(normalizedPath);

    const entry = new ZipPassThrough(`${normalizedPath}/`);
    zip.add(entry);
    entry.push(new Uint8Array(), true);
  };

  addDirectoryEntry(rootFolder);

  for (const directory of directories) {
    const { directoryPath, entries, folderLabel } = directory;
    const normalizedFolderLabel = folderLabel ? folderLabel.replace(/^\/+|\/+$/g, "") : "";
    const basePath = joinZipPath(rootFolder, normalizedFolderLabel);

    addDirectoryEntry(basePath);

    if (!entries) {
      continue;
    }

    const subdirectories = entries.filter((item) => item.kind === "directory");
    for (const entry of subdirectories) {
      const directoryZipPath = joinZipPath(basePath, entry.path.replace(/\/+$/g, ""));
      addDirectoryEntry(directoryZipPath);
    }

    const fileEntries = entries.filter((item) => item.kind === "file");
    for (const entry of fileEntries) {
      const fullPath = buildRelativePath(directoryPath, entry.path);
      const data = (await readFile(fullPath, { encoding: null })) as Uint8Array;
      const fileZipPath = joinZipPath(basePath, entry.path);
      const fileEntry = new ZipPassThrough(fileZipPath);
      zip.add(fileEntry);
      fileEntry.push(data, true);
    }
  }

  zip.end();
  await zipCompletion;

  return new Blob(blobParts, { type: "application/zip" });
};

const triggerBlobDownload = (blob: Blob, filename: string) => {
  if (typeof document === "undefined") {
    throw new Error("Downloads are only supported in browser environments.");
  }

  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
};

const listDirectoryEntries = async (path: string) => {
  try {
    const entries = await ls(path, {
      maxDepth: Infinity,
      kinds: ["file", "directory"],
      showHidden: true,
      sortBy: "path",
    });

    return entries;
  } catch (error: any) {
    const name = error?.name;
    const code = error?.code;
    if (name === "NotFoundError" || code === "ENOENT" || code === 1) {
      return null;
    }
    throw error;
  }
};

const downloadDirectory = async (directoryPath: string, fileName: string) => {
  const entries = await listDirectoryEntries(directoryPath);
  if (!entries) {
    throw new Error(`Directory not found: ${directoryPath}`);
  }

  const rootFolder = sanitizeFileSegment(fileName);
  const blob = await createZipBlob({ rootDir: directoryPath, entries, rootFolder });
  triggerBlobDownload(blob, `${rootFolder}.zip`);
};

export const downloadPluginSource = async ({ pluginId, label }: DownloadOptions) => {
  const pluginsRoot = getPluginsRoot();
  const pluginDir = buildRelativePath(pluginsRoot, pluginId);
  const displayName = label ?? pluginId;
  await downloadDirectory(pluginDir, displayName);
};

export const downloadPluginData = async ({ pluginId, label }: DownloadOptions) => {
  const pluginDataDir = buildRelativePath(PLUGIN_DATA_ROOT, pluginId);
  const displayName = `${label ?? pluginId}-plugin-data`;
  await downloadDirectory(pluginDataDir, displayName);
};

export const downloadPluginBundle = async ({ pluginId, label }: DownloadOptions) => {
  const pluginsRoot = getPluginsRoot();
  const pluginDir = buildRelativePath(pluginsRoot, pluginId);
  const pluginDataDir = buildRelativePath(PLUGIN_DATA_ROOT, pluginId);
  const displayName = label ?? pluginId;
  const fileBaseName = sanitizeFileSegment(displayName);

  const pluginEntries = await listDirectoryEntries(pluginDir);
  if (!pluginEntries) {
    throw new Error(`Directory not found: ${pluginDir}`);
  }

  const pluginDataEntries = await listDirectoryEntries(pluginDataDir);

  const blob = await createZipFromDirectories({
    directories: [
      {
        directoryPath: pluginDir,
        entries: pluginEntries,
        folderLabel: "plugin",
      },
      {
        directoryPath: pluginDataDir,
        entries: pluginDataEntries,
        folderLabel: "plugin-data",
      },
    ],
  });

  triggerBlobDownload(blob, `${fileBaseName}.zip`);
};

export const deletePluginDirectories = async (pluginId: string) => {
  const pluginsRoot = getPluginsRoot();
  const pluginDir = buildRelativePath(pluginsRoot, pluginId);
  const pluginDataDir = buildRelativePath(PLUGIN_DATA_ROOT, pluginId);

  await deleteDirectory(pluginDir);
  await deleteDirectory(pluginDataDir);
};

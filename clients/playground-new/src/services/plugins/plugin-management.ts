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

const createZipBlob = async (options: {
  rootDir: string;
  entries: Awaited<ReturnType<typeof ls>>;
  rootFolder: string;
}) => {
  const { rootDir, entries, rootFolder } = options;
  const zip = new Zip();
  const chunks: Uint8Array[] = [];

  const zipCompletion = new Promise<void>((resolve, reject) => {
    zip.ondata = (error, chunk, final) => {
      if (error) {
        reject(error);
        return;
      }

      chunks.push(chunk);
      if (final) {
        resolve();
      }
    };
  });

  const rootEntry = new ZipPassThrough(`${rootFolder}/`);
  zip.add(rootEntry);
  rootEntry.push(new Uint8Array(), true);

  for (const entry of entries.filter((item) => item.kind === "directory")) {
    const dirEntry = new ZipPassThrough(`${rootFolder}/${entry.path.replace(/\/+$/g, "")}/`);
    zip.add(dirEntry);
    dirEntry.push(new Uint8Array(), true);
  }

  for (const entry of entries.filter((item) => item.kind === "file")) {
    const fullPath = buildRelativePath(rootDir, entry.path);
    const data = (await readFile(fullPath, { encoding: null })) as Uint8Array;
    const fileEntry = new ZipPassThrough(`${rootFolder}/${entry.path}`);
    zip.add(fileEntry);
    fileEntry.push(data, true);
  }

  zip.end();
  await zipCompletion;

  return new Blob(chunks, { type: "application/zip" });
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

export const deletePluginDirectories = async (pluginId: string) => {
  const pluginsRoot = getPluginsRoot();
  const pluginDir = buildRelativePath(pluginsRoot, pluginId);
  const pluginDataDir = buildRelativePath(PLUGIN_DATA_ROOT, pluginId);

  await deleteDirectory(pluginDir);
  await deleteDirectory(pluginDataDir);
};

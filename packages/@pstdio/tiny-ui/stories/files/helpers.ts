import { writeFile } from "@pstdio/opfs-utils";

import { loadSnapshot } from "../../src/fs/loadSnapshot";

type EntryResolver = string | ((root: string) => string);
type FilesResolver = Record<string, string> | ((root: string) => Record<string, string>);

const normalizeRelativePath = (path: string) => path.replace(/^\/+/, "");

export const normalizeRoot = (root: string) => {
  const normalized = String(root ?? "").replace(/^\/+/, "");
  if (!normalized) throw new Error("Snapshot root cannot be empty.");
  return normalized;
};

export const now = () =>
  typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();

const resolve = <T>(value: T | ((root: string) => T), root: string): T =>
  typeof value === "function" ? (value as (r: string) => T)(root) : value;

export const writeSnapshotFiles = async (root: string, entry: EntryResolver, files: FilesResolver) => {
  const folder = normalizeRoot(root);
  const entryPath = resolve(entry, root);
  const fileMap = resolve(files, root);

  await Promise.all(
    Object.entries(fileMap).map(([relativePath, source]) =>
      writeFile(`${folder}/${normalizeRelativePath(relativePath)}`, source),
    ),
  );

  await loadSnapshot(folder, entryPath);
};

export interface SnapshotInitializerOptions {
  entry: EntryResolver;
  files: FilesResolver;
}

export const createSnapshotInitializer = ({ entry, files }: SnapshotInitializerOptions) => {
  const inFlight = new Map<string, Promise<void>>();

  return (root: string) => {
    const normalized = normalizeRoot(root);
    let promise = inFlight.get(normalized);
    if (!promise) {
      promise = writeSnapshotFiles(root, entry, files).catch((error) => {
        inFlight.delete(normalized);
        throw error;
      });

      inFlight.set(normalized, promise);
    }

    return promise;
  };
};
